import { handler, ok, requireUser } from "@/lib/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ownedNumber } from "@/lib/whatsapp/numbers";
import { pauseNumber } from "@/lib/sender/engine";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { provider } = await ownedNumber(user.id, id);
  await provider.disconnect();
  await supabaseAdmin().from("whatsapp_numbers")
    .update({ status: "disconnected", qr_code: null, last_status_at: new Date().toISOString() }).eq("id", id);
  await pauseNumber(id, "Desconectado manualmente.");
  return ok();
});
