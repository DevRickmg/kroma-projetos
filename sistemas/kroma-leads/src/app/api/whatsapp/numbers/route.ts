import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { setCredential, sha256 } from "@/lib/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createProvider, normalizeServerUrl, ProviderError } from "@/lib/whatsapp/uazapi";

export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const b = await readJson<{ label?: string; server_url?: string; token?: string; warmup_start_date?: string }>(req);
  const label = (b.label ?? "").trim() || "Prospecção";
  const token = (b.token ?? "").trim();
  if (!b.server_url?.trim()) throw new ApiError(400, "Informe a URL do servidor da Uazapi (ex.: https://suaconta.uazapi.com).");
  if (token.length < 8) throw new ApiError(400, "Informe o token da instância.");
  const serverUrl = normalizeServerUrl(b.server_url);

  let info;
  try {
    info = await createProvider(serverUrl, token).status();
  } catch (e) {
    throw new ApiError(400, e instanceof ProviderError ? e.message : "Não consegui validar a instância.");
  }
  const admin = supabaseAdmin();
  const { data: dup } = await admin.from("api_credentials").select("id").eq("kind", "uazapi_token")
    .eq("lookup_hash", sha256(token)).limit(1);
  if (dup?.length) throw new ApiError(409, "Essa instância já está cadastrada.");

  const { data: num, error } = await admin.from("whatsapp_numbers").insert({
    user_id: user.id, label, server_url: serverUrl, token_last4: token.slice(-4),
    status: info.status, phone: info.phone, profile_name: info.profileName,
    last_status_at: new Date().toISOString(),
    ...(b.warmup_start_date ? { warmup_start_date: b.warmup_start_date } : {}),
  }).select("id").single();
  if (error) throw new Error(error.message);
  try {
    await setCredential(user.id, "uazapi_token", token, num.id, true);
  } catch (e) {
    await admin.from("whatsapp_numbers").delete().eq("id", num.id);
    throw e;
  }
  return ok({ id: num.id });
});
