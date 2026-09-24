"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Ban, Plus, Trash2, Tags, Database, Download, AlertOctagon, Pencil, Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { downloadLeadsCsv } from "@/lib/client";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { formatBytes } from "@/lib/text";
import { Button, Card, Empty, Input, Label, Modal, Select, Textarea } from "@/components/ui";
import type { Lead, Segment } from "@/lib/types";

// ------------------------------------------------------------------
export function BlocklistCard({ ddi, keywords, onKeywords }: { ddi: string; keywords: string[]; onKeywords: (k: string[]) => void }) {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<{ id: string; phone_e164: string; reason: string; created_at: string }[]>([]);
  const [phone, setPhone] = useState("");
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const { data } = await sb.from("blocklist").select("*").order("created_at", { ascending: false }).limit(2000);
    setRows(data ?? []);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    const p = normalizePhone(phone, ddi);
    if (!p) return toast.error("Telefone inválido.");
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("blocklist").insert({ user_id: u.user!.id, phone_e164: p.e164, reason: "Adicionado manualmente" });
    if (error) return toast.error(error.code === "23505" ? "Esse número já está bloqueado." : error.message);
    setPhone("");
    load();
  }
  async function remove(id: string) {
    if (!confirm("Tirar esse número da lista de bloqueio? Ele volta a poder receber campanhas.")) return;
    await sb.from("blocklist").delete().eq("id", id);
    load();
  }
  const shown = rows.filter((r) => !filter || r.phone_e164.includes(filter.replace(/\D/g, "")) || r.reason.toLowerCase().includes(filter.toLowerCase()));

  return (
    <Card title="Lista de bloqueio" icon={<Ban className="size-4" />}>
      <p className="mb-4 text-sm text-muted">
        Quem pede pra sair entra aqui sozinho e nunca mais recebe mensagem de campanha. Vale pra sempre, mesmo se o lead for apagado.
      </p>
      <div className="mb-3 flex gap-2">
        <Input placeholder="Adicionar número, ex.: (11) 99999-8888" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={add}>Bloquear</Button>
      </div>
      {rows.length > 8 && <Input className="mb-2 h-9" placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      <div className="max-h-72 overflow-y-auto rounded-xl border border-line">
        {shown.length === 0 ? (
          <Empty title="Nenhum número bloqueado." />
        ) : shown.map((r) => (
          <div key={r.id} className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-0">
            <span className="w-40 shrink-0 font-mono text-ink">{formatPhone(r.phone_e164)}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted" title={r.reason}>{r.reason}</span>
            <button onClick={() => remove(r.id)} className="text-faint hover:text-danger" title="Remover"><Trash2 className="size-4" /></button>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <Label>Palavras-chave de saída</Label>
        <Textarea rows={3} value={keywords.join(", ")} onChange={(e) => onKeywords(e.target.value.split(",").map((k) => k.trim()).filter(Boolean))} />
        <p className="mt-1 text-xs text-faint">
          Separadas por vírgula. Não diferencia acento nem maiúscula, e só casa palavra inteira (&quot;pare&quot; não pega &quot;parece&quot;). Salve no botão lá embaixo.
        </p>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
export function SegmentsCard() {
  const sb = supabaseBrowser();
  const [segs, setSegs] = useState<Segment[]>([]);
  const [name, setName] = useState("");
  const [section, setSection] = useState("Meus segmentos");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from("segments").select("*").order("sort");
    setSegs((data ?? []) as Segment[]);
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  const sections = useMemo(() => ["Meus segmentos", ...new Set(segs.filter((s) => !s.is_custom).map((s) => s.section))], [segs]);
  const custom = segs.filter((s) => s.is_custom);

  async function add() {
    const n = name.trim();
    if (!n) return;
    const { data: u } = await sb.auth.getUser();
    const { error } = await sb.from("segments").insert({ user_id: u.user!.id, name: n, section, icon: "tag", is_custom: true, sort: 10000 + custom.length });
    if (error) return toast.error(error.code === "23505" ? "Esse segmento já existe." : error.message);
    setName("");
    load();
  }
  async function rename() {
    if (!editing?.name.trim()) return;
    const { error } = await sb.from("segments").update({ name: editing.name.trim() }).eq("id", editing.id);
    if (error) return toast.error(error.code === "23505" ? "Já existe um segmento com esse nome." : error.message);
    setEditing(null);
    load();
  }
  async function move(id: string, sec: string) {
    await sb.from("segments").update({ section: sec }).eq("id", id);
    load();
  }
  async function remove(id: string) {
    await sb.from("segments").delete().eq("id", id);
    load();
  }

  return (
    <Card title="Segmentos personalizados" icon={<Tags className="size-4" />}>
      <p className="mb-4 text-sm text-muted">Nichos que não estão na lista padrão. Aparecem na busca, na seção que você escolher.</p>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input placeholder="Ex.: Clínica de harmonização facial" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-56">
          {sections.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={add}>Adicionar</Button>
      </div>
      <div className="rounded-xl border border-line">
        {custom.length === 0 ? <Empty title="Nenhum segmento personalizado ainda." /> : custom.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2 text-sm last:border-0">
            {editing?.id === s.id ? (
              <>
                <Input className="h-8 flex-1" value={editing.name} autoFocus onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && rename()} />
                <button onClick={rename} className="text-cyan"><Check className="size-4" /></button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate text-ink">{s.name}</span>
                <Select className="h-8 w-48 text-xs" value={s.section} onChange={(e) => move(s.id, e.target.value)}>
                  {sections.map((x) => <option key={x}>{x}</option>)}
                </Select>
                <button onClick={() => setEditing({ id: s.id, name: s.name })} className="text-faint hover:text-ink" title="Renomear"><Pencil className="size-4" /></button>
                <button onClick={() => remove(s.id)} className="text-faint hover:text-danger" title="Remover"><Trash2 className="size-4" /></button>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
export async function fetchAllLeads(): Promise<Lead[]> {
  const sb = supabaseBrowser();
  const out: Lead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("leads").select("*").order("created_at").range(from, from + 999);
    if (error) throw error;
    out.push(...((data ?? []) as Lead[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function DataCard() {
  const sb = supabaseBrowser();
  const [total, setTotal] = useState<number | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [wiping, setWiping] = useState(false);

  const load = useCallback(async () => {
    const [{ count }, { data }] = await Promise.all([
      sb.from("leads").select("id", { count: "exact", head: true }),
      sb.rpc("user_storage_bytes"),
    ]);
    setTotal(count ?? 0);
    setBytes(Number(data ?? 0));
  }, [sb]);
  useEffect(() => { load(); }, [load]);

  async function exportAll() {
    setExporting(true);
    try {
      const leads = await fetchAllLeads();
      downloadLeadsCsv(leads, `kroma-leads-todos-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function wipe() {
    setWiping(true);
    const { error } = await sb.rpc("wipe_user_data");
    setWiping(false);
    if (error) return toast.error(error.message);
    toast.success("Dados apagados.");
    setWipeOpen(false);
    setConfirmText("");
    load();
  }

  return (
    <Card title="Dados" icon={<Database className="size-4" />}>
      <div className="mb-4 space-y-1 text-sm">
        <div className="text-muted">Total de leads: <b className="text-strong">{total?.toLocaleString("pt-BR") ?? "…"}</b></div>
        <div className="text-muted">Armazenamento usado: <b className="text-strong">{bytes === null ? "…" : formatBytes(bytes)}</b></div>
      </div>
      <Button variant="secondary" icon={<Download className="size-4" />} onClick={exportAll} loading={exporting}>Exportar todos os leads (CSV)</Button>
      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-3 text-sm text-muted">
          Apagar todos os dados permanentemente: leads, conversas, campanhas e buscas. Configurações, números e a lista de bloqueio continuam
          (a lista de bloqueio precisa continuar valendo). Não dá pra desfazer.
        </p>
        <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={() => setWipeOpen(true)}>Apagar todos os dados</Button>
      </div>
      <Modal open={wipeOpen} onClose={() => setWipeOpen(false)} title="Apagar todos os dados?"
        footer={<>
          <Button variant="ghost" onClick={() => setWipeOpen(false)}>Cancelar</Button>
          <Button variant="danger" disabled={confirmText !== "APAGAR"} loading={wiping} onClick={wipe}>Apagar tudo</Button>
        </>}>
        <div className="mb-3 flex items-start gap-2 text-sm text-ink">
          <AlertOctagon className="mt-0.5 size-4 shrink-0 text-danger" />
          Isso apaga {total?.toLocaleString("pt-BR")} leads e todo o histórico de mensagens e campanhas. Exporte o CSV antes se quiser guardar.
        </div>
        <Label>Digite APAGAR pra confirmar</Label>
        <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus />
      </Modal>
    </Card>
  );
}
