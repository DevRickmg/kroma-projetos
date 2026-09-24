import "server-only";
/**
 * Motor de disparo: monta a agenda, envia o que venceu e aplica as regras de
 * proteção (revalidação antes de cada envio + pausa automática do número).
 * Nada aqui fica rodando: o pg_cron chama /api/cron/tick a cada minuto.
 */
import { supabaseAdmin } from "../supabase/admin";
import { getCredential } from "../credentials";
import { loadSettings } from "../settings";
import { phoneVariants } from "../phone";
import { leadVars, render } from "../template";
import { generateOpener } from "../ai";
import { localDateKey } from "../time";
import { createProvider } from "../whatsapp/uazapi";
import {
  dailyLimit, isWithinWindow, newLongPauseEvery, nextValidSlot, planSchedule, typingMs, type NumberPlanState,
} from "./schedule";
import type { Lead, Settings } from "../types";

const BLOCKING_STATUS = ["do_not_disturb", "not_interested", "replied", "negotiating", "client"];

// ------------------------------------------------------------------
// Estado dos números (base da agenda)
// ------------------------------------------------------------------
export async function replyRate(numberId: string, since?: string | null): Promise<{ contacted: number; replied: number; rate: number | null }> {
  const admin = supabaseAdmin();
  const cutoff = new Date(Date.now() - 6 * 3600_000).toISOString(); // dá tempo de responder
  let q = admin.from("messages").select("lead_id").eq("number_id", numberId).eq("direction", "out")
    .not("campaign_id", "is", null).lt("created_at", cutoff);
  if (since) q = q.gte("created_at", since);
  const { data: outs } = await q.limit(5000);
  const contacted = [...new Set((outs ?? []).map((r) => r.lead_id as string))];
  if (!contacted.length) return { contacted: 0, replied: 0, rate: null };
  let replied = 0;
  for (let i = 0; i < contacted.length; i += 300) {
    const { data } = await admin.from("messages").select("lead_id").eq("direction", "in")
      .in("lead_id", contacted.slice(i, i + 300));
    replied += new Set((data ?? []).map((r) => r.lead_id)).size;
  }
  return { contacted: contacted.length, replied, rate: (replied / contacted.length) * 100 };
}

async function numberStates(numberIds: string[], settings: Settings, excludeQueueIds: Set<string>): Promise<NumberPlanState[]> {
  const admin = supabaseAdmin();
  const tz = settings.send_config.timezone;
  const now = new Date();
  const todayStart = new Date(now.getTime() - 26 * 3600_000).toISOString();
  const { data: nums } = await admin.from("whatsapp_numbers").select("id,warmup_start_date").in("id", numberIds);
  const states: NumberPlanState[] = [];
  for (const n of nums ?? []) {
    const perDay = new Map<string, number>();
    let cursor = now;
    const [{ data: sent }, { data: queued }, rr] = await Promise.all([
      admin.from("messages").select("created_at").eq("number_id", n.id).eq("direction", "out")
        .not("campaign_id", "is", null).gte("created_at", todayStart),
      admin.from("message_queue").select("id,scheduled_at").eq("number_id", n.id)
        .in("status", ["scheduled", "sending"]).not("scheduled_at", "is", null).limit(10000),
      replyRate(n.id),
    ]);
    for (const m of sent ?? []) {
      const d = new Date(m.created_at);
      const k = localDateKey(d, tz);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
      if (d > cursor) cursor = d;
    }
    for (const q of queued ?? []) {
      if (excludeQueueIds.has(q.id)) continue;
      const d = new Date(q.scheduled_at);
      const k = localDateKey(d, tz);
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
      if (d > cursor) cursor = d;
    }
    states.push({
      id: n.id,
      warmupStart: n.warmup_start_date,
      replyRate: rr.contacted >= 20 ? rr.rate : null,
      perDay,
      cursor,
      sinceLongPause: 0,
      longPauseEvery: newLongPauseEvery(settings.send_config, Math.random),
    });
  }
  return states;
}

async function applySchedule(items: { id: string; number_id: string; scheduled_at: Date }[]) {
  const admin = supabaseAdmin();
  for (let i = 0; i < items.length; i += 500) {
    const chunk = items.slice(i, i + 500).map((x) => ({ ...x, scheduled_at: x.scheduled_at.toISOString() }));
    const { error } = await admin.rpc("apply_schedule", { p_items: chunk });
    if (error) throw new Error("Falha ao salvar a agenda: " + error.message);
  }
}

// ------------------------------------------------------------------
// Campanha: iniciar / reagendar
// ------------------------------------------------------------------
export async function eligibleLeads(userId: string, leadIds: string[]) {
  const admin = supabaseAdmin();
  const leads: Lead[] = [];
  for (let i = 0; i < leadIds.length; i += 300) {
    const { data } = await admin.from("leads").select("*").eq("user_id", userId).in("id", leadIds.slice(i, i + 300));
    leads.push(...((data ?? []) as Lead[]));
  }
  const { data: blocked } = await admin.from("blocklist").select("phone_e164").eq("user_id", userId);
  const blockSet = new Set((blocked ?? []).map((b) => b.phone_e164));
  // quem já recebeu mensagem de campanha ou está numa fila ativa não recebe de novo
  const { data: queued } = await admin.from("message_queue").select("lead_id")
    .eq("user_id", userId).in("status", ["scheduled", "sending", "sent"]);
  const queuedSet = new Set((queued ?? []).map((q) => q.lead_id));

  const reasons = { no_mobile: 0, blocked: 0, status: 0, already: 0, archived: 0 };
  const ok: Lead[] = [];
  for (const l of leads) {
    if (l.archived) { reasons.archived++; continue; }
    if (!l.phone_e164 || l.phone_type !== "mobile") { reasons.no_mobile++; continue; }
    if (phoneVariants(l.phone_e164).some((p) => blockSet.has(p))) { reasons.blocked++; continue; }
    if (BLOCKING_STATUS.includes(l.status)) { reasons.status++; continue; }
    if (queuedSet.has(l.id)) { reasons.already++; continue; }
    ok.push(l);
  }
  return { ok, reasons, total: leads.length };
}

export async function startCampaign(userId: string, campaignId: string, leadIds: string[]) {
  const admin = supabaseAdmin();
  const settings = await loadSettings(userId);
  const { data: camp } = await admin.from("campaigns").select("*").eq("id", campaignId).eq("user_id", userId).single();
  if (!camp) throw new Error("Campanha não encontrada.");
  if (camp.status !== "draft") throw new Error("Essa campanha já foi iniciada.");
  const { data: templates } = await admin.from("campaign_templates").select("id").eq("campaign_id", campaignId).order("position");
  if (!templates?.length) throw new Error("Cadastre pelo menos um modelo de mensagem.");
  const { data: nums } = await admin.from("whatsapp_numbers").select("id,paused").in("id", camp.number_ids).eq("user_id", userId);
  const active = (nums ?? []).filter((n) => !n.paused).map((n) => n.id);
  if (!active.length) throw new Error("Escolha pelo menos um número de WhatsApp ativo (não pausado).");

  const { ok, reasons, total } = await eligibleLeads(userId, leadIds);
  if (!ok.length) throw new Error("Nenhum lead elegível (precisa ter celular, não estar bloqueado nem já contatado).");

  // modelos alternados e embaralhados entre os leads
  const shuffled = [...ok].sort(() => Math.random() - 0.5);
  const rows = shuffled.map((l, i) => ({
    user_id: userId, campaign_id: campaignId, lead_id: l.id,
    template_id: templates[i % templates.length].id, status: "scheduled",
  }));
  const inserted: { id: string }[] = [];
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await admin.from("message_queue").insert(rows.slice(i, i + 500)).select("id");
    if (error) throw new Error("Falha ao montar a fila: " + error.message);
    inserted.push(...(data ?? []));
  }
  const ids = inserted.map((r) => r.id);
  const states = await numberStates(active, settings, new Set(ids));
  await applySchedule(planSchedule(ids, states, settings.send_config, settings.warmup_config));
  await admin.from("campaigns").update({ status: "running", started_at: new Date().toISOString(), pause_reason: null }).eq("id", campaignId);
  return { queued: ids.length, skipped: total - ids.length, reasons };
}

export async function rescheduleCampaign(userId: string, campaignId: string) {
  const admin = supabaseAdmin();
  const settings = await loadSettings(userId);
  const { data: camp } = await admin.from("campaigns").select("number_ids").eq("id", campaignId).single();
  const { data: nums } = await admin.from("whatsapp_numbers").select("id,paused").in("id", camp?.number_ids ?? []);
  const active = (nums ?? []).filter((n) => !n.paused).map((n) => n.id);
  if (!active.length) throw new Error("Todos os números dessa campanha estão pausados. Retome um número primeiro.");
  const { data: items } = await admin.from("message_queue").select("id").eq("campaign_id", campaignId)
    .eq("status", "scheduled").order("scheduled_at", { ascending: true, nullsFirst: false }).limit(10000);
  const ids = (items ?? []).map((r) => r.id);
  if (!ids.length) return 0;
  const states = await numberStates(active, settings, new Set(ids));
  await applySchedule(planSchedule(ids, states, settings.send_config, settings.warmup_config));
  return ids.length;
}

/** Depois de retomar um número: reagenda as campanhas rodando que usam ele */
export async function rescheduleForNumber(userId: string, numberId: string) {
  const { data: camps } = await supabaseAdmin().from("campaigns").select("id")
    .eq("user_id", userId).eq("status", "running").contains("number_ids", [numberId]);
  for (const c of camps ?? []) await rescheduleCampaign(userId, c.id);
}

// ------------------------------------------------------------------
// Pausa automática
// ------------------------------------------------------------------
export async function pauseNumber(numberId: string, reason: string) {
  const admin = supabaseAdmin();
  const { data: n } = await admin.from("whatsapp_numbers")
    .update({ paused: true, pause_reason: reason, paused_at: new Date().toISOString() })
    .eq("id", numberId).eq("paused", false).select("user_id").maybeSingle();
  if (!n) return; // já estava pausado
  // campanhas que ficaram sem nenhum número ativo também pausam
  const { data: camps } = await admin.from("campaigns").select("id,number_ids")
    .eq("user_id", n.user_id).eq("status", "running").contains("number_ids", [numberId]);
  for (const c of camps ?? []) {
    const { data: others } = await admin.from("whatsapp_numbers").select("id").in("id", c.number_ids).eq("paused", false);
    if (!others?.length) {
      await admin.from("campaigns").update({ status: "paused", pause_reason: `Número pausado: ${reason}` }).eq("id", c.id);
    }
  }
}

export async function checkReplyRate(numberId: string, settings: Settings) {
  const { data: n } = await supabaseAdmin().from("whatsapp_numbers").select("resumed_at,paused").eq("id", numberId).single();
  if (!n || n.paused) return;
  const ap = settings.autopause_config;
  const rr = await replyRate(numberId, n.resumed_at);
  if (rr.contacted >= ap.min_reply_rate_after && rr.rate !== null && rr.rate < ap.min_reply_rate) {
    await pauseNumber(numberId, `Taxa de resposta baixa: ${rr.rate.toFixed(1)}% depois de ${rr.contacted} contatos (mínimo ${ap.min_reply_rate}%). Revise a mensagem antes de retomar.`);
  }
}

export async function checkOptoutStreak(numberId: string, settings: Settings) {
  const ap = settings.autopause_config;
  const { data } = await supabaseAdmin().from("messages").select("is_optout")
    .eq("number_id", numberId).eq("direction", "in").order("created_at", { ascending: false }).limit(ap.optout_window);
  const optouts = (data ?? []).filter((m) => m.is_optout).length;
  if (optouts >= ap.optout_streak) {
    await pauseNumber(numberId, `${optouts} pedidos de saída nas últimas ${data?.length} respostas. Revise a abordagem antes de retomar.`);
  }
}

// ------------------------------------------------------------------
// Envio
// ------------------------------------------------------------------
interface QueueRow {
  id: string; user_id: string; campaign_id: string; lead_id: string; number_id: string;
  template_id: string | null; scheduled_at: string;
}

async function setQueue(id: string, patch: Record<string, unknown>) {
  await supabaseAdmin().from("message_queue").update({ locked_at: null, ...patch }).eq("id", id);
}

export async function processClaimed(q: QueueRow, settingsCache: Map<string, Settings>): Promise<string> {
  const admin = supabaseAdmin();
  let settings = settingsCache.get(q.user_id);
  if (!settings) {
    settings = await loadSettings(q.user_id);
    settingsCache.set(q.user_id, settings);
  }
  const cfg = settings.send_config;
  const [{ data: camp }, { data: lead }, { data: num }] = await Promise.all([
    admin.from("campaigns").select("*").eq("id", q.campaign_id).single(),
    admin.from("leads").select("*").eq("id", q.lead_id).maybeSingle(),
    admin.from("whatsapp_numbers").select("*").eq("id", q.number_id).single(),
  ]);

  // ---- revalidação antes de cada envio ----
  if (!camp || camp.status !== "running") { await setQueue(q.id, { status: "scheduled" }); return "campanha não está rodando"; }
  if (!num || num.paused || num.status !== "connected") { await setQueue(q.id, { status: "scheduled" }); return "número indisponível"; }
  const l = lead as Lead | null;
  if (!l || l.archived) { await setQueue(q.id, { status: "skipped", error: "Lead apagado ou arquivado." }); return "skip"; }
  if (BLOCKING_STATUS.includes(l.status)) { await setQueue(q.id, { status: "skipped", error: `Lead com status "${l.status}".` }); return "skip"; }
  if (!l.phone_e164 || l.phone_type !== "mobile") { await setQueue(q.id, { status: "skipped", error: "Sem celular válido." }); return "skip"; }
  const { data: blocked } = await admin.from("blocklist").select("id").eq("user_id", q.user_id).in("phone_e164", phoneVariants(l.phone_e164)).limit(1);
  if (blocked?.length) { await setQueue(q.id, { status: "skipped", error: "Número na lista de bloqueio." }); return "skip"; }
  const { count: inbound } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("lead_id", l.id).eq("direction", "in");
  if (inbound) { await setQueue(q.id, { status: "skipped", error: "Lead já respondeu." }); return "skip"; }

  const now = new Date();
  const rng = Math.random;
  const planState = (): NumberPlanState => ({
    id: num.id, warmupStart: num.warmup_start_date, replyRate: null, perDay: new Map(), cursor: now,
    sinceLongPause: 0, longPauseEvery: 9,
  });
  if (!isWithinWindow(now, cfg)) {
    const at = nextValidSlot(now, planState(), cfg, settings.warmup_config, rng);
    await setQueue(q.id, { status: "scheduled", scheduled_at: at.toISOString() });
    return "fora da janela, reagendado";
  }
  const { data: stats } = await admin.from("number_stats").select("sent_today").eq("number_id", num.id).single();
  const rr = await replyRate(num.id);
  const limit = dailyLimit(num.id, num.warmup_start_date, localDateKey(now, cfg.timezone), rr.contacted >= 20 ? rr.rate : null, settings.warmup_config);
  if ((stats?.sent_today ?? 0) >= limit) {
    const st = planState();
    st.perDay.set(localDateKey(now, cfg.timezone), Number.MAX_SAFE_INTEGER);
    const at = nextValidSlot(now, st, cfg, settings.warmup_config, rng);
    await setQueue(q.id, { status: "scheduled", scheduled_at: at.toISOString() });
    return "limite diário, reagendado";
  }

  const token = await getCredential(q.user_id, "uazapi_token", num.id);
  if (!token) { await pauseNumber(num.id, "Token da instância não encontrado. Cadastre o número de novo."); await setQueue(q.id, { status: "scheduled" }); return "sem token"; }

  // ---- mensagem ----
  const vars = leadVars(l, settings);
  const { data: tpl } = q.template_id
    ? await admin.from("campaign_templates").select("body").eq("id", q.template_id).maybeSingle()
    : { data: null };
  const fallbackTpl = tpl?.body ?? (await admin.from("campaign_templates").select("body").eq("campaign_id", q.campaign_id).limit(1).single()).data?.body;
  if (!fallbackTpl) { await setQueue(q.id, { status: "failed", error: "Campanha sem modelo de mensagem." }); return "sem modelo"; }
  const text = (camp.use_ai ? await generateOpener(vars, camp.ai_instructions, fallbackTpl) : null) ?? render(fallbackTpl, vars);

  // ---- envio (Uazapi mostra "digitando…" durante o delay) ----
  const provider = createProvider(num.server_url, token.secret);
  const res = await provider.sendText(l.phone_e164.replace(/\D/g, ""), text, typingMs(text, cfg));
  const sentAt = new Date().toISOString();

  if (res.ok) {
    await setQueue(q.id, { status: "sent", sent_at: sentAt, rendered_text: text, error: null });
    await admin.from("messages").insert({
      user_id: q.user_id, lead_id: l.id, number_id: num.id, campaign_id: q.campaign_id, queue_id: q.id,
      direction: "out", body: text, provider_message_id: res.providerMessageId ?? null, status: "sent", created_at: sentAt,
    });
    await admin.from("leads").update({
      status: ["new", "qualified"].includes(l.status) ? "contacted" : l.status,
      contact_mode: l.contact_mode ?? "campaign",
      last_message_at: sentAt,
      last_message_preview: text.slice(0, 140),
    }).eq("id", l.id);
    await admin.from("whatsapp_numbers").update({ consecutive_failures: 0, last_error: null }).eq("id", num.id);
    await checkReplyRate(num.id, settings);
    return "enviada";
  }

  await setQueue(q.id, { status: "failed", error: res.error ?? "Falha no envio", rendered_text: text });
  const failures = (num.consecutive_failures ?? 0) + 1;
  await admin.from("whatsapp_numbers").update({ consecutive_failures: failures, last_error: res.error }).eq("id", num.id);
  if (res.restricted) await pauseNumber(num.id, `O WhatsApp sinalizou restrição na conta: ${res.error}`);
  else if (res.fatal) await pauseNumber(num.id, `Instância inválida: ${res.error}`);
  else if (failures >= settings.autopause_config.max_consecutive_failures) {
    await pauseNumber(num.id, `${failures} falhas de envio seguidas. Última: ${res.error}`);
  }
  return "falhou";
}

export async function sendDue(budgetMs: number): Promise<number> {
  const started = Date.now();
  const admin = supabaseAdmin();
  const cache = new Map<string, Settings>();
  let processed = 0;
  // cada rodada pega no máx. 1 mensagem por número; com intervalos de 40s+
  // normalmente basta uma rodada por minuto
  for (let round = 0; round < 2 && Date.now() - started < budgetMs; round++) {
    const { data, error } = await admin.rpc("claim_due_messages");
    if (error) throw new Error("claim_due_messages: " + error.message);
    const claimed = (data ?? []) as QueueRow[];
    if (!claimed.length) break;
    const results = await Promise.allSettled(claimed.map((q) => processClaimed(q, cache)));
    results.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error("envio falhou", r.reason);
        void setQueue(claimed[i].id, { status: "failed", error: String(r.reason?.message ?? r.reason) });
      }
    });
    processed += claimed.length;
  }
  return processed;
}

export async function completeFinishedCampaigns() {
  const admin = supabaseAdmin();
  const { data: camps } = await admin.from("campaigns").select("id").eq("status", "running");
  for (const c of camps ?? []) {
    const { count } = await admin.from("message_queue").select("id", { count: "exact", head: true })
      .eq("campaign_id", c.id).in("status", ["scheduled", "sending"]);
    if (!count) await admin.from("campaigns").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", c.id);
  }
}

/** Atualiza status dos números que não recebem notícia há 10 min */
export async function refreshStaleNumbers() {
  const admin = supabaseAdmin();
  const stale = new Date(Date.now() - 10 * 60_000).toISOString();
  const { data: nums } = await admin.from("whatsapp_numbers").select("*")
    .neq("status", "disconnected").or(`last_status_at.is.null,last_status_at.lt.${stale}`).limit(20);
  for (const n of nums ?? []) {
    const token = await getCredential(n.user_id, "uazapi_token", n.id);
    if (!token) continue;
    try {
      const info = await createProvider(n.server_url, token.secret).status();
      await admin.from("whatsapp_numbers").update({
        status: info.status, qr_code: info.qrCode, phone: info.phone ?? n.phone,
        profile_name: info.profileName ?? n.profile_name, last_status_at: new Date().toISOString(),
      }).eq("id", n.id);
      if (info.status === "disconnected" && n.status === "connected") {
        await pauseNumber(n.id, `A instância desconectou${info.lastDisconnectReason ? ` (${info.lastDisconnectReason})` : ""}. Reconecte e retome.`);
      }
    } catch (e) {
      await admin.from("whatsapp_numbers").update({ last_status_at: new Date().toISOString(), last_error: (e as Error).message }).eq("id", n.id);
    }
  }
}
