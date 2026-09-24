import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data } = await sb.from("campaigns").update({ status: "paused", pause_reason: "Pausada manualmente." })
    .eq("id", id).eq("status", "running").select("id");
  if (!data?.length) throw new ApiError(400, "Só dá pra pausar campanha em andamento.");
  return ok();
});
