import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { getCredential } from "@/lib/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadSettings } from "@/lib/settings";
import type { SearchParams } from "@/lib/types";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const p = await readJson<SearchParams>(req);
  if (!(await getCredential(user.id, "google_places"))) throw new ApiError(400, "Configure a API Key do Google Maps antes de buscar.");
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) throw new ApiError(400, "Marque no mapa onde buscar.");
  const categories = [...new Set((p.categories ?? []).map((c) => c.trim()).filter(Boolean))];
  if (!categories.length) throw new ApiError(400, "Escolha pelo menos um nicho.");
  if (categories.length > 30) throw new ApiError(400, "Máximo de 30 nichos por busca.");
  const admin = supabaseAdmin();
  const settings = await loadSettings(user.id);
  const period = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }).slice(0, 7) + "-01";
  const { data: usage } = await admin.from("google_usage").select("requests").eq("user_id", user.id).eq("period", period).maybeSingle();
  if ((usage?.requests ?? 0) >= settings.google_monthly_limit) {
    throw new ApiError(429, `A cota gratuita do mês acabou (${settings.google_monthly_limit} requisições). As buscas voltam dia 1º.`);
  }
  const { data: running } = await admin.from("search_jobs").select("id").eq("user_id", user.id).in("status", ["queued", "running"]).limit(1);
  if (running?.length) throw new ApiError(409, "Já tem uma busca em andamento. Espere terminar ou cancele.");

  const params: SearchParams = {
    lat: p.lat, lng: p.lng,
    radius_m: Math.max(300, Math.min(50000, Math.round(p.radius_m || 5000))),
    place_label: p.place_label?.slice(0, 120),
    categories,
    max_per_category: Math.max(10, Math.min(200, Math.round(p.max_per_category || 60))),
    filter: ["phone", "phone_site", "all"].includes(p.filter) ? p.filter : "phone",
    source: "google_maps",
  };
  const { data, error } = await admin.from("search_jobs").insert({ user_id: user.id, params }).select("id").single();
  if (error) throw new Error(error.message);
  return ok({ id: data.id });
});
