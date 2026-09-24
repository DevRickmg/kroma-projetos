import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { deleteCredential } from "@/lib/credentials";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  const b = await readJson<{ label?: string; warmup_start_date?: string }>(req);
  const patch: Record<string, string> = {};
  if (b.label?.trim()) patch.label = b.label.trim();
  if (b.warmup_start_date && /^\d{4}-\d{2}-\d{2}$/.test(b.warmup_start_date)) patch.warmup_start_date = b.warmup_start_date;
  const sb = await supabaseServer();
  const { error } = await sb.from("whatsapp_numbers").update(patch).eq("id", id);
  if (error) throw new ApiError(400, error.message);
  return ok();
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const sb = await supabaseServer();
  const { data } = await sb.from("whatsapp_numbers").select("id").eq("id", id).maybeSingle();
  if (!data) throw new ApiError(404, "Número não encontrado.");
  const admin = supabaseAdmin();
  await admin.from("message_queue").update({ status: "cancelled", error: "Número removido." }).eq("number_id", id).eq("status", "scheduled");
  await deleteCredential(user.id, "uazapi_token", id);
  await admin.from("whatsapp_numbers").delete().eq("id", id);
  return ok();
});
