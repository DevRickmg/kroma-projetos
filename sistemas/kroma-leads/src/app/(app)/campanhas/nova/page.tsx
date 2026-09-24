"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Users, Smartphone, MessageSquareText, Rocket, Plus, Trash2, Wand2, Eye, AlertTriangle, XCircle, Sparkles, UserRound, DoorOpen, ArrowLeft, ArrowRight, Check,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/client";
import { useAppConfig, useSettings } from "@/lib/hooks";
import { readCampaignSelection } from "@/lib/lead-actions";
import { EXIT_SNIPPET, IDENTITY_SNIPPET, VARIABLES, validateTemplate } from "@/lib/template";
import { dailyLimit } from "@/lib/sender/schedule";
import { localDateKey } from "@/lib/time";
import { Badge, Button, Callout, Card, Chip, Input, Label, PageHeader, Select, Spinner, Textarea, Toggle, cn } from "@/components/ui";
import { DEFAULT_TEMPLATES } from "@/components/campaigns/status";
import type { WhatsappNumber } from "@/lib/types";

type Source = "selection" | "qualified" | "filter";
interface Eligible { eligible: number; total: number; reasons: Record<string, number> }

const STEPS = [
  { n: 1, label: "Leads", icon: Users },
  { n: 2, label: "Números", icon: Smartphone },
  { n: 3, label: "Mensagens", icon: MessageSquareText },
  { n: 4, label: "Revisão", icon: Rocket },
];

function NovaInner() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const params = useSearchParams();
  const { settings } = useSettings();
  const { config } = useAppConfig();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(`Prospecção ${new Date().toLocaleDateString("pt-BR")}`);

  // 1. leads
  const [stashed] = useState<string[]>(() => (params.get("from") === "selection" ? readCampaignSelection() : []));
  const [source, setSource] = useState<Source>(stashed.length ? "selection" : "qualified");
  const [minScore, setMinScore] = useState(70);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [facets, setFacets] = useState<{ cities: string[]; categories: string[] }>({ cities: [], categories: [] });
  const [leadIds, setLeadIds] = useState<string[]>([]);
  const [elig, setElig] = useState<Eligible | null>(null);
  const [resolving, setResolving] = useState(false);

  // 2. números
  const [numbers, setNumbers] = useState<WhatsappNumber[]>([]);
  const [numberIds, setNumberIds] = useState<string[]>([]);

  // 3. mensagens
  const [templates, setTemplates] = useState<string[]>([""]);
  const [useAi, setUseAi] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [preview, setPreview] = useState<{ lead: string; text: string; ai: boolean }[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [starting, setStarting] = useState(false);
  const focused = useRef<{ i: number; el: HTMLTextAreaElement | null }>({ i: 0, el: null });

  useEffect(() => {
    sb.rpc("lead_facets").then(({ data }: { data: { kind: string; value: string }[] | null }) => {
      const rows = data ?? [];
      setFacets({
        cities: rows.filter((r) => r.kind === "city").map((r) => r.value).sort(),
        categories: rows.filter((r) => r.kind === "category").map((r) => r.value).sort(),
      });
    });
    sb.from("whatsapp_numbers").select("*").order("created_at").then(({ data }: { data: WhatsappNumber[] | null }) => {
      const ns = data ?? [];
      setNumbers(ns);
      setNumberIds(ns.filter((n) => !n.paused && n.status === "connected").map((n) => n.id));
    });
  }, [sb]);

  const resolveLeads = useCallback(async () => {
    setResolving(true);
    try {
      let ids: string[] = [];
      if (source === "selection") ids = stashed;
      else {
        for (let from = 0; from < 5000; from += 1000) {
          let q = sb.from("leads").select("id").eq("archived", false).eq("phone_type", "mobile");
          if (source === "qualified") q = q.eq("qualified", true);
          else {
            q = q.gte("score", minScore);
            if (city) q = q.eq("city", city);
            if (category) q = q.eq("category", category);
          }
          const { data } = await q.order("score", { ascending: false }).range(from, from + 999);
          ids.push(...(data ?? []).map((r: { id: string }) => r.id));
          if (!data || data.length < 1000) break;
        }
      }
      setLeadIds(ids);
      setElig(ids.length ? await api<Eligible>("/api/campaigns/eligible", { lead_ids: ids }) : { eligible: 0, total: 0, reasons: {} });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResolving(false);
    }
  }, [source, stashed, minScore, city, category, sb]);

  useEffect(() => { resolveLeads(); }, [resolveLeads]);

  const me = { my_name: settings?.my_name ?? "", my_company: settings?.my_company ?? "" };
  const issues = useMemo(() => templates.map((t) => (t.trim() ? validateTemplate(t, me) : [])), [templates, me.my_name, me.my_company]); // eslint-disable-line react-hooks/exhaustive-deps
  const filled = templates.filter((t) => t.trim());
  const hasErrors = issues.some((list) => list.some((i) => i.level === "error"));

  function insertAtCursor(text: string) {
    const { i, el } = focused.current;
    const cur = templates[i] ?? "";
    let next: string;
    if (el && document.activeElement === el) {
      const s = el.selectionStart ?? cur.length;
      const e = el.selectionEnd ?? cur.length;
      next = cur.slice(0, s) + text + cur.slice(e);
      requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + text.length, s + text.length); });
    } else next = cur + text;
    setTemplates(templates.map((t, j) => (j === i ? next : t)));
  }

  async function runPreview() {
    setPreviewing(true);
    try {
      const r = await api<{ examples: { lead: string; text: string; ai: boolean }[] }>("/api/campaigns/preview", {
        templates: filled, lead_ids: leadIds.slice(0, 50), use_ai: useAi, ai_instructions: aiInstructions,
      });
      setPreview(r.examples);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPreviewing(false);
    }
  }

  async function start() {
    setStarting(true);
    const { data: u } = await sb.auth.getUser();
    const { data: camp, error } = await sb.from("campaigns").insert({
      user_id: u.user!.id, name: name.trim() || "Campanha", number_ids: numberIds, use_ai: useAi, ai_instructions: aiInstructions,
    }).select("id").single();
    if (error || !camp) { setStarting(false); return toast.error(error?.message ?? "Falha ao criar campanha."); }
    const { error: tErr } = await sb.from("campaign_templates").insert(filled.map((body, position) => ({ user_id: u.user!.id, campaign_id: camp.id, body, position })));
    if (tErr) {
      await sb.from("campaigns").delete().eq("id", camp.id);
      setStarting(false);
      return toast.error(tErr.message);
    }
    try {
      const r = await api<{ queued: number; skipped: number }>(`/api/campaigns/${camp.id}/start`, { lead_ids: leadIds });
      toast.success(`Campanha iniciada: ${r.queued} mensagens agendadas.`);
      router.push(`/campanhas/${camp.id}`);
    } catch (e) {
      await sb.from("campaigns").delete().eq("id", camp.id);
      toast.error((e as Error).message);
      setStarting(false);
    }
  }

  // estimativa de duração pela soma dos limites diários dos números
  const perDay = useMemo(() => {
    if (!settings) return 0;
    const today = localDateKey(new Date(), "America/Sao_Paulo");
    return numbers.filter((n) => numberIds.includes(n.id)).reduce((acc, n) => acc + dailyLimit(n.id, n.warmup_start_date, today, null, settings.warmup_config), 0);
  }, [numbers, numberIds, settings]);

  const canNext = step === 1 ? (elig?.eligible ?? 0) > 0 : step === 2 ? numberIds.length > 0 : step === 3 ? filled.length >= 5 && !hasErrors : true;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Nova campanha" />
      <div className="mb-6 grid grid-cols-4 gap-2">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.n} onClick={() => s.n < step && setStep(s.n)}
              className={cn("flex items-center justify-center gap-2 rounded-lg border px-2 py-2.5 text-xs sm:text-sm",
                step === s.n ? "border-cyan/50 bg-cyan/[0.06] text-strong" : s.n < step ? "border-line text-ink hover:bg-hover" : "border-line text-faint")}>
              {s.n < step ? <Check className="size-4 text-cyan" /> : <Icon className="size-4" />}<span className="hidden sm:inline">{s.label}</span>
            </button>
          );
        })}
      </div>

      {step === 1 && (
        <Card title="Quem vai receber" icon={<Users className="size-4" />}>
          <Label>Nome da campanha</Label>
          <Input className="mb-5" value={name} onChange={(e) => setName(e.target.value)} />
          <Label>Leads</Label>
          <div className="mb-4 flex flex-wrap gap-2">
            {stashed.length > 0 && <Chip active={source === "selection"} onClick={() => setSource("selection")}>Selecionados na tela Leads ({stashed.length})</Chip>}
            <Chip active={source === "qualified"} onClick={() => setSource("qualified")}>Aba Qualificados</Chip>
            <Chip active={source === "filter"} onClick={() => setSource("filter")}>Por filtro</Chip>
          </div>
          {source === "filter" && (
            <div className="mb-4 grid gap-3 sm:grid-cols-3">
              <div><Label>Score mínimo</Label><Input type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value) || 0)} /></div>
              <div><Label>Cidade</Label><Select className="w-full" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Todas</option>{facets.cities.map((c) => <option key={c}>{c}</option>)}</Select></div>
              <div><Label>Categoria</Label><Select className="w-full" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas</option>{facets.categories.map((c) => <option key={c}>{c}</option>)}</Select></div>
            </div>
          )}
          <div className="rounded-xl border border-line bg-card2/50 p-4">
            {resolving ? <div className="flex items-center gap-2 text-sm text-muted"><Spinner className="size-4" /> Calculando…</div> : elig && (
              <>
                <div className="text-sm text-ink"><b className="text-2xl text-strong">{elig.eligible}</b> leads elegíveis de {elig.total}</div>
                <ul className="mt-2 space-y-0.5 text-xs text-muted">
                  {elig.reasons.no_mobile > 0 && <li>{elig.reasons.no_mobile} sem celular válido (fixo não tem WhatsApp)</li>}
                  {elig.reasons.blocked > 0 && <li>{elig.reasons.blocked} na lista de bloqueio</li>}
                  {elig.reasons.status > 0 && <li>{elig.reasons.status} já responderam, são clientes ou pediram pra não ser contatados</li>}
                  {elig.reasons.already > 0 && <li>{elig.reasons.already} já receberam ou estão na fila de outra campanha</li>}
                  {elig.reasons.archived > 0 && <li>{elig.reasons.archived} arquivados</li>}
                </ul>
              </>
            )}
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card title="Números de envio" icon={<Smartphone className="size-4" />}>
          <p className="mb-4 text-sm text-muted">Com mais de um número, as mensagens se revezam entre eles. Cada um respeita o próprio aquecimento.</p>
          {numbers.length === 0 ? (
            <Callout tone="violet" title="Nenhum número cadastrado">Cadastre e conecte um número na tela WhatsApp antes.</Callout>
          ) : (
            <div className="space-y-2">
              {numbers.map((n) => {
                const disabled = n.paused;
                const on = numberIds.includes(n.id);
                return (
                  <label key={n.id} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border p-3", on ? "border-cyan/40 bg-cyan/[0.04]" : "border-line", disabled && "cursor-not-allowed opacity-50")}>
                    <input type="checkbox" className="size-4 accent-[#00e5ff]" disabled={disabled} checked={on}
                      onChange={() => setNumberIds(on ? numberIds.filter((x) => x !== n.id) : [...numberIds, n.id])} />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-strong">{n.label}</div>
                      <div className="text-xs text-muted">{n.phone ?? "sem número"} · {n.status === "connected" ? "conectado" : "desconectado"}{n.paused ? ` · pausado: ${n.pause_reason}` : ""}</div>
                    </div>
                    {n.status !== "connected" && !n.paused && <Badge tone="violet">Conecte antes do horário de envio</Badge>}
                  </label>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <Card title="Modelos de abertura" icon={<MessageSquareText className="size-4" />}
            actions={templates.length < 10 && <Button size="sm" variant="secondary" icon={<Plus className="size-3.5" />} onClick={() => setTemplates([...templates, ""])}>Modelo</Button>}>
            <p className="mb-3 text-sm text-muted">
              De 5 a 10 modelos diferentes, alternados entre os leads. Use <code className="text-cyan">{"{Oi|Olá|Opa}"}</code> pra sortear palavras
              (dá pra aninhar) e as variáveis abaixo. Variável vazia usa um texto alternativo; pra escolher o seu: <code className="text-cyan">{"{{cidade|sua cidade}}"}</code>.
            </p>
            <div className="mb-4 flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button key={v.key} onClick={() => insertAtCursor(`{{${v.key}}}`)} title={v.label}
                  className="rounded-md border border-line2 px-2 py-1 font-mono text-[11px] text-cyan hover:bg-cyan/10">{`{{${v.key}}}`}</button>
              ))}
              <span className="mx-1 w-px bg-line" />
              <button onClick={() => insertAtCursor(" " + IDENTITY_SNIPPET)} className="inline-flex items-center gap-1 rounded-md border border-line2 px-2 py-1 text-[11px] text-ink hover:bg-hover"><UserRound className="size-3" /> Quem sou</button>
              <button onClick={() => insertAtCursor(" " + EXIT_SNIPPET)} className="inline-flex items-center gap-1 rounded-md border border-line2 px-2 py-1 text-[11px] text-ink hover:bg-hover"><DoorOpen className="size-3" /> Frase de saída</button>
            </div>
            {filled.length < 5 && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-line2 p-3 text-sm text-muted">
                <span>Precisa de pelo menos 5 modelos ({filled.length}/5).</span>
                <Button size="sm" variant="secondary" icon={<Wand2 className="size-3.5" />}
                  onClick={() => setTemplates([...filled, ...DEFAULT_TEMPLATES].slice(0, Math.max(5, filled.length)))}>Completar com modelos prontos</Button>
              </div>
            )}
            <div className="space-y-4">
              {templates.map((t, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted">Modelo {i + 1}</span>
                    {templates.length > 1 && <button onClick={() => setTemplates(templates.filter((_, j) => j !== i))} className="text-faint hover:text-danger"><Trash2 className="size-3.5" /></button>}
                  </div>
                  <Textarea rows={4} value={t}
                    onFocus={(e) => (focused.current = { i, el: e.currentTarget })}
                    onChange={(e) => setTemplates(templates.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder="{Oi|Olá}, tudo bem? Aqui é {{meu_nome}}, da {{minha_empresa}}…" />
                  {issues[i]?.length > 0 && (
                    <ul className="mt-1.5 space-y-1">
                      {issues[i].map((iss) => (
                        <li key={iss.code} className={cn("flex items-start gap-1.5 text-xs", iss.level === "error" ? "text-danger" : "text-[#a996ff]")}>
                          {iss.level === "error" ? <XCircle className="mt-0.5 size-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />}
                          <span>{iss.message}</span>
                          {iss.code === "exit" && <button onClick={() => { focused.current = { i, el: null }; setTemplates(templates.map((x, j) => (j === i ? `${x.trim()} ${EXIT_SNIPPET}` : x))); }} className="ml-1 underline">inserir</button>}
                          {iss.code === "identity" && <button onClick={() => setTemplates(templates.map((x, j) => (j === i ? `${IDENTITY_SNIPPET} ${x.trim()}` : x)))} className="ml-1 underline">inserir</button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {!settings?.my_name && <Callout tone="violet" className="mt-4">Preencha &quot;Meu nome&quot; em Configurações, senão {"{{meu_nome}}"} sai vazio.</Callout>}
          </Card>

          {config?.aiEnabled && (
            <Card title="Mensagem única por lead (IA)" icon={<Sparkles className="size-4" />}>
              <Toggle checked={useAi} onChange={setUseAi} label={<span className="text-sm text-ink">Gerar uma primeira mensagem diferente pra cada lead</span>} />
              {useAi && (
                <>
                  <p className="mt-3 text-xs text-muted">A IA usa os dados do lead e segue as mesmas regras (quem sou, pergunta, frase de saída, sem link). Se falhar, cai pro modelo normal.</p>
                  <Label className="mt-3">O que você oferece / orientação</Label>
                  <Textarea rows={3} value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)}
                    placeholder="Ex.: ofereço site + atendimento automático no WhatsApp pra clínicas, valor fechado, sem mensalidade. Tom leve." />
                </>
              )}
            </Card>
          )}

          <Card title="Pré-visualização" icon={<Eye className="size-4" />}
            actions={<Button size="sm" variant="secondary" loading={previewing} disabled={!filled.length} onClick={runPreview}>Gerar 5 exemplos</Button>}>
            {!preview ? <p className="text-sm text-muted">Gera 5 mensagens com leads reais dessa campanha, do jeito que vão sair.</p> : (
              <div className="space-y-3">
                {preview.map((p, i) => (
                  <div key={i} className="rounded-xl border border-line bg-card2/60 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs text-muted">Para <b className="text-ink">{p.lead}</b>{p.ai && <Badge tone="violet">IA</Badge>}<span className="ml-auto">{p.text.length} caracteres</span></div>
                    <div className="whitespace-pre-wrap text-sm text-ink">{p.text}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {step === 4 && (
        <Card title="Revisão" icon={<Rocket className="size-4" />}>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Campanha</dt><dd className="font-medium text-strong">{name}</dd></div>
            <div><dt className="text-muted">Leads elegíveis</dt><dd className="font-medium text-strong">{elig?.eligible}</dd></div>
            <div><dt className="text-muted">Números</dt><dd className="font-medium text-strong">{numbers.filter((n) => numberIds.includes(n.id)).map((n) => n.label).join(", ")}</dd></div>
            <div><dt className="text-muted">Modelos</dt><dd className="font-medium text-strong">{filled.length}{useAi ? " + IA" : ""}</dd></div>
            <div><dt className="text-muted">Ritmo hoje</dt><dd className="font-medium text-strong">~{perDay} mensagens/dia no total</dd></div>
            <div><dt className="text-muted">Duração estimada</dt><dd className="font-medium text-strong">{perDay ? `~${Math.ceil((elig?.eligible ?? 0) / perDay)} dias úteis` : "—"}</dd></div>
          </dl>
          <Callout tone="neutral" className="mt-5">
            Envio só de {settings?.send_config.window_start} às {settings?.send_config.window_end}, nos dias configurados, sem feriados. Intervalo de {settings?.send_config.min_interval_s}–{settings?.send_config.max_interval_s}s,
            pausa longa a cada {settings?.send_config.long_pause_every_min}–{settings?.send_config.long_pause_every_max} mensagens, &quot;digitando…&quot; antes de cada uma.
            Quem responder sai da fila na hora; quem pedir pra sair entra na lista de bloqueio.
          </Callout>
        </Card>
      )}

      <div className="mt-6 flex items-center justify-between">
        <Button variant="ghost" icon={<ArrowLeft className="size-4" />} onClick={() => (step > 1 ? setStep(step - 1) : router.push("/campanhas"))}>Voltar</Button>
        {step < 4 ? (
          <Button variant="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuar <ArrowRight className="size-4" /></Button>
        ) : (
          <Button variant="cta" size="lg" icon={<Rocket className="size-4" />} loading={starting} onClick={start}>Iniciar campanha</Button>
        )}
      </div>
    </div>
  );
}

export default function NovaCampanhaPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}><NovaInner /></Suspense>;
}
