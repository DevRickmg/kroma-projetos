import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { loadSettings } from "@/lib/settings";
import { normalizePhone } from "@/lib/phone";
import { normalizeInstagram, normalizeWebsite } from "@/lib/text";

/** Edição de contato com normalização no servidor (telefone → E.164 + tipo) */
export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const b = await readJson<{ phone?: string | null; email?: string | null; website?: string | null; instagram?: string | null }>(req);
  const patch: Record<string, unknown> = {};
  if (b.phone !== undefined) {
    if (!b.phone?.trim()) {
      Object.assign(patch, { phone_raw: null, phone_e164: null, phone_type: "unknown" });
    } else {
      const s = await loadSettings(user.id);
      const p = normalizePhone(b.phone, s.ddi);
      if (!p) throw new ApiError(400, "Telefone inválido. Use DDD + número, ex.: (11) 99999-8888.");
      Object.assign(patch, { phone_raw: b.phone.trim(), phone_e164: p.e164, phone_type: p.type });
    }
  }
  if (b.email !== undefined) {
    const e = b.email?.trim() || null;
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new ApiError(400, "E-mail inválido.");
    patch.email = e;
  }
  if (b.website !== undefined) patch.website = normalizeWebsite(b.website);
  if (b.instagram !== undefined) patch.instagram = normalizeInstagram(b.instagram);

  const sb = await supabaseServer();
  const { data, error } = await sb.from("leads").update(patch).eq("id", id).select("*").maybeSingle();
  if (error?.code === "23505") throw new ApiError(409, "Já existe outro lead com esse telefone.");
  if (error) throw new ApiError(400, error.message);
  if (!data) throw new ApiError(404, "Lead não encontrado.");
  return ok({ lead: data });
});
