import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedNumber } from "@/lib/whatsapp/numbers";
import { pauseNumber } from "@/lib/sender/engine";
import { ProviderError } from "@/lib/whatsapp/uazapi";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { num, provider } = await ownedNumber(user.id, id);
  try {
    const info = await provider.status();
    await supabaseAdmin().from("whatsapp_numbers").update({
      status: info.status, qr_code: info.qrCode, phone: info.phone ?? num.phone,
      profile_name: info.profileName ?? num.profile_name, last_status_at: new Date().toISOString(),
    }).eq("id", id);
    if (info.status === "disconnected" && num.status === "connected") {
      await pauseNumber(id, "A instância desconectou. Reconecte e retome.");
    }
    return ok({ status: info.status, qr: info.qrCode });
  } catch (e) {
    throw new ApiError(400, e instanceof ProviderError ? e.message : "Falha ao consultar status.");
  }
});
