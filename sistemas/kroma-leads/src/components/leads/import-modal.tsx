"use client";
import { useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client";
import { normalizeText } from "@/lib/text";
import { Button, Label, Modal, Select } from "@/components/ui";

const FIELDS = [
  { key: "name", label: "Nome da empresa", guess: ["nome", "empresa", "name", "razao social", "nome fantasia", "company"] },
  { key: "phone", label: "Telefone", guess: ["telefone", "phone", "celular", "whatsapp", "fone", "tel", "contato"] },
  { key: "website", label: "Site", guess: ["site", "website", "url", "web"] },
  { key: "instagram", label: "Instagram", guess: ["instagram", "insta", "ig"] },
  { key: "category", label: "Categoria", guess: ["categoria", "category", "segmento", "nicho", "ramo"] },
  { key: "city", label: "Cidade", guess: ["cidade", "city", "municipio"] },
  { key: "email", label: "E-mail", guess: ["email", "e mail", "mail"] },
] as const;

type Key = (typeof FIELDS)[number]["key"];

interface Report { imported: number; duplicates: number; invalid: number; errors: string[] }

export function ImportModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Partial<Record<Key, string>>>({});
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  function reset() {
    setFile(null); setHeaders([]); setRows([]); setMap({}); setReport(null);
  }

  function onFile(f: File) {
    reset();
    setFile(f);
    Papa.parse<Record<string, string>>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        if (!hs.length) return toast.error("Não achei cabeçalho nesse CSV.");
        setHeaders(hs);
        setRows(res.data);
        const guess: Partial<Record<Key, string>> = {};
        for (const f of FIELDS) {
          const h = hs.find((x) => f.guess.includes(normalizeText(x) as never)) ?? hs.find((x) => f.guess.some((g) => normalizeText(x).includes(g)));
          if (h) guess[f.key] = h;
        }
        setMap(guess);
      },
      error: () => toast.error("Não consegui ler o arquivo."),
    });
  }

  async function submit() {
    if (!map.name) return toast.error("Diga qual coluna tem o nome da empresa.");
    setLoading(true);
    try {
      const mapped = rows.map((r) => Object.fromEntries(FIELDS.map((f) => [f.key, map[f.key] ? (r[map[f.key]!] ?? "").toString() : ""])));
      const rep = await api<Report>("/api/leads/import", { rows: mapped, filename: file?.name });
      setReport(rep);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Importar leads (CSV)" wide
      footer={report ? <Button variant="primary" onClick={() => { reset(); onClose(); }}>Fechar</Button> : (
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancelar</Button>
          <Button variant="cta" icon={<Upload className="size-4" />} disabled={!rows.length} loading={loading} onClick={submit}>
            Importar {rows.length ? rows.length.toLocaleString("pt-BR") : ""} linhas
          </Button>
        </>
      )}>
      {report ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-strong"><CheckCircle2 className="size-5 text-cyan" /> Importação concluída</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[["Importados", report.imported], ["Duplicados", report.duplicates], ["Inválidos", report.invalid]].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-card2 p-3"><div className="text-xl font-semibold text-strong">{v}</div><div className="text-[11px] uppercase tracking-wider text-muted">{l}</div></div>
            ))}
          </div>
          {report.errors.length > 0 && (
            <ul className="max-h-40 overflow-y-auto rounded-lg border border-line p-3 text-xs text-muted">
              {report.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      ) : !file ? (
        <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-line2 px-6 py-12 text-center hover:border-cyan/40 hover:bg-cyan/[0.02]">
          <FileSpreadsheet className="size-8 text-cyan" />
          <span className="text-sm text-ink">Escolha um arquivo .csv</span>
          <span className="text-xs text-muted">Colunas aceitas: nome, telefone, site, instagram, categoria, cidade, e-mail. Separador vírgula ou ponto e vírgula.</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
      ) : (
        <div className="space-y-5">
          <div className="text-sm text-muted">{file.name} · {rows.length.toLocaleString("pt-BR")} linhas</div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <Label>{f.label}{f.key === "name" && " *"}</Label>
                <Select className="w-full" value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value || undefined })}>
                  <option value="">(não importar)</option>
                  {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </div>
            ))}
          </div>
          <div>
            <Label>Pré-visualização</Label>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="bg-card2 text-left text-muted">
                  <tr>{FIELDS.filter((f) => map[f.key]).map((f) => <th key={f.key} className="px-3 py-2 font-medium">{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      {FIELDS.filter((f) => map[f.key]).map((f) => <td key={f.key} className="max-w-[200px] truncate px-3 py-2 text-ink">{r[map[f.key]!]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-faint">Telefones são normalizados com o DDI das Configurações. Duplicados (mesmo telefone já na base, inclusive arquivados) são ignorados.</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
