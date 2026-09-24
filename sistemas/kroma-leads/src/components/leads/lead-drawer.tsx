"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  MapPin, Globe, Mail, Star, Archive, Eraser, MessageCircle, MessagesSquare, Save, Plus, X, Clock, ExternalLink, ArchiveRestore, Handshake,
} from "lucide-react";
import { Instagram } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, fmtDateTime } from "@/lib/client";
import { deleteLeads, mapsUrl, updateLeads, whatsappUrl } from "@/lib/lead-actions";
import { Badge, Button, Input, Label, Select, Textarea, cn } from "@/components/ui";
import { PhoneEdit, ScoreBar, StatusBadge, TypeBadge } from "./lead-bits";
import { STATUS_LABEL, type Lead, type LeadStatus, type Message } from "@/lib/types";

interface LeadEvent { id: string; type: string; from_status: string | null; to_status: string | null; detail: string | null; created_at: string }

export function LeadDrawerBody({ lead, onChange, onRemoved }: {
  lead: Lead; onChange: (l: Lead) => void; onRemoved: (id: string) => void;
}) {
  const sb = supabaseBrowser();
  const [notes, setNotes] = useState(lead.notes);
  const [tag, setTag] = useState("");
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contact, setContact] = useState({ email: lead.email ?? "", website: lead.website ?? "", instagram: lead.instagram ?? "" });
  const [savingContact, setSavingContact] = useState(false);

  useEffect(() => {
    setNotes(lead.notes);
    setContact({ email: lead.email ?? "", website: lead.website ?? "", instagram: lead.instagram ?? "" });
  }, [lead.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    (async () => {
      const [ev, ms] = await Promise.all([
        sb.from("lead_events").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false }).limit(50),
        sb.from("messages").select("*").eq("lead_id", lead.id).order("created_at").limit(200),
      ]);
      setEvents((ev.data ?? []) as LeadEvent[]);
      setMessages((ms.data ?? []) as Message[]);
    })();
  }, [lead.id, lead.status, sb]);

  async function patch(p: Partial<Lead>, msg?: string) {
    const r = await updateLeads([lead.id], p);
    if (r?.[0]) {
      onChange(r[0]);
      if (msg) toast.success(msg);
    }
  }

  async function saveContact() {
    setSavingContact(true);
    try {
      const { lead: l } = await api<{ lead: Lead }>(`/api/leads/${lead.id}`, contact, "PATCH");
      onChange(l);
      toast.success("Contato atualizado.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingContact(false);
    }
  }

  async function addTag() {
    const t = tag.trim();
    if (!t || lead.tags.includes(t)) return;
    await patch({ tags: [...lead.tags, t] });
    setTag("");
  }

  async function clearLead() {
    if (!confirm("Apagar esse lead e todo o histórico dele? Ele pode voltar se aparecer numa busca nova (a não ser que esteja na lista de bloqueio).")) return;
    if (await deleteLeads([lead.id])) {
      toast.success("Lead apagado.");
      onRemoved(lead.id);
    }
  }

  const wa = whatsappUrl(lead);
  const contactDirty = contact.email !== (lead.email ?? "") || contact.website !== (lead.website ?? "") || contact.instagram !== (lead.instagram ?? "");

  return (
    <div className="space-y-6 p-5">
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          <TypeBadge lead={lead} onChange={(q) => patch({ site_quality: q })} />
          {lead.archived && <Badge tone="neutral">Arquivado</Badge>}
        </div>
        <div className="text-sm text-muted">{lead.category ?? "Sem categoria"}{lead.city ? ` · ${lead.city}${lead.state ? `/${lead.state}` : ""}` : ""}</div>
        {lead.address && <div className="mt-1 flex items-start gap-1.5 text-xs text-faint"><MapPin className="mt-0.5 size-3 shrink-0" />{lead.address}</div>}
        <div className="mt-3 flex items-center gap-4">
          <ScoreBar score={lead.score} />
          {lead.rating ? <span className="text-xs text-muted">★ {String(lead.rating).replace(".", ",")} · {lead.reviews_count ?? 0} avaliações</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {messages.length > 0 ? (
          <Link href={`/conversas?lead=${lead.id}`}><Button size="sm" variant="primary" icon={<MessagesSquare className="size-3.5" />}>Abrir conversa</Button></Link>
        ) : wa ? (
          <a href={wa} target="_blank" rel="noreferrer"><Button size="sm" variant="primary" icon={<MessageCircle className="size-3.5" />}>WhatsApp</Button></a>
        ) : null}
        <Button size="sm" variant={lead.qualified ? "primary" : "secondary"} icon={<Star className={cn("size-3.5", lead.qualified && "fill-cyan text-cyan")} />}
          onClick={() => patch({ qualified: !lead.qualified }, lead.qualified ? "Removido dos qualificados." : "Lead qualificado.")}>
          {lead.qualified ? "Qualificado" : "Qualificar"}
        </Button>
        {!lead.contact_mode && (
          <Button size="sm" variant="secondary" icon={<Handshake className="size-3.5" />}
            onClick={() => patch({ contact_mode: "manual", status: ["new", "qualified"].includes(lead.status) ? "contacted" : lead.status }, "Marcado como em contato.")}>
            Em contato
          </Button>
        )}
        <Button size="sm" variant="secondary" icon={lead.archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
          onClick={() => patch({ archived: !lead.archived }, lead.archived ? "Lead desarquivado." : "Lead arquivado. Não volta em buscas novas.")}>
          {lead.archived ? "Desarquivar" : "Arquivar"}
        </Button>
        <Button size="sm" variant="danger" icon={<Eraser className="size-3.5" />} onClick={clearLead}>Apagar dados</Button>
      </div>

      <div>
        <Label>Status</Label>
        <Select className="w-full" value={lead.status} onChange={(e) => patch({ status: e.target.value as LeadStatus })}>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Contato</Label>
        <PhoneEdit lead={lead} onSaved={onChange} />
        <div className="grid gap-2">
          <div className="relative"><Mail className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" /><Input className="pl-9" placeholder="E-mail" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></div>
          <div className="relative"><Globe className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" /><Input className="pl-9" placeholder="Site" value={contact.website} onChange={(e) => setContact({ ...contact, website: e.target.value })} /></div>
          <div className="relative"><Instagram className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-faint" /><Input className="pl-9" placeholder="@instagram ou link" value={contact.instagram} onChange={(e) => setContact({ ...contact, instagram: e.target.value })} /></div>
        </div>
        {contactDirty && <Button size="sm" variant="primary" icon={<Save className="size-3.5" />} loading={savingContact} onClick={saveContact}>Salvar contato</Button>}
        <div className="flex flex-wrap gap-3 text-xs">
          {lead.website && <a className="inline-flex items-center gap-1 text-cyan hover:underline" href={lead.website} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Abrir site</a>}
          {lead.instagram && <a className="inline-flex items-center gap-1 text-cyan hover:underline" href={lead.instagram} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Abrir Instagram</a>}
          <a className="inline-flex items-center gap-1 text-cyan hover:underline" href={mapsUrl(lead)} target="_blank" rel="noreferrer"><ExternalLink className="size-3" /> Google Maps</a>
        </div>
      </div>

      <div>
        <Label>Tags</Label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {lead.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-md bg-white/6 px-2 py-0.5 text-xs text-ink">
              {t}<button onClick={() => patch({ tags: lead.tags.filter((x) => x !== t) })} className="text-faint hover:text-danger"><X className="size-3" /></button>
            </span>
          ))}
          {!lead.tags.length && <span className="text-xs text-faint">Nenhuma tag.</span>}
        </div>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="Nova tag" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()} />
          <Button size="md" variant="secondary" icon={<Plus className="size-4" />} onClick={addTag}>Adicionar</Button>
        </div>
      </div>

      <div>
        <Label>Notas</Label>
        <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: falei com a recepcionista, dono volta segunda…" />
        {notes !== lead.notes && <Button className="mt-2" size="sm" variant="primary" icon={<Save className="size-3.5" />} onClick={() => patch({ notes }, "Notas salvas.")}>Salvar notas</Button>}
      </div>

      {messages.length > 0 && (
        <div>
          <Label>Mensagens ({messages.length})</Label>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-line bg-bg/50 p-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.direction === "out" ? "ml-auto bg-cyan/10 text-ink" : "bg-card2 text-ink")}>
                <div className="whitespace-pre-wrap break-words">{m.body}</div>
                <div className="mt-1 text-right text-[10px] text-faint">{fmtDateTime(m.created_at)}{m.is_optout && " · pediu pra sair"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <Label>Linha do tempo</Label>
        <ol className="space-y-2 border-l border-line pl-4">
          {events.map((e) => (
            <li key={e.id} className="relative text-xs">
              <span className="absolute -left-[21px] top-1 size-2 rounded-full bg-line2" />
              <span className="text-ink">
                {e.type === "created" && `Lead criado${e.detail ? ` · ${e.detail}` : ""}`}
                {e.type === "status" && `${STATUS_LABEL[e.from_status as LeadStatus] ?? e.from_status} → ${STATUS_LABEL[e.to_status as LeadStatus] ?? e.to_status}`}
                {e.type === "archived" && "Arquivado"}
                {e.type === "unarchived" && "Desarquivado"}
              </span>
              <span className="ml-2 inline-flex items-center gap-1 text-faint"><Clock className="size-3" />{fmtDateTime(e.created_at)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[11px] text-faint">Origem: {lead.source_detail ?? lead.source}</p>
      </div>
    </div>
  );
}
