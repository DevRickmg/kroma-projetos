import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedNumber, webhookUrl } from "@/lib/whatsapp/numbers";
import { ProviderError } from "@/lib/whatsapp/uazapi";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { provider } = await ownedNumber(user.id, id);
  let webhookOk = false;
  let webhookError: string | null = null;
  try {
    await provider.setWebhook(webhookUrl(req.headers.get("host")));
    webhookOk = true;
  } catch (e) {
    webhookError = (e as Error).message;
  }
  try {
    const info = await provider.connect();
    await supabaseAdmin().from("whatsapp_numbers").update({
      status: info.status, qr_code: info.qrCode, phone: info.phone, profile_name: info.profileName,
      webhook_ok: webhookOk, last_status_at: new Date().toISOString(), last_error: webhookError,
    }).eq("id", id);
    return ok({ status: info.status, qr: info.qrCode, webhookOk, webhookError });
  } catch (e) {
    throw new ApiError(400, e instanceof ProviderError ? e.message : "Falha ao conectar.");
  }
});
