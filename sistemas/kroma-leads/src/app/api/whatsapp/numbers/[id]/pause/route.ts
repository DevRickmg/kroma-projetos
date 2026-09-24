import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { pauseNumber } from "@/lib/sender/engine";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data } = await sb.from("whatsapp_numbers").select("id").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "Número não encontrado.");
  await pauseNumber(id, "Pausado manualmente.");
  return ok();
});
