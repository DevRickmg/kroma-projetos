import "server-only";
/**
 * Processa buscas do Google Maps em lotes (cada chamada roda por no máximo
 * `budgetMs`). O progresso fica salvo em search_jobs.cursor, então tanto a
 * página aberta quanto o pg_cron podem continuar de onde parou.
 *
 * Estratégia por categoria:
 *  1. Busca a área inteira (até 3 páginas = 60 resultados).
 *  2. Se a área acabou antes de 60 → região esgotada, próxima categoria.
 *  3. Se bateu 60 e a meta é maior → divide em sub-regiões (grade) e varre
 *     do centro pra fora só até atingir a meta.
 */
import { supabaseAdmin } from "../supabase/admin";
import { getCredential } from "../credentials";
import { loadSettings } from "../settings";
import { normalizePhone } from "../phone";
import { instagramFromUrl, isInstagramUrl } from "../text";
import { circleToRect, distanceM, GoogleError, gridCells, placeCityState, textSearch, type Place } from "./places";
import type { SearchParams } from "../types";

interface Cursor {
  cat?: number;
  phase?: "area" | "grid";
  cell?: number;
  areaPages?: number;
  pageToken?: string | null;
  seen?: string[];
}

interface JobRow {
  id: string;
  user_id: string;
  status: string;
  params: SearchParams;
  cursor: Cursor;
  found: number;
  inserted: number;
  duplicates: number;
  discarded: number;
  requests: number;
}

const LOCK_MS = 90_000;

export async function claimJob(jobId: string): Promise<JobRow | null> {
  const now = new Date();
  const { data } = await supabaseAdmin()
    .from("search_jobs")
    .update({ status: "running", locked_until: new Date(now.getTime() + LOCK_MS).toISOString() })
    .eq("id", jobId)
    .in("status", ["queued", "running"])
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("*")
    .maybeSingle();
  return (data as JobRow) ?? null;
}

async function release(jobId: string) {
  await supabaseAdmin().from("search_jobs").update({ locked_until: null }).eq("id", jobId);
}

function gridSize(target: number): number {
  return Math.min(5, Math.max(2, Math.ceil(Math.sqrt(target / 40))));
}

/** Roda uma fatia da busca. Retorna true se o job terminou. */
export async function processJob(jobId: string, budgetMs: number): Promise<boolean> {
  const started = Date.now();
  const job = await claimJob(jobId);
  if (!job) return false;
  const admin = supabaseAdmin();

  const finish = async (status: "done" | "error" | "quota", error: string | null = null) => {
    await admin.from("search_jobs")
      .update({ status, error, locked_until: null, finished_at: new Date().toISOString(), current_category: null })
      .eq("id", job.id).in("status", ["queued", "running"]);
    return true;
  };

  const cred = await getCredential(job.user_id, "google_places");
  if (!cred) return finish("error", "Cadastre a API Key do Google Maps nas Configurações.");
  const settings = await loadSettings(job.user_id);
  const p = job.params;
  const cats = p.categories;
  const cur: Cursor = { cat: 0, phase: "area", cell: 0, areaPages: 0, pageToken: null, seen: [], ...job.cursor };
  const stats = { found: job.found, inserted: job.inserted, duplicates: job.duplicates, discarded: job.discarded, requests: job.requests };

  const save = async (): Promise<boolean> => {
    const { data } = await admin.from("search_jobs")
      .update({
        cursor: cur, ...stats,
        current_category: cats[cur.cat ?? 0] ?? null,
        locked_until: new Date(Date.now() + LOCK_MS).toISOString(),
      })
      .eq("id", job.id).in("status", ["queued", "running"]).select("id");
    return !!data?.length; // false = cancelado pelo usuário
  };

  const nextCategory = () => {
    cur.cat = (cur.cat ?? 0) + 1;
    cur.phase = "area";
    cur.cell = 0;
    cur.areaPages = 0;
    cur.pageToken = null;
    cur.seen = [];
  };

  try {
    while (Date.now() - started < budgetMs) {
      if ((cur.cat ?? 0) >= cats.length) {
        await save();
        return finish("done");
      }
      const category = cats[cur.cat!];
      const target = p.max_per_category;
      const seen = new Set(cur.seen ?? []);
      if (seen.size >= target) { nextCategory(); continue; }

      let rect;
      let cells: ReturnType<typeof gridCells> = [];
      if (cur.phase === "grid") {
        cells = gridCells(p.lat, p.lng, p.radius_m, gridSize(target));
        if ((cur.cell ?? 0) >= cells.length) { nextCategory(); continue; }
        rect = cells[cur.cell!];
      } else {
        rect = circleToRect(p.lat, p.lng, p.radius_m);
      }

      // conta ANTES de chamar o Google; se a cota acabou, para aqui
      const { data: used, error: usageErr } = await admin.rpc("increment_google_usage", {
        p_user: job.user_id, p_limit: settings.google_monthly_limit,
      });
      if (usageErr) throw new Error("Falha ao registrar uso da cota: " + usageErr.message);
      if (used === null) {
        await save();
        return finish("quota", `Cota do mês atingida (${settings.google_monthly_limit} requisições). A busca parou e salvou o que já tinha encontrado.`);
      }
      stats.requests++;

      const res = await textSearch({ apiKey: cred.secret, query: category, rect, pageToken: cur.pageToken ?? undefined });
      const r = await ingest(job.user_id, res.places, category, p, settings.ddi, seen);
      stats.found += r.found;
      stats.inserted += r.inserted;
      stats.duplicates += r.duplicates;
      stats.discarded += r.discarded;
      cur.seen = [...seen];

      if (seen.size >= target) {
        nextCategory();
      } else if (res.nextPageToken) {
        cur.pageToken = res.nextPageToken;
        if (cur.phase === "area") cur.areaPages = (cur.areaPages ?? 0) + 1;
      } else {
        cur.pageToken = null;
        if (cur.phase === "area") {
          const pages = (cur.areaPages ?? 0) + 1;
          // < 3 páginas = o Google não tem mais nada na região → esgotou
          if (pages < 3 || res.places.length < 20) nextCategory();
          else { cur.phase = "grid"; cur.cell = 0; }
        } else {
          cur.cell = (cur.cell ?? 0) + 1;
        }
      }
      if (!(await save())) return true; // cancelado
    }
    await release(job.id);
    return false;
  } catch (e) {
    await save();
    const msg = e instanceof GoogleError ? e.message : e instanceof Error ? e.message : "Erro inesperado";
    return finish(e instanceof GoogleError && e.code === "quota" ? "quota" : "error", msg);
  }
}

async function ingest(
  userId: string, places: Place[], category: string, p: SearchParams, ddi: string, seen: Set<string>,
) {
  const admin = supabaseAdmin();
  const out = { found: 0, inserted: 0, duplicates: 0, discarded: 0 };
  const rows: Record<string, unknown>[] = [];
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  for (const pl of places) {
    if (pl.businessStatus === "CLOSED_PERMANENTLY") { out.discarded++; continue; }
    if (pl.location && distanceM(p.lat, p.lng, pl.location.latitude, pl.location.longitude) > p.radius_m * 1.05) {
      out.discarded++;
      continue;
    }
    const phone = normalizePhone(pl.internationalPhoneNumber || pl.nationalPhoneNumber, ddi);
    const siteRaw = pl.websiteUri ?? null;
    const instagram = isInstagramUrl(siteRaw) ? instagramFromUrl(siteRaw) : null;
    const website = instagram ? null : siteRaw;
    if (p.filter !== "all" && !phone) { out.discarded++; continue; }
    if (p.filter === "phone_site" && !website) { out.discarded++; continue; }
    if (seen.has(pl.id)) continue; // já contado nessa categoria (sub-regiões se sobrepõem)
    seen.add(pl.id);
    out.found++;
    const { city, state } = placeCityState(pl);
    rows.push({
      user_id: userId,
      name: pl.displayName?.text ?? "Sem nome",
      category,
      address: pl.formattedAddress ?? null,
      city, state,
      phone_raw: pl.nationalPhoneNumber ?? pl.internationalPhoneNumber ?? null,
      phone_e164: phone?.e164 ?? null,
      phone_type: phone?.type ?? "unknown",
      website, instagram,
      rating: pl.rating ?? null,
      reviews_count: pl.userRatingCount ?? null,
      google_place_id: pl.id,
      google_maps_url: pl.googleMapsUri ?? null,
      lat: pl.location?.latitude ?? null,
      lng: pl.location?.longitude ?? null,
      source: "google_maps",
      source_detail: `Google Maps · ${today} · "${category}"${p.place_label ? ` · ${p.place_label}` : ""}`,
    });
  }
  if (!rows.length) return out;

  // deduplicação: place_id e telefone (inclui arquivados → nunca voltam)
  const placeIds = rows.map((r) => r.google_place_id as string);
  const phones = rows.map((r) => r.phone_e164).filter(Boolean) as string[];
  const [byPlace, byPhone] = await Promise.all([
    admin.from("leads").select("google_place_id").eq("user_id", userId).in("google_place_id", placeIds),
    phones.length
      ? admin.from("leads").select("phone_e164").eq("user_id", userId).in("phone_e164", phones)
      : Promise.resolve({ data: [] as { phone_e164: string }[] }),
  ]);
  const existingPlaces = new Set((byPlace.data ?? []).map((r) => r.google_place_id));
  const existingPhones = new Set((byPhone.data ?? []).map((r) => r.phone_e164));
  const batchPhones = new Set<string>();
  const fresh = rows.filter((r) => {
    const ph = r.phone_e164 as string | null;
    const dup = existingPlaces.has(r.google_place_id as string) || (ph && (existingPhones.has(ph) || batchPhones.has(ph)));
    if (ph) batchPhones.add(ph);
    if (dup) out.duplicates++;
    return !dup;
  });
  if (!fresh.length) return out;

  const { error } = await admin.from("leads").insert(fresh);
  if (!error) {
    out.inserted += fresh.length;
    return out;
  }
  // corrida com outra busca: insere um a um e conta os conflitos como duplicados
  for (const row of fresh) {
    const { error: e } = await admin.from("leads").insert(row);
    if (!e) out.inserted++;
    else if (e.code === "23505") out.duplicates++;
    else throw new Error("Erro ao salvar lead: " + e.message);
  }
  return out;
}
