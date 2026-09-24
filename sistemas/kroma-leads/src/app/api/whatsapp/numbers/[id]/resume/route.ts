import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rescheduleForNumber } from "@/lib/sender/engine";

export const maxDuration = 60;

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: num } = await sb.from("whatsapp_numbers").select("id,status").eq("id", id).maybeSingle();
  if (!num) throw new ApiError(404, "Número não encontrado.");
  if (num.status !== "connected") throw new ApiError(400, "Conecte o número antes de retomar.");
  await supabaseAdmin().from("whatsapp_numbers").update({
    paused: false, pause_reason: null, paused_at: null, consecutive_failures: 0, resumed_at: new Date().toISOString(),
  }).eq("id", id);
  await rescheduleForNumber(user.id, id);
  return ok();
});
