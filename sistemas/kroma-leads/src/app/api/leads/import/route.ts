import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadSettings } from "@/lib/settings";
import { normalizePhone } from "@/lib/phone";
import { isInstagramUrl, normalizeInstagram, normalizeWebsite } from "@/lib/text";

export const maxDuration = 60;

interface Row {
  name?: string; phone?: string; website?: string; instagram?: string; category?: string; city?: string; email?: string;
}

/** Recebe as linhas já mapeadas pela tela, normaliza, deduplica e insere */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { rows, filename } = await readJson<{ rows?: Row[]; filename?: string }>(req);
  if (!rows?.length) throw new ApiError(400, "Nenhuma linha pra importar.");
  if (rows.length > 5000) throw new ApiError(400, "Máximo de 5.000 linhas por importação.");
  const s = await loadSettings(user.id);
  const admin = supabaseAdmin();
  const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const report = { imported: 0, duplicates: 0, invalid: 0, errors: [] as string[] };

  const prepared: Record<string, unknown>[] = [];
  const seenPhones = new Set<string>();
  rows.forEach((r, i) => {
    const name = r.name?.trim();
    const phone = normalizePhone(r.phone, s.ddi);
    if (!name || (!phone && !r.website?.trim() && !r.instagram?.trim() && !r.email?.trim())) {
      report.invalid++;
      if (report.errors.length < 20) report.errors.push(`Linha ${i + 2}: ${!name ? "sem nome" : "sem telefone, site, Instagram ou e-mail"}`);
      return;
    }
    if (r.phone?.trim() && !phone && report.errors.length < 20) report.errors.push(`Linha ${i + 2}: telefone "${r.phone}" inválido (importado sem telefone)`);
    if (phone) {
      if (seenPhones.has(phone.e164)) { report.duplicates++; return; }
      seenPhones.add(phone.e164);
    }
    const site = r.website?.trim() || null;
    const igFromSite = isInstagramUrl(site) ? site : null;
    const email = r.email?.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim()) ? r.email.trim() : null;
    prepared.push({
      user_id: user.id,
      name: name.slice(0, 200),
      category: r.category?.trim() || null,
      city: r.city?.trim() || null,
      phone_raw: r.phone?.trim() || null,
      phone_e164: phone?.e164 ?? null,
      phone_type: phone?.type ?? "unknown",
      website: igFromSite ? null : normalizeWebsite(site),
      instagram: normalizeInstagram(r.instagram) ?? normalizeInstagram(igFromSite),
      email,
      source: "import",
      source_detail: `Importação CSV · ${today}${filename ? ` · ${filename.slice(0, 80)}` : ""}`,
    });
  });

  // deduplicação contra a base (inclui arquivados)
  const phones = prepared.map((p) => p.phone_e164).filter(Boolean) as string[];
  const existing = new Set<string>();
  for (let i = 0; i < phones.length; i += 300) {
    const { data } = await admin.from("leads").select("phone_e164").eq("user_id", user.id).in("phone_e164", phones.slice(i, i + 300));
    for (const d of data ?? []) existing.add(d.phone_e164);
  }
  const fresh = prepared.filter((p) => {
    if (p.phone_e164 && existing.has(p.phone_e164 as string)) { report.duplicates++; return false; }
    return true;
  });

  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500);
    const { error } = await admin.from("leads").insert(chunk);
    if (!error) { report.imported += chunk.length; continue; }
    for (const row of chunk) {
      const { error: e } = await admin.from("leads").insert(row);
      if (!e) report.imported++;
      else if (e.code === "23505") report.duplicates++;
      else { report.invalid++; if (report.errors.length < 20) report.errors.push(`${row.name}: ${e.message}`); }
    }
  }
  return ok(report);
});
