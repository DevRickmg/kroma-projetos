import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { getCredential } from "@/lib/credentials";
import { GoogleError, textSearch } from "@/lib/google/places";
import { loadSettings } from "@/lib/settings";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const { key } = await readJson<{ key?: string }>(req);
  const apiKey = key?.trim() || (await getCredential(user.id, "google_places"))?.secret;
  if (!apiKey) throw new ApiError(400, "Cole a API Key antes de testar.");
  const settings = await loadSettings(user.id);
  const { data: used } = await supabaseAdmin().rpc("increment_google_usage", { p_user: user.id, p_limit: settings.google_monthly_limit });
  if (used === null) throw new ApiError(429, "A cota do mês já acabou; o teste não foi feito pra não gerar cobrança.");
  try {
    const r = await textSearch({ apiKey, query: "padaria", circle: { lat: -23.5505, lng: -46.6333, radius: 2000 }, pageSize: 1 });
    return ok({ ok: true, message: `Conexão funcionando. O Google respondeu com ${r.places.length ? `"${r.places[0].displayName?.text}"` : "sucesso"}.` });
  } catch (e) {
    if (e instanceof GoogleError) return ok({ ok: false, code: e.code, message: e.message });
    throw e;
  }
});
