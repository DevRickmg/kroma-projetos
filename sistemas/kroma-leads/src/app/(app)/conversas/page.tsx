"use client";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, Send, ArrowLeft, MessagesSquare, Check, CheckCheck, Globe, MapPin, ExternalLink, Ban, Loader2 } from "lucide-react";
import { Instagram } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, fmtDateTime, timeAgo } from "@/lib/client";
import { formatPhone } from "@/lib/phone";
import { mapsUrl, updateLeads } from "@/lib/lead-actions";
import { Button, Empty, Input, Label, Spinner, Textarea, cn } from "@/components/ui";
import { ScoreBar, StatusBadge } from "@/components/leads/lead-bits";
import type { Lead, LeadStatus, Message, WhatsappNumber } from "@/lib/types";

const QUICK: { v: LeadStatus; label: string }[] = [
  { v: "replied", label: "Respondeu" },
  { v: "negotiating", label: "Negociando" },
  { v: "client", label: "Cliente" },
  { v: "not_interested", label: "Sem interesse" },
];

function ConversasInner() {
  const sb = supabaseBrowser();
  const params = useSearchParams();
  const [threads, setThreads] = useState<Lead[] | null>(null);
  const [q, setQ] = useState("");
  const [activeId, setActiveId] = useState<string | null>(params.get("lead"));
  const [active, setActive] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const { data } = await sb.from("leads").select("*").not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false }).limit(300);
    setThreads((data ?? []) as Lead[]);
  }, [sb]);

  const loadActive = useCallback(async (id: string) => {
    const [{ data: l }, { data: ms }] = await Promise.all([
      sb.from("leads").select("*").eq("id", id).maybeSingle(),
      sb.from("messages").select("*").eq("lead_id", id).order("created_at").limit(500),
    ]);
    setActive(l as Lead | null);
    setMessages((ms ?? []) as Message[]);
    if (l && (l as Lead).unread_count > 0) {
      await sb.from("leads").update({ unread_count: 0 }).eq("id", id);
      setThreads((cur) => cur?.map((t) => (t.id === id ? { ...t, unread_count: 0 } : t)) ?? cur);
    }
  }, [sb]);

  useEffect(() => {
    loadThreads();
    sb.from("whatsapp_numbers").select("*").then(({ data }: { data: WhatsappNumber[] | null }) => setNumbers(data ?? []));
  }, [loadThreads, sb]);

  useEffect(() => { if (activeId) loadActive(activeId); else { setActive(null); setMessages([]); } }, [activeId, loadActive]);

  // tempo real: mensagem nova entra no chat aberto e sobe a conversa na lista
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  useEffect(() => {
    const ch = sb.channel("inbox")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p: { new: Message }) => {
        const m = p.new;
        if (m.lead_id && m.lead_id === activeRef.current) {
          setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
          if (m.direction === "in") sb.from("leads").update({ unread_count: 0 }).eq("id", m.lead_id).then(() => undefined);
        }
        loadThreads();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, (p: { new: Message }) => {
        setMessages((cur) => cur.map((x) => (x.id === p.new.id ? p.new : x)));
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, loadThreads]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length, activeId]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (threads ?? []).filter((l) => !t || l.name.toLowerCase().includes(t) || (l.phone_e164 ?? "").includes(t.replace(/\D/g, "") || "§"));
  }, [threads, q]);

  const lastNumberId = [...messages].reverse().find((m) => m.number_id)?.number_id ?? null;
  const number = numbers.find((n) => n.id === lastNumberId) ?? numbers.find((n) => n.status === "connected") ?? null;

  async function send() {
    if (!active || !text.trim()) return;
    setSending(true);
    try {
      const { message } = await api<{ message: Message }>("/api/messages/send", { lead_id: active.id, number_id: number?.id, text });
      setMessages((cur) => (cur.some((x) => x.id === message.id) ? cur : [...cur, message]));
      setText("");
      loadThreads();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function setStatus(s: LeadStatus) {
    if (!active) return;
    const r = await updateLeads([active.id], { status: s });
    if (r?.[0]) { setActive(r[0]); setThreads((cur) => cur?.map((t) => (t.id === r[0].id ? r[0] : t)) ?? cur); toast.success("Status atualizado."); }
  }

  const blocked = active?.status === "do_not_disturb";

  return (
    <div className="-mx-4 -mb-16 -mt-5 flex h-[calc(100dvh-61px)] sm:-mx-6 lg:-mx-8 lg:-mt-7 lg:h-dvh">
      {/* lista */}
      <aside className={cn("flex w-full flex-col border-r border-line bg-[#0f1115] md:w-80 md:shrink-0", activeId && "hidden md:flex")}>
        <div className="border-b border-line p-4">
          <h1 className="mb-3 text-xl font-bold text-strong">Conversas</h1>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input className="h-9 pl-9" placeholder="Buscar conversa…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {threads === null ? <div className="flex justify-center py-10"><Spinner /></div>
            : shown.length === 0 ? <Empty icon={<MessagesSquare className="size-7" />} title="Nenhuma conversa ainda.">As respostas das campanhas aparecem aqui em tempo real.</Empty>
            : shown.map((l) => (
              <button key={l.id} onClick={() => setActiveId(l.id)}
                className={cn("flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-hover", activeId === l.id && "bg-cyan/[0.06]")}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card2 text-sm font-semibold text-ink">{l.name.slice(0, 1).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cn("truncate text-sm", l.unread_count > 0 ? "font-semibold text-strong" : "text-ink")}>{l.name}</span>
                    <span className="shrink-0 text-[10px] text-faint">{timeAgo(l.last_message_at)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("truncate text-xs", l.unread_count > 0 ? "text-ink" : "text-muted")}>{l.last_message_preview}</span>
                    {l.unread_count > 0 && <span className="ml-auto shrink-0 rounded-full bg-cyan px-1.5 text-[10px] font-bold text-bg">{l.unread_count}</span>}
                  </div>
                </div>
              </button>
            ))}
        </div>
      </aside>

      {/* chat */}
      <section className={cn("flex min-w-0 flex-1 flex-col", !activeId && "hidden md:flex")}>
        {!active ? (
          <div className="flex flex-1 items-center justify-center"><Empty icon={<MessagesSquare className="size-8" />} title="Escolha uma conversa." /></div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button onClick={() => setActiveId(null)} className="text-muted md:hidden"><ArrowLeft className="size-5" /></button>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-strong">{active.name}</div>
                <div className="text-xs text-muted">{active.phone_e164 ? formatPhone(active.phone_e164) : ""}{number ? ` · via ${number.label}` : ""}</div>
              </div>
              <StatusBadge status={active.status} />
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-bg px-4 py-4">
              {messages.map((m) => (
                <div key={m.id} className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                    m.direction === "out" ? "rounded-br-sm bg-cyan/[0.12] text-ink" : "rounded-bl-sm border border-line bg-card text-ink",
                    m.is_optout && "border-danger/40")}>
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-faint">
                      {m.campaign_id && m.direction === "out" && <span>campanha ·</span>}
                      {fmtDateTime(m.created_at)}
                      {m.direction === "out" && (m.status === "read" ? <CheckCheck className="size-3 text-cyan" /> : m.status === "delivered" ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
                    </div>
                    {m.is_optout && <div className="mt-1 text-[10px] text-danger">Pediu pra sair · bloqueado automaticamente</div>}
                  </div>
                </div>
              ))}
              <div ref={bottom} />
            </div>
            <div className="border-t border-line p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {QUICK.map((s) => (
                  <button key={s.v} onClick={() => setStatus(s.v)}
                    className={cn("rounded-full border px-2.5 py-1 text-xs", active.status === s.v ? "border-cyan/50 bg-cyan/10 text-strong" : "border-line2 text-muted hover:text-ink")}>
                    {s.label}
                  </button>
                ))}
              </div>
              {blocked ? (
                <p className="flex items-center gap-2 rounded-lg bg-danger/5 p-3 text-xs text-muted"><Ban className="size-4 text-danger" /> Esse contato pediu pra não ser chamado. Ele está na lista de bloqueio.</p>
              ) : (
                <div className="flex items-end gap-2">
                  <Textarea rows={2} className="min-h-[44px] resize-none" placeholder={number ? "Escreva uma resposta…" : "Nenhum número conectado"} value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
                  <Button variant="cta" onClick={send} disabled={!text.trim() || !number} className="h-11" icon={sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}>
                    <span className="hidden sm:inline">Enviar</span>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </section>

      {/* dados do lead */}
      {active && (
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-[#0f1115] p-4 xl:block">
          <Label>Lead</Label>
          <div className="font-semibold text-strong">{active.name}</div>
          <div className="text-xs text-muted">{active.category ?? ""}{active.city ? ` · ${active.city}` : ""}</div>
          <div className="mt-3"><ScoreBar score={active.score} /></div>
          <div className="mt-4 space-y-2 text-xs">
            {active.website && <a href={active.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-cyan hover:underline"><Globe className="size-3.5" /> Site</a>}
            {active.instagram && <a href={active.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-cyan hover:underline"><Instagram className="size-3.5" /> Instagram</a>}
            <a href={mapsUrl(active)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-cyan hover:underline"><MapPin className="size-3.5" /> Google Maps</a>
          </div>
          {active.notes && <><Label className="mt-5">Notas</Label><p className="whitespace-pre-wrap text-xs text-muted">{active.notes}</p></>}
          {active.tags.length > 0 && <><Label className="mt-5">Tags</Label><div className="flex flex-wrap gap-1">{active.tags.map((t) => <span key={t} className="rounded bg-white/6 px-1.5 py-0.5 text-[11px]">{t}</span>)}</div></>}
          <Link href={`/leads?tab=contact`} className="mt-6 inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><ExternalLink className="size-3" /> Ver em Leads</Link>
          <p className="mt-4 text-[10px] text-faint">Capturado: {fmtDateTime(active.created_at)}</p>
        </aside>
      )}
    </div>
  );
}

export default function ConversasPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}><ConversasInner /></Suspense>;
}
