"use client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, Pencil, Globe, MessageCircle, Check, X, ChevronDown } from "lucide-react";
import { Instagram } from "@/components/icons";
import { api } from "@/lib/client";
import { formatPhone } from "@/lib/phone";
import { Badge, cn } from "@/components/ui";
import { STATUS_LABEL, type Lead, type LeadStatus } from "@/lib/types";

export const STATUS_TONE: Record<LeadStatus, "neutral" | "cyan" | "violet" | "danger" | "strong"> = {
  new: "neutral",
  qualified: "violet",
  contacted: "strong",
  replied: "cyan",
  negotiating: "cyan",
  client: "cyan",
  not_interested: "neutral",
  do_not_disturb: "danger",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function PresenceIcons({ lead }: { lead: Lead }) {
  const on = "text-cyan";
  const off = "text-faint/50";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Globe className={cn("size-3.5", lead.website ? on : off)} aria-label={lead.website ? "Tem site" : "Sem site"} />
      <Instagram className={cn("size-3.5", lead.instagram ? on : off)} aria-label={lead.instagram ? "Tem Instagram" : "Sem Instagram"} />
      <MessageCircle className={cn("size-3.5", lead.phone_type === "mobile" ? on : off)} aria-label={lead.phone_type === "mobile" ? "Celular (possível WhatsApp)" : "Sem celular"} />
    </span>
  );
}

export function TypeBadge({ lead, onChange }: { lead: Lead; onChange: (q: Lead["site_quality"]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  if (lead.presence === "none") return <Badge>Sem presença</Badge>;
  if (lead.presence === "instagram") return <Badge tone="violet">Só Instagram</Badge>;
  const label = lead.site_quality === "bad" ? "Site ruim" : lead.site_quality === "good" ? "Site bom" : "Tem site";
  const tone = lead.site_quality === "bad" ? "cyan" : lead.site_quality === "good" ? "neutral" : "strong";
  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(!open)} title="Avaliar o site">
        <Badge tone={tone} className="cursor-pointer hover:brightness-125">{label} <ChevronDown className="size-3" /></Badge>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-40 overflow-hidden rounded-lg border border-line2 bg-[#12151a] shadow-xl">
          {([["unknown", "Tem site (sem avaliar)"], ["bad", "Site ruim"], ["good", "Site bom"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => { onChange(v); setOpen(false); }}
              className={cn("flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-hover", lead.site_quality === v ? "text-cyan" : "text-ink")}>
              {l} {lead.site_quality === v && <Check className="size-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ScoreBar({ score }: { score: number }) {
  const hi = score >= 80;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/8">
        <div className={cn("h-full rounded-full", hi ? "bg-cyan" : score >= 50 ? "bg-white/50" : "bg-white/25")} style={{ width: `${score}%` }} />
      </div>
      <span className={cn("w-7 text-sm tabular-nums", hi ? "font-semibold text-cyan" : "text-muted")}>{score}</span>
    </div>
  );
}

/** Telefone com lápis pra editar na linha. A normalização acontece no servidor. */
export function PhoneEdit({ lead, onSaved }: { lead: Lead; onSaved: (l: Lead) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      const { lead: l } = await api<{ lead: Lead }>(`/api/leads/${lead.id}`, { phone: value }, "PATCH");
      onSaved(l);
      setEditing(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} disabled={saving}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          className="h-7 w-36 rounded border border-cyan/40 bg-card2 px-2 text-xs text-ink focus:outline-none" placeholder="(11) 99999-8888" />
        <button onClick={save} className="text-cyan"><Check className="size-3.5" /></button>
        <button onClick={() => setEditing(false)} className="text-faint"><X className="size-3.5" /></button>
      </span>
    );
  }
  return (
    <span className="group inline-flex items-center gap-1.5 text-sm">
      <Phone className={cn("size-3.5", lead.phone_type === "mobile" ? "text-cyan" : "text-faint")} />
      <span className={lead.phone_e164 ? "text-ink" : "text-faint"}>{lead.phone_e164 ? formatPhone(lead.phone_e164) : "—"}</span>
      {lead.phone_type === "fixed" && <span className="text-[10px] uppercase text-faint">fixo</span>}
      <button onClick={() => { setValue(lead.phone_e164 ? formatPhone(lead.phone_e164) : lead.phone_raw ?? ""); setEditing(true); }}
        className="text-faint opacity-60 hover:text-ink group-hover:opacity-100" title="Editar telefone">
        <Pencil className="size-3" />
      </button>
    </span>
  );
}
