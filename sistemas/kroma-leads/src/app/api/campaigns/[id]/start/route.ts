import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { startCampaign } from "@/lib/sender/engine";

export const maxDuration = 60;

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { lead_ids } = await readJson<{ lead_ids?: string[] }>(req);
  if (!lead_ids?.length) throw new ApiError(400, "Selecione os leads da campanha.");
  if (lead_ids.length > 5000) throw new ApiError(400, "Máximo de 5.000 leads por campanha.");
  const sb = await supabaseServer();
  const { data } = await sb.from("campaigns").select("id").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "Campanha não encontrada.");
  try {
    return ok(await startCampaign(user.id, id, lead_ids));
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
});
