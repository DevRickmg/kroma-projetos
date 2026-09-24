import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rescheduleCampaign } from "@/lib/sender/engine";

export const maxDuration = 60;

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: camp } = await sb.from("campaigns").select("id,status").eq("id", id).maybeSingle();
  if (!camp) throw new ApiError(404, "Campanha não encontrada.");
  if (camp.status !== "paused") throw new ApiError(400, "Essa campanha não está pausada.");
  try {
    // reagenda o que falta a partir de agora (a pausa pode ter durado dias)
    const n = await rescheduleCampaign(user.id, id);
    await supabaseAdmin().from("campaigns").update({ status: "running", pause_reason: null }).eq("id", id);
    return ok({ rescheduled: n });
  } catch (e) {
    throw new ApiError(400, (e as Error).message);
  }
});
