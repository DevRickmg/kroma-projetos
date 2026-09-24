"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  List, Star, MessageSquare, Archive, Upload, Download, Search, Phone, Globe, Ban, MessageCircle, MapPin, Handshake, Eraser,
  Send, Tag, X, ArchiveRestore, Users, Hand,
} from "lucide-react";
import { Instagram } from "@/components/icons";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadLeadsCsv } from "@/lib/client";
import { deleteLeads, mapsUrl, stashCampaignSelection, updateLeads, whatsappUrl } from "@/lib/lead-actions";
import { Button, Chip, Drawer, Empty, Input, Modal, PageHeader, Select, Spinner, Tip, cn } from "@/components/ui";
import { PhoneEdit, PresenceIcons, ScoreBar, StatusBadge, TypeBadge } from "@/components/leads/lead-bits";
import { LeadDrawerBody } from "@/components/leads/lead-drawer";
import { ImportModal } from "@/components/leads/import-modal";
import { STATUS_LABEL, type Lead } from "@/lib/types";

type Tab = "active" | "qualified" | "contact" | "archived";
type Presence = "phone" | "site" | "instagram" | "none";

const TABS: { v: Tab; label: string; icon: React.ReactNode; desc: string; empty: string }[] = [
  { v: "active", label: "Ativos", icon: <List className="size-3.5" />, desc: "Todos os leads que ainda não foram arquivados.", empty: "Nenhum lead ainda. Faça uma busca ou importe um CSV." },
  { v: "qualified", label: "Qualificados", icon: <Star className="size-3.5" />, desc: "Os leads mais promissores separados para prospecção focada.", empty: "Nenhum lead qualificado. Clique na estrela ao lado de um lead para qualificá-lo." },
  { v: "contact", label: "Em Contato", icon: <MessageSquare className="size-3.5" />, desc: "Leads com quem você já iniciou uma conversa.", empty: "Nenhum lead em contato nesta visão." },
  { v: "archived", label: "Arquivados", icon: <Archive className="size-3.5" />, desc: "Leads arquivados permanentemente.", empty: "Nenhum lead arquivado." },
];

const PAGE = 50;

interface Filters {
  tab: Tab; q: string; score: string; status: string; presence: Presence[]; city: string; category: string;
  contactMode: "" | "campaign" | "manual"; sort: "score" | "name" | "recent";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters(q: any, f: Filters) {
  if (f.tab === "archived") q = q.eq("archived", true);
  else q = q.eq("archived", false);
  if (f.tab === "qualified") q = q.eq("qualified", true);
  if (f.tab === "contact") {
    q = q.not("contact_mode", "is", null);
    if (f.contactMode) q = q.eq("contact_mode", f.contactMode);
  }
  const term = f.q.trim().replace(/[,()%*\\]/g, " ").trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const ors = [`name.ilike.%${term}%`, `category.ilike.%${term}%`, `city.ilike.%${term}%`];
    if (digits.length >= 4) ors.push(`phone_e164.ilike.%${digits}%`);
    q = q.or(ors.join(","));
  }
  if (f.score === "90") q = q.gte("score", 90);
  if (f.score === "70") q = q.gte("score", 70).lt("score", 90);
  if (f.score === "40") q = q.gte("score", 40).lt("score", 70);
  if (f.score === "0") q = q.lt("score", 40);
  if (f.status) q = q.eq("status", f.status);
  if (f.city) q = q.eq("city", f.city);
  if (f.category) q = q.eq("category", f.category);
  for (const p of f.presence) {
    if (p === "phone") q = q.not("phone_e164", "is", null);
    if (p === "site") q = q.not("website", "is", null);
    if (p === "instagram") q = q.not("instagram", "is", null);
    if (p === "none") q = q.is("website", null).is("instagram", null);
  }
  if (f.sort === "score") q = q.order("score", { ascending: false }).order("created_at", { ascending: false });
  if (f.sort === "name") q = q.order("name", { ascending: true });
  if (f.sort === "recent") q = q.order("created_at", { ascending: false });
  return q;
}

function LeadsInner() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = useState<Filters>({
    tab: (params.get("tab") as Tab) || "active", q: "", score: "", status: "", presence: [], city: "", category: "", contactMode: "", sort: "score",
  });
  const [qInput, setQInput] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [facets, setFacets] = useState<{ cities: string[]; categories: string[] }>({ cities: [], categories: [] });
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setF((cur) => ({ ...cur, q: qInput })), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count, error } = await applyFilters(sb.from("leads").select("*", { count: "exact" }), f).range(0, PAGE - 1);
    if (error) toast.error(error.message);
    setLeads((data ?? []) as Lead[]);
    setTotal(count ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [f, sb]);

  const loadCounts = useCallback(async () => {
    const { count } = await sb.from("leads").select("id", { count: "exact", head: true }).eq("archived", false);
    setActiveCount(count ?? 0);
    const { data } = await sb.rpc("lead_facets");
    const rows = (data ?? []) as { kind: string; value: string }[];
    setFacets({
      cities: rows.filter((r) => r.kind === "city").map((r) => r.value).sort((a, b) => a.localeCompare(b, "pt-BR")),
      categories: rows.filter((r) => r.kind === "category").map((r) => r.value).sort((a, b) => a.localeCompare(b, "pt-BR")),
    });
  }, [sb]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  async function loadMore() {
    setLoadingMore(true);
    const { data } = await applyFilters(sb.from("leads").select("*"), f).range(leads.length, leads.length + PAGE - 1);
    setLeads((cur) => [...cur, ...((data ?? []) as Lead[])]);
    setLoadingMore(false);
  }

  const replace = (l: Lead) => setLeads((cur) => cur.map((x) => (x.id === l.id ? l : x)));
  const removeLocal = (ids: string[]) => {
    setLeads((cur) => cur.filter((x) => !ids.includes(x.id)));
    setTotal((t) => Math.max(0, t - ids.length));
    setSelected(new Set());
    loadCounts();
  };
  // some da aba atual se não pertence mais a ela
  const belongs = (l: Lead) =>
    f.tab === "archived" ? l.archived : !l.archived && (f.tab !== "qualified" || l.qualified) && (f.tab !== "contact" || !!l.contact_mode);
  const applyUpdated = (ls: Lead[]) => {
    const gone = ls.filter((l) => !belongs(l)).map((l) => l.id);
    ls.filter(belongs).forEach(replace);
    if (gone.length) removeLocal(gone);
  };

  async function act(l: Lead, patch: Partial<Lead>, msg: string) {
    const r = await updateLeads([l.id], patch);
    if (r) { applyUpdated(r); toast.success(msg); loadCounts(); }
  }
  async function clearOne(l: Lead) {
    if (l.last_message_at && !confirm(`"${l.name}" tem histórico de conversa. Apagar mesmo assim?`)) return;
    if (await deleteLeads([l.id])) { removeLocal([l.id]); toast.success("Lead apagado. Pode voltar numa busca nova."); }
  }

  // ---- seleção / massa ----
  const ids = [...selected];
  const allVisible = leads.length > 0 && leads.every((l) => selected.has(l.id));
  async function selectAllFiltered() {
    setBusy(true);
    const all: string[] = [];
    for (let from = 0; from < 5000; from += 1000) {
      const { data } = await applyFilters(sb.from("leads").select("id"), f).range(from, from + 999);
      all.push(...(data ?? []).map((r: { id: string }) => r.id));
      if (!data || data.length < 1000) break;
    }
    setSelected(new Set(all));
    setBusy(false);
  }
  async function bulk(patch: Partial<Lead>, msg: string) {
    setBusy(true);
    let done = 0;
    for (let i = 0; i < ids.length; i += 300) {
      const r = await updateLeads(ids.slice(i, i + 300), patch);
      if (!r) break;
      done += r.length;
    }
    setBusy(false);
    toast.success(`${done} ${msg}`);
    load(); loadCounts();
  }
  async function bulkDelete() {
    if (!confirm(`Apagar ${ids.length} leads e o histórico deles? Eles podem voltar numa busca nova.`)) return;
    setBusy(true);
    for (let i = 0; i < ids.length; i += 300) await deleteLeads(ids.slice(i, i + 300));
    setBusy(false);
    toast.success(`${ids.length} leads apagados.`);
    load(); loadCounts();
  }
  async function bulkTag() {
    const t = tagName.trim();
    if (!t) return;
    setBusy(true);
    const { error } = await sb.rpc("add_tag_to_leads", { p_ids: ids, p_tag: t });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Tag "${t}" adicionada em ${ids.length} leads.`);
    setTagOpen(false); setTagName("");
    load();
  }
  async function fetchForExport(onlyIds?: string[]): Promise<Lead[]> {
    const out: Lead[] = [];
    if (onlyIds) {
      for (let i = 0; i < onlyIds.length; i += 300) {
        const { data } = await sb.from("leads").select("*").in("id", onlyIds.slice(i, i + 300));
        out.push(...((data ?? []) as Lead[]));
      }
      return out;
    }
    for (let from = 0; ; from += 1000) {
      const { data } = await applyFilters(sb.from("leads").select("*"), f).range(from, from + 999);
      out.push(...((data ?? []) as Lead[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async function exportCsv(onlyIds?: string[]) {
    setExporting(true);
    try {
      const rows = await fetchForExport(onlyIds);
      if (!rows.length) return toast.info("Nada pra exportar nessa visão.");
      downloadLeadsCsv(rows, `kroma-leads-${f.tab}-${new Date().toISOString().slice(0, 10)}.csv`);
    } finally {
      setExporting(false);
    }
  }
  function toCampaign() {
    stashCampaignSelection(ids);
    router.push("/campanhas/nova?from=selection");
  }

  const tab = TABS.find((t) => t.v === f.tab)!;
  const openLead = useMemo(() => leads.find((l) => l.id === openId) ?? null, [leads, openId]);
  const setTab = (t: Tab) => { setF({ ...f, tab: t, contactMode: "" }); router.replace(`/leads?tab=${t}`); };
  const togglePresence = (p: Presence) => setF({ ...f, presence: f.presence.includes(p) ? f.presence.filter((x) => x !== p) : [...f.presence, p] });
  const hasFilters = f.q || f.score || f.status || f.presence.length || f.city || f.category;

  return (
    <div>
      <PageHeader title="Leads">
        <Button variant="light" size="md" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>Importar</Button>
        <Button variant="secondary" size="md" icon={<Download className="size-4" />} loading={exporting} onClick={() => exportCsv()}>CSV</Button>
      </PageHeader>

      <div className="mb-4 inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-card p-1">
        {TABS.map((t) => (
          <button key={t.v} onClick={() => setTab(t.v)}
            className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition",
              f.tab === t.v ? "bg-hover font-medium text-strong" : "text-muted hover:text-ink")}>
            {t.icon} {t.label}
            {t.v === "active" && activeCount !== null && <span className="ml-1 rounded bg-white/8 px-1.5 text-[11px] text-muted">{activeCount.toLocaleString("pt-BR")}</span>}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 lg:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input className="pl-9" placeholder="Buscar por nome, categoria, telefone, cidade…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={f.score} onChange={(e) => setF({ ...f, score: e.target.value })}>
            <option value="">Todos os scores</option><option value="90">90+</option><option value="70">70–89</option><option value="40">40–69</option><option value="0">Abaixo de 40</option>
          </Select>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
          <Select value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className="sm:max-w-44">
            <option value="">Todas as cidades</option>
            {facets.cities.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className="sm:max-w-48">
            <option value="">Todas as categorias</option>
            {facets.categories.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">Presença:</span>
        <Chip active={f.presence.includes("phone")} onClick={() => togglePresence("phone")}><Phone className="size-3.5" /> Tem telefone</Chip>
        <Chip active={f.presence.includes("site")} onClick={() => togglePresence("site")}><Globe className="size-3.5" /> Tem site</Chip>
        <Chip active={f.presence.includes("instagram")} onClick={() => togglePresence("instagram")}><Instagram className="size-3.5" /> Tem Instagram</Chip>
        <Chip active={f.presence.includes("none")} onClick={() => togglePresence("none")}><Ban className="size-3.5" /> Sem nada</Chip>
        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button onClick={() => { setQInput(""); setF({ ...f, q: "", score: "", status: "", presence: [], city: "", category: "" }); }} className="text-xs text-muted hover:text-ink">Limpar filtros</button>
          )}
          <Select className="h-8 text-xs" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value as Filters["sort"] })}>
            <option value="score">Maior score</option><option value="name">Nome (A–Z)</option><option value="recent">Mais recentes</option>
          </Select>
        </div>
      </div>

      <p className="mb-3 text-sm text-muted">{tab.desc}</p>
      {f.tab === "contact" && (
        <div className="mb-3 flex gap-2">
          <Chip active={f.contactMode === ""} onClick={() => setF({ ...f, contactMode: "" })}>Todos</Chip>
          <Chip active={f.contactMode === "campaign"} onClick={() => setF({ ...f, contactMode: "campaign" })}><Send className="size-3.5" /> Por campanha</Chip>
          <Chip active={f.contactMode === "manual"} onClick={() => setF({ ...f, contactMode: "manual" })}><Hand className="size-3.5" /> Manual</Chip>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-14 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan/30 bg-[#0f1a1f]/95 p-2.5 backdrop-blur lg:top-2">
          <span className="px-2 text-sm font-medium text-strong">{selected.size} selecionado{selected.size > 1 ? "s" : ""}</span>
          {allVisible && total > leads.length && selected.size < total && (
            <button onClick={selectAllFiltered} className="text-xs text-cyan hover:underline">Selecionar todos os {total.toLocaleString("pt-BR")}</button>
          )}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="cta" icon={<Send className="size-3.5" />} onClick={toCampaign} disabled={busy}>Adicionar a uma campanha</Button>
            {f.tab !== "archived" && <Button size="sm" variant="secondary" icon={<Star className="size-3.5" />} onClick={() => bulk({ qualified: true }, "leads qualificados.")} disabled={busy}>Qualificar</Button>}
            <Button size="sm" variant="secondary" icon={<Tag className="size-3.5" />} onClick={() => setTagOpen(true)} disabled={busy}>Tag</Button>
            <Button size="sm" variant="secondary" icon={<Download className="size-3.5" />} onClick={() => exportCsv(ids)} loading={exporting}>CSV</Button>
            {f.tab === "archived"
              ? <Button size="sm" variant="secondary" icon={<ArchiveRestore className="size-3.5" />} onClick={() => bulk({ archived: false }, "leads desarquivados.")} disabled={busy}>Desarquivar</Button>
              : <Button size="sm" variant="secondary" icon={<Archive className="size-3.5" />} onClick={() => bulk({ archived: true }, "leads arquivados.")} disabled={busy}>Arquivar</Button>}
            <Button size="sm" variant="danger" icon={<Eraser className="size-3.5" />} onClick={bulkDelete} disabled={busy}>Limpar</Button>
            <button onClick={() => setSelected(new Set())} className="px-1 text-faint hover:text-ink" title="Limpar seleção"><X className="size-4" /></button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left">
            <thead>
              <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" className="size-4 accent-[#00e5ff]" checked={allVisible}
                    onChange={() => setSelected(allVisible ? new Set() : new Set(leads.map((l) => l.id)))} aria-label="Selecionar todos" />
                </th>
                <th className="px-3 py-3">Empresa</th>
                <th className="px-3 py-3">Tipo</th>
                <th className="px-3 py-3">Contato</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">Score
                    <Tip content={<div className="space-y-1">
                      <b className="block text-strong">Score de oportunidade</b>
                      <span className="block">Quanto maior, maior a chance de vender site/sistema.</span>
                      <span className="block">• 90–96: sem site e sem Instagram</span>
                      <span className="block">• ~75: só Instagram</span>
                      <span className="block">• 30–50: tem site (sem avaliar)</span>
                      <span className="block">• 80–100: você marcou &quot;Site ruim&quot;</span>
                      <span className="block">• 10–40: você marcou &quot;Site bom&quot;</span>
                      <span className="block">• +2 a +4: muitas avaliações e nota boa</span>
                      <span className="block">• −5: só telefone fixo</span>
                    </div>} />
                  </span>
                </th>
                <th className="px-3 py-3">
                  <span className="inline-flex items-center gap-1">Ações
                    <Tip width="w-80" content={<div className="space-y-1">
                      <span className="block"><b>WhatsApp</b>: abre a conversa (ou o histórico, se já existir)</span>
                      <span className="block"><b>Site</b>: abre o site do lead</span>
                      <span className="block"><b>Maps</b>: abre no Google Maps</span>
                      <span className="block"><b>Qualificar (★)</b>: marca como qualificado</span>
                      <span className="block"><b>Em contato</b>: marca que você já falou por fora</span>
                      <span className="block"><b>Limpar</b>: apaga o lead (volta se reprospectar)</span>
                      <span className="block"><b>Arquivar</b>: arquiva de vez (nunca volta em busca)</span>
                    </div>} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}><div className="flex justify-center py-16"><Spinner /></div></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={7}><Empty icon={<Users className="size-8" />} title={hasFilters ? "Nenhum lead com esses filtros." : tab.empty} /></td></tr>
              ) : leads.map((l) => (
                <tr key={l.id} className={cn("border-b border-line/70 align-top transition last:border-0 hover:bg-white/[0.015]", selected.has(l.id) && "bg-cyan/[0.03]")}>
                  <td className="px-4 py-4">
                    <input type="checkbox" className="size-4 accent-[#00e5ff]" checked={selected.has(l.id)}
                      onChange={() => { const s = new Set(selected); if (s.has(l.id)) s.delete(l.id); else s.add(l.id); setSelected(s); }} />
                  </td>
                  <td className="max-w-[300px] px-3 py-3.5">
                    <button onClick={() => setOpenId(l.id)} className="text-left text-[15px] font-semibold text-strong hover:text-cyan">{l.name}</button>
                    <div className="text-xs text-muted">{l.category ?? "—"}</div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                      <PresenceIcons lead={l} />
                      {l.city && <span className="truncate">{l.city}</span>}
                      {l.unread_count > 0 && <span className="rounded bg-cyan/15 px-1.5 text-[10px] font-semibold text-cyan">{l.unread_count} nova{l.unread_count > 1 ? "s" : ""}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-4"><TypeBadge lead={l} onChange={(q) => act(l, { site_quality: q }, "Tipo atualizado. Score recalculado.")} /></td>
                  <td className="px-3 py-4">
                    <PhoneEdit lead={l} onSaved={replace} />
                    {l.email && <div className="mt-1 truncate text-xs text-muted">{l.email}</div>}
                  </td>
                  <td className="px-3 py-4"><StatusBadge status={l.status} /></td>
                  <td className="px-3 py-4"><ScoreBar score={l.score} /></td>
                  <td className="px-3 py-3.5">
                    <RowActions lead={l}
                      onQualify={() => act(l, { qualified: !l.qualified }, l.qualified ? "Removido dos qualificados." : "Lead qualificado.")}
                      onContact={() => act(l, { contact_mode: l.contact_mode ?? "manual", status: ["new", "qualified"].includes(l.status) ? "contacted" : l.status }, "Marcado como em contato.")}
                      onClear={() => clearOne(l)}
                      onArchive={() => act(l, { archived: !l.archived }, l.archived ? "Lead desarquivado." : "Lead arquivado.")}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && leads.length < total && (
          <div className="flex items-center justify-center gap-3 border-t border-line p-3">
            <span className="text-xs text-muted">{leads.length} de {total.toLocaleString("pt-BR")}</span>
            <Button size="sm" variant="secondary" onClick={loadMore} loading={loadingMore}>Carregar mais</Button>
          </div>
        )}
      </div>

      <Drawer open={!!openLead} onClose={() => setOpenId(null)} title={openLead?.name}>
        {openLead && <LeadDrawerBody lead={openLead} onChange={(l) => { replace(l); loadCounts(); }} onRemoved={(id) => { setOpenId(null); removeLocal([id]); }} />}
      </Drawer>
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onDone={() => { load(); loadCounts(); }} />
      <Modal open={tagOpen} onClose={() => setTagOpen(false)} title={`Adicionar tag a ${selected.size} leads`}
        footer={<><Button variant="ghost" onClick={() => setTagOpen(false)}>Cancelar</Button><Button variant="primary" loading={busy} onClick={bulkTag}>Adicionar</Button></>}>
        <Input autoFocus placeholder="Ex.: prioridade, visitar, indicação…" value={tagName} onChange={(e) => setTagName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && bulkTag()} />
      </Modal>
    </div>
  );
}

function RowActions({ lead: l, onQualify, onContact, onClear, onArchive }: {
  lead: Lead; onQualify: () => void; onContact: () => void; onClear: () => void; onArchive: () => void;
}) {
  const btn = "rounded-md p-1.5 text-muted transition hover:bg-hover hover:text-ink";
  const wa = whatsappUrl(l);
  return (
    <div className="flex items-center gap-0.5">
      {l.last_message_at ? (
        <a href={`/conversas?lead=${l.id}`} className={btn} title="Abrir conversa"><MessageCircle className="size-4 text-cyan" /></a>
      ) : wa ? (
        <a href={wa} target="_blank" rel="noreferrer" className={btn} title="WhatsApp"><MessageCircle className="size-4" /></a>
      ) : <span className="p-1.5"><MessageCircle className="size-4 text-faint/30" /></span>}
      {l.website ? <a href={l.website} target="_blank" rel="noreferrer" className={btn} title="Site"><Globe className="size-4" /></a> : <span className="w-7" />}
      <a href={mapsUrl(l)} target="_blank" rel="noreferrer" className={btn} title="Google Maps"><MapPin className="size-4" /></a>
      <button onClick={onQualify} className={btn} title={l.qualified ? "Tirar dos qualificados" : "Qualificar"}>
        <Star className={cn("size-4", l.qualified && "fill-cyan text-cyan")} />
      </button>
      <button onClick={onContact} className={btn} title="Marcar em contato"><Handshake className={cn("size-4", l.contact_mode && "text-cyan")} /></button>
      <button onClick={onClear} className={btn} title="Limpar (apagar)"><Eraser className="size-4" /></button>
      <button onClick={onArchive} className={btn} title={l.archived ? "Desarquivar" : "Arquivar"}>
        {l.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
      </button>
    </div>
  );
}

export default function LeadsPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}><LeadsInner /></Suspense>;
}
