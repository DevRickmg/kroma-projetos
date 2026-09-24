"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, X, Plus, Tag, HeartPulse, PawPrint, Scissors, Car, Utensils, Bed, GraduationCap, ShoppingBag, Hammer, Wrench,
  Scale, Laptop, PartyPopper, Factory, Zap, Truck, Building2, Cog, Tractor, Hospital, Star, type LucideIcon,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizeText } from "@/lib/text";
import { Chip, cn } from "@/components/ui";
import type { Segment } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  "heart-pulse": HeartPulse, "paw-print": PawPrint, scissors: Scissors, car: Car, utensils: Utensils, bed: Bed,
  "graduation-cap": GraduationCap, "shopping-bag": ShoppingBag, hammer: Hammer, wrench: Wrench, scale: Scale, laptop: Laptop,
  "party-popper": PartyPopper, factory: Factory, zap: Zap, truck: Truck, building: Building2, cog: Cog, tractor: Tractor,
  hospital: Hospital, tag: Tag,
};

export function SegmentPicker({ segments, selected, onChange, onSegmentsChange }: {
  segments: Segment[]; selected: string[]; onChange: (s: string[]) => void; onSegmentsChange: () => void;
}) {
  const [q, setQ] = useState("");
  const nq = normalizeText(q);

  const groups = useMemo(() => {
    const map = new Map<string, { icon: string; items: Segment[] }>();
    const custom = segments.filter((s) => s.is_custom && s.section === "Meus segmentos");
    if (custom.length) map.set("Meus segmentos", { icon: "star", items: custom });
    for (const s of segments) {
      if (s.is_custom && s.section === "Meus segmentos") continue;
      if (!map.has(s.section)) map.set(s.section, { icon: s.icon, items: [] });
      map.get(s.section)!.items.push(s);
    }
    return [...map.entries()]
      .map(([section, g]) => ({
        section,
        icon: g.icon,
        items: nq ? g.items.filter((s) => normalizeText(s.name).includes(nq) || normalizeText(section).includes(nq)) : g.items,
      }))
      .filter((g) => g.items.length);
  }, [segments, nq]);

  const exact = segments.some((s) => normalizeText(s.name) === nq);
  const toggle = (name: string) => onChange(selected.includes(name) ? selected.filter((x) => x !== name) : [...selected, name]);

  async function addCustom() {
    const name = q.trim();
    if (!name) return;
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("segments").insert({ user_id: u.user!.id, name, section: "Meus segmentos", icon: "tag", is_custom: true, sort: 10000 });
    if (error) return toast.error(error.code === "23505" ? "Esse segmento já existe." : error.message);
    onSegmentsChange();
    onChange([...selected, name]);
    setQ("");
    toast.success(`"${name}" salvo em Meus segmentos.`);
  }
  async function removeCustom(s: Segment) {
    if (!confirm(`Remover "${s.name}" dos seus segmentos?`)) return;
    await supabaseBrowser().from("segments").delete().eq("id", s.id);
    onChange(selected.filter((x) => x !== s.name));
    onSegmentsChange();
  }

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && q.trim() && !exact) addCustom(); }}
          placeholder="Toque para escolher os nichos…"
          className="h-11 w-full rounded-lg border border-line bg-card2 pl-9 pr-9 text-sm text-ink placeholder:text-faint focus:border-cyan/50 focus:outline-none"
        />
        {q && <button onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint hover:text-ink"><X className="size-4" /></button>}
      </div>

      {selected.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-cyan/20 bg-cyan/[0.03] p-2">
          <span className="px-1 text-[11px] font-semibold uppercase tracking-wider text-cyan">{selected.length} escolhido{selected.length > 1 ? "s" : ""}</span>
          {selected.map((s) => (
            <button key={s} onClick={() => toggle(s)} className="inline-flex items-center gap-1 rounded-full bg-cyan/10 px-2.5 py-1 text-xs text-strong hover:bg-cyan/20">
              {s} <X className="size-3" />
            </button>
          ))}
          <button onClick={() => onChange([])} className="ml-auto px-2 text-xs text-muted hover:text-ink">Limpar</button>
        </div>
      )}

      {q.trim() && !exact && (
        <button onClick={addCustom} className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-cyan/40 px-3 py-1.5 text-xs text-cyan hover:bg-cyan/10">
          <Plus className="size-3.5" /> Adicionar &quot;{q.trim()}&quot; aos meus segmentos
        </button>
      )}

      <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
        {groups.map((g) => {
          const Icon = g.section === "Meus segmentos" ? Star : ICONS[g.icon] ?? Tag;
          return (
            <div key={g.section}>
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                <Icon className="size-3.5 text-cyan/80" /> {g.section}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.items.map((s) => (
                  <span key={s.id} className="group relative inline-flex">
                    <Chip active={selected.includes(s.name)} onClick={() => toggle(s.name)} className={cn(s.is_custom && "pr-7")}>
                      {s.name}
                    </Chip>
                    {s.is_custom && (
                      <button onClick={() => removeCustom(s)} title="Remover segmento" className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-danger">
                        <X className="size-3" />
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        {!groups.length && <p className="py-6 text-center text-sm text-muted">Nada encontrado. Aperte Enter pra salvar como segmento seu.</p>}
      </div>
    </div>
  );
}
