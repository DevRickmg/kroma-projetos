import { ApiError, handler, ok, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data: camp } = await sb.from("campaigns").select("id,status").eq("id", id).maybeSingle();
  if (!camp) throw new ApiError(404, "Campanha não encontrada.");
  const admin = supabaseAdmin();
  await admin.from("campaigns").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", id);
  await admin.from("message_queue").update({ status: "cancelled", error: "Campanha cancelada." })
    .eq("campaign_id", id).eq("status", "scheduled");
  return ok();
});
