import { ApiError, handler, ok, readJson, requireUser } from "@/lib/api";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCredential } from "@/lib/credentials";
import { createProvider } from "@/lib/whatsapp/uazapi";

/** Resposta manual pela tela de Conversas, pelo mesmo número da conversa */
export const POST = handler(async (req: Request) => {
  const user = await requireUser();
  const b = await readJson<{ lead_id?: string; number_id?: string; text?: string }>(req);
  const text = (b.text ?? "").trim();
  if (!text) throw new ApiError(400, "Mensagem vazia.");
  const sb = await supabaseServer();
  const { data: lead } = await sb.from("leads").select("*").eq("id", b.lead_id ?? "").maybeSingle();
  if (!lead?.phone_e164) throw new ApiError(400, "Esse lead não tem telefone.");

  let numberId = b.number_id;
  if (!numberId) {
    const { data: last } = await sb.from("messages").select("number_id").eq("lead_id", lead.id)
      .not("number_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    numberId = last?.number_id ?? undefined;
  }
  if (!numberId) {
    const { data: any } = await sb.from("whatsapp_numbers").select("id").eq("status", "connected").limit(1).maybeSingle();
    numberId = any?.id;
  }
  if (!numberId) throw new ApiError(400, "Nenhum número de WhatsApp conectado.");
  const { data: num } = await sb.from("whatsapp_numbers").select("*").eq("id", numberId).maybeSingle();
  if (!num) throw new ApiError(404, "Número não encontrado.");
  if (num.status !== "connected") throw new ApiError(400, `O número "${num.label}" está desconectado.`);
  const token = await getCredential(user.id, "uazapi_token", num.id);
  if (!token) throw new ApiError(400, "Token da instância não encontrado.");

  const res = await createProvider(num.server_url, token.secret)
    .sendText(lead.phone_e164.replace(/\D/g, ""), text, Math.min(4000, 800 + text.length * 25));
  if (!res.ok) throw new ApiError(502, res.error ?? "Falha no envio.");

  const now = new Date().toISOString();
  const admin = supabaseAdmin();
  const { data: msg } = await admin.from("messages").insert({
    user_id: user.id, lead_id: lead.id, number_id: num.id, direction: "out", body: text,
    provider_message_id: res.providerMessageId ?? null, status: "sent", created_at: now,
  }).select("*").single();
  await admin.from("leads").update({
    last_message_at: now, last_message_preview: text.slice(0, 140), unread_count: 0,
    contact_mode: lead.contact_mode ?? "manual",
    status: ["new", "qualified"].includes(lead.status) ? "contacted" : lead.status,
  }).eq("id", lead.id);
  return ok({ message: msg });
});
