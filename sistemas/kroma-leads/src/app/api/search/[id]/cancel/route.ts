import { handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  await sb.from("search_jobs").update({ status: "cancelled", finished_at: new Date().toISOString(), locked_until: null })
    .eq("id", id).in("status", ["queued", "running"]);
  return ok();
});
