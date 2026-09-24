import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { processJob } from "@/lib/google/search-job";

export const maxDuration = 60;

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data } = await sb.from("search_jobs").select("id,status").eq("id", id).maybeSingle(); // RLS: só o dono
  if (!data) throw new ApiError(404, "Busca não encontrada.");
  if (!["queued", "running"].includes(data.status)) return ok({ done: true });
  const done = await processJob(id, 40_000);
  return ok({ done });
});
