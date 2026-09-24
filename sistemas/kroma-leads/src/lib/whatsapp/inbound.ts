import "server-only";
import { supabaseAdmin } from "../supabase/admin";
import { findNumberByToken } from "../credentials";
import { loadSettings } from "../settings";
import { jidToE164, phoneVariants, normalizePhone } from "../phone";
import { DEFAULT_OPTOUT_KEYWORDS, isOptOut } from "../text";
import { checkOptoutStreak, pauseNumber } from "../sender/engine";
import type { WebhookEvent } from "./uazapi";

const REPLY_PROMOTES = ["new", "qualified", "contacted"];

export async function handleWebhookEvent(ev: WebhookEvent): Promise<string> {
  if (ev.type === "ignored" || !ev.token) return "ignorado";
  const owner = await findNumberByToken(ev.token);
  if (!owner) return "instância desconhecida";
  const admin = supabaseAdmin();
  const numberId = owner.ref_id;
  const userId = owner.user_id;

  if (ev.type === "connection") {
    const { data: prev } = await admin.from("whatsapp_numbers").select("status").eq("id", numberId).single();
    await admin.from("whatsapp_numbers").update({
      status: ev.status,
      qr_code: ev.status === "connecting" ? undefined : null,
      last_status_at: new Date().toISOString(),
      ...(ev.status === "connected" ? { last_error: null } : {}),
    }).eq("id", numberId);
    if (ev.banned) {
      await pauseNumber(numberId, `O WhatsApp aplicou restrição/banimento temporário (${ev.reason ?? "sem detalhe"}).`);
    } else if (ev.status === "disconnected" && prev?.status === "connected") {
      await pauseNumber(numberId, `A instância desconectou${ev.reason ? ` (${ev.reason})` : ""}. Reconecte e retome.`);
    }
    return "conexão atualizada";
  }

  if (ev.type === "receipt") {
    if (!ev.state || !ev.messageIds.length) return "recibo ignorado";
    const patch = ev.state === "read"
      ? { status: "read", read_at: new Date().toISOString() }
      : { status: "delivered", delivered_at: new Date().toISOString() };
    let q = admin.from("messages").update(patch).eq("number_id", numberId).eq("direction", "out").in("provider_message_id", ev.messageIds);
    if (ev.state === "delivered") q = q.eq("status", "sent"); // nunca volta de "lida" pra "entregue"
    await q;
    return "recibo aplicado";
  }

  // ---- mensagem ----
  if (ev.isGroup) return "grupo ignorado";
  const e164 = jidToE164(ev.senderPn) ?? jidToE164(ev.chatJid);
  if (!e164) return "sem telefone identificável";

  if (ev.providerMessageId) {
    const { count } = await admin.from("messages").select("id", { count: "exact", head: true })
      .eq("number_id", numberId).eq("provider_message_id", ev.providerMessageId);
    if (count) return "duplicada";
  }

  const variants = phoneVariants(e164);
  let { data: lead } = await admin.from("leads").select("*").eq("user_id", userId).in("phone_e164", variants).limit(1).maybeSingle();

  // mensagem que eu mandei pelo celular (não pela API): só registra no histórico
  if (ev.fromMe) {
    if (!lead) return "enviada pelo celular para contato fora da base";
    await admin.from("messages").insert({
      user_id: userId, lead_id: lead.id, number_id: numberId, direction: "out", body: ev.text,
      provider_message_id: ev.providerMessageId, status: "sent", created_at: ev.timestamp.toISOString(),
    });
    await admin.from("leads").update({
      last_message_at: ev.timestamp.toISOString(), last_message_preview: ev.text.slice(0, 140),
      contact_mode: lead.contact_mode ?? "manual",
      status: ["new", "qualified"].includes(lead.status) ? "contacted" : lead.status,
    }).eq("id", lead.id);
    return "saída manual registrada";
  }

  if (!lead) {
    // alguém escreveu nesse número sem estar na base: cria o contato pra aparecer nas Conversas
    const norm = normalizePhone(e164);
    const { data: created } = await admin.from("leads").insert({
      user_id: userId,
      name: ev.senderName?.trim() || norm?.national || e164,
      phone_raw: e164, phone_e164: e164, phone_type: norm?.type ?? "unknown",
      source: "manual", source_detail: "Entrou em contato pelo WhatsApp",
      contact_mode: "manual",
    }).select("*").single();
    lead = created;
    if (!lead) return "não consegui criar o contato";
  }

  const settings = await loadSettings(userId);
  const keywords = settings.optout_keywords.length ? settings.optout_keywords : DEFAULT_OPTOUT_KEYWORDS;
  const optout = isOptOut(ev.text, keywords);

  await admin.from("messages").insert({
    user_id: userId, lead_id: lead.id, number_id: numberId, direction: "in", body: ev.text,
    provider_message_id: ev.providerMessageId, status: "received", is_optout: optout,
    campaign_id: await lastCampaignFor(lead.id),
    created_at: ev.timestamp.toISOString(),
  });

  // respondeu → sai de qualquer fila pendente
  await admin.from("message_queue").update({ status: "cancelled", error: optout ? "Pediu para sair." : "Lead respondeu." })
    .eq("lead_id", lead.id).eq("status", "scheduled");

  const newStatus = optout ? "do_not_disturb" : REPLY_PROMOTES.includes(lead.status) ? "replied" : lead.status;
  await admin.from("leads").update({
    status: newStatus,
    unread_count: (lead.unread_count ?? 0) + 1,
    last_message_at: ev.timestamp.toISOString(),
    last_message_preview: ev.text.slice(0, 140),
    contact_mode: lead.contact_mode ?? "manual",
  }).eq("id", lead.id);

  if (optout) {
    await admin.from("blocklist").upsert(
      { user_id: userId, phone_e164: lead.phone_e164 ?? e164, reason: `Pediu para sair: "${ev.text.slice(0, 80)}"` },
      { onConflict: "user_id,phone_e164", ignoreDuplicates: true },
    );
    await checkOptoutStreak(numberId, settings);
    return "pedido de saída registrado";
  }
  return "resposta registrada";
}

async function lastCampaignFor(leadId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("messages").select("campaign_id")
    .eq("lead_id", leadId).eq("direction", "out").not("campaign_id", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data?.campaign_id ?? null;
}
