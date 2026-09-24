"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Crosshair, Megaphone, HelpCircle, MapPin, Search, Info, Phone, Globe, Layers, KeyRound, StopCircle, CheckCircle2, AlertTriangle, Loader2, ArrowRight, Pointer,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api } from "@/lib/client";
import { useAppConfig, useSettings } from "@/lib/hooks";
import { Button, Callout, Card, Chip, Input, Label, Modal, PageHeader, Progress, Select, Spinner, Tip } from "@/components/ui";
import { SegmentPicker } from "@/components/search/segment-picker";
import type { Point } from "@/components/search/map-picker";
import type { SearchJob, SearchParams, Segment } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/search/map-picker"), {
  ssr: false,
  loading: () => <div className="flex h-[320px] items-center justify-center sm:h-[360px]"><Spinner /></div>,
});

const FILTERS: { v: SearchParams["filter"]; label: string; icon: React.ReactNode; hint: string }[] = [
  { v: "phone", label: "Só telefone", icon: <Phone className="size-3.5" />, hint: "Guarda quem tem telefone (com ou sem site). É o padrão." },
  { v: "phone_site", label: "Telefone + Site", icon: <><Phone className="size-3.5" /><Globe className="size-3.5" /></>, hint: "Só quem tem telefone E site. Bom pra achar site ruim pra refazer." },
  { v: "all", label: "Todos", icon: <Layers className="size-3.5" />, hint: "Guarda tudo, até quem não tem telefone." },
];

export default function BuscarPage() {
  const { config, reload: reloadConfig } = useAppConfig();
  const { settings } = useSettings();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [point, setPoint] = useState<Point | null>(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [radiusKm, setRadiusKm] = useState(5);
  const [flyTo, setFlyTo] = useState<{ p: Point; key: number } | null>(null);
  const [geoQuery, setGeoQuery] = useState("");
  const [geoResults, setGeoResults] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [filter, setFilter] = useState<SearchParams["filter"]>("phone");
  const [maxPer, setMaxPer] = useState(60);
  const [job, setJob] = useState<SearchJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const [news, setNews] = useState(false);
  const driving = useRef<string | null>(null);

  const loadSegments = useCallback(async () => {
    const { data } = await supabaseBrowser().from("segments").select("*").order("sort");
    setSegments((data ?? []) as Segment[]);
  }, []);
  useEffect(() => { loadSegments(); }, [loadSegments]);

  const limit = settings?.google_monthly_limit ?? 1000;
  const used = config?.googleUsage ?? 0;
  const quotaLeft = Math.max(0, limit - used);
  const running = job && (job.status === "queued" || job.status === "running");

  // Enquanto a página estiver aberta, ela mesma empurra a busca (mais rápido que o cron)
  const drive = useCallback(async (id: string) => {
    if (driving.current === id) return;
    driving.current = id;
    const sb = supabaseBrowser();
    try {
      for (let i = 0; i < 500 && driving.current === id; i++) {
        let done = false;
        try {
          done = (await api<{ done: boolean }>(`/api/search/${id}/process`, {})).done;
        } catch (e) {
          toast.error((e as Error).message);
          await new Promise((r) => setTimeout(r, 4000));
        }
        const { data } = await sb.from("search_jobs").select("*").eq("id", id).single();
        if (data) setJob(data as SearchJob);
        if (done || (data && !["queued", "running"].includes(data.status))) break;
        await new Promise((r) => setTimeout(r, 600));
      }
    } finally {
      if (driving.current === id) driving.current = null;
      reloadConfig();
    }
  }, [reloadConfig]);

  // retoma busca em andamento ao abrir a página + tempo real
  useEffect(() => {
    const sb = supabaseBrowser();
    (async () => {
      const { data } = await sb.from("search_jobs").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (data) {
        setJob(data as SearchJob);
        if (["queued", "running"].includes(data.status)) drive(data.id);
      }
    })();
    const ch = sb.channel("search-jobs")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "search_jobs" }, (payload: { new: unknown }) => {
        setJob((cur) => (cur && cur.id === (payload.new as SearchJob).id ? (payload.new as SearchJob) : cur));
      })
      .subscribe();
    return () => { driving.current = null; sb.removeChannel(ch); };
  }, [drive]);

  useEffect(() => {
    if (job && !["queued", "running"].includes(job.status) && job.finished_at) {
      const age = Date.now() - new Date(job.finished_at).getTime();
      if (age < 5000) {
        if (job.status === "done") toast.success(`Busca concluída: ${job.inserted} leads novos.`);
        else if (job.status === "quota") toast.warning(job.error ?? "Cota atingida.");
        else if (job.status === "error") toast.error(job.error ?? "A busca falhou.");
      }
    }
  }, [job?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function geocode(e?: React.FormEvent) {
    e?.preventDefault();
    if (!geoQuery.trim()) return;
    setGeoLoading(true);
    try {
      // Nominatim (OSM): grátis, 1 consulta por vez, só quando você aperta buscar
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(geoQuery.trim())}`;
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (!data.length) toast.info("Não achei esse lugar. Tente \"bairro, cidade\" ou clique no mapa.");
      if (data.length === 1) pickGeo(data[0]);
      else setGeoResults(data);
    } catch {
      toast.error("A busca de endereço falhou. Clique direto no mapa.");
    } finally {
      setGeoLoading(false);
    }
  }
  function pickGeo(r: { display_name: string; lat: string; lon: string }) {
    const p = { lat: Number(r.lat), lng: Number(r.lon) };
    setPoint(p);
    setPlaceLabel(r.display_name.split(",").slice(0, 3).join(",").trim());
    setFlyTo({ p, key: Date.now() });
    setGeoResults([]);
  }

  async function start() {
    if (!point) return toast.error("Clique no mapa pra marcar onde buscar.");
    if (!selected.length) return toast.error("Escolha pelo menos um nicho.");
    setStarting(true);
    try {
      const { id } = await api<{ id: string }>("/api/search", {
        lat: point.lat, lng: point.lng, radius_m: radiusKm * 1000, place_label: placeLabel || undefined,
        categories: selected, max_per_category: maxPer, filter, source: "google_maps",
      } satisfies SearchParams);
      const { data } = await supabaseBrowser().from("search_jobs").select("*").eq("id", id).single();
      setJob(data as SearchJob);
      drive(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!job) return;
    driving.current = null;
    await api(`/api/search/${job.id}/cancel`, {});
    const { data } = await supabaseBrowser().from("search_jobs").select("*").eq("id", job.id).single();
    setJob(data as SearchJob);
    toast.info("Busca cancelada. O que já foi encontrado ficou salvo.");
  }

  const estimate = selected.length * Math.ceil(maxPer / 20);
  const noKey = config && !config.googleConfigured;
  const quotaOut = config && quotaLeft <= 0;

  return (
    <div>
      <PageHeader title="Buscar Leads">
        <button onClick={() => setNews(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><Megaphone className="size-4" /> Novidades</button>
        <button onClick={() => setTutorial(true)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><HelpCircle className="size-4" /> Tutorial</button>
      </PageHeader>

      {noKey && (
        <Callout tone="violet" className="mb-5" icon={<KeyRound className="size-4 text-violet" />} title="Falta configurar a Google Maps API">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Sem a API Key do Google a busca fica bloqueada. O resto do sistema funciona normal.</span>
            <Link href="/configuracoes#google"><Button variant="primary" size="sm" icon={<ArrowRight className="size-3.5" />}>Configurar Google Maps API</Button></Link>
          </div>
        </Callout>
      )}

      <Card className="mb-5 p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <Label className="mb-0">Localização. Clique no mapa para marcar onde buscar</Label>
          <form onSubmit={geocode} className="flex w-full gap-2 sm:w-auto">
            <Input className="h-9 sm:w-72" placeholder="Ou digite cidade / bairro…" value={geoQuery} onChange={(e) => setGeoQuery(e.target.value)} />
            <Button type="submit" size="md" variant="secondary" loading={geoLoading} icon={<Search className="size-4" />}>Ir</Button>
          </form>
        </div>
        {geoResults.length > 1 && (
          <div className="mb-3 overflow-hidden rounded-lg border border-line">
            {geoResults.map((r) => (
              <button key={r.lat + r.lon} onClick={() => pickGeo(r)} className="flex w-full items-center gap-2 border-b border-line px-3 py-2 text-left text-sm text-ink last:border-0 hover:bg-hover">
                <MapPin className="size-3.5 shrink-0 text-cyan" /> <span className="truncate">{r.display_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-line">
          <MapPicker point={point} radiusM={radiusKm * 1000} onPick={(p) => { setPoint(p); setPlaceLabel(""); }} flyTo={flyTo} />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <Pointer className="size-3.5" />
            {point ? <>Centro: {placeLabel || `${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`}</> : "Clique no mapa para marcar onde buscar"}
          </p>
          <div className="flex flex-1 items-center gap-3 sm:justify-end">
            <span className="text-xs text-muted">Raio</span>
            <input type="range" min={1} max={50} step={1} value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="w-full sm:w-56" />
            <span className="w-14 text-right text-sm font-medium text-strong">{radiusKm} km</span>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Card title={<span className="text-[11px] font-semibold uppercase tracking-wider text-ink">Categorias / Segmentos</span>}>
          <SegmentPicker segments={segments} selected={selected} onChange={setSelected} onSegmentsChange={loadSegments} />
        </Card>

        <div className="space-y-5">
          <Card title={<span className="text-[11px] font-semibold uppercase tracking-wider text-ink">Fonte de dados</span>}
            actions={<Tip content="O Google Maps é a fonte com mais telefone e site. A estrutura já está pronta pra outras fontes (ex.: OpenStreetMap) no futuro." />}>
            <Select className="w-full" value="google_maps" onChange={() => undefined}>
              <option value="google_maps">Google Maps (Recomendado)</option>
              <option disabled>OpenStreetMap (em breve)</option>
            </Select>
          </Card>

          <Card title={<span className="text-[11px] font-semibold uppercase tracking-wider text-ink">Filtro de captura</span>}>
            <p className="mb-2 text-sm text-muted">O que guardar do que o Google retornar:</p>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Chip key={f.v} active={filter === f.v} onClick={() => setFilter(f.v)} title={f.hint}>{f.icon} {f.label}</Chip>
              ))}
            </div>
            <p className="mt-2 text-xs text-faint">{FILTERS.find((f) => f.v === filter)?.hint}</p>
            <div className="mt-4 flex items-baseline justify-between text-sm">
              <span className="text-muted">Cota gratuita Google Maps</span>
              <span><b className="text-strong">{used.toLocaleString("pt-BR")}</b> <span className="text-muted">/ {limit.toLocaleString("pt-BR")} requisições</span></span>
            </div>
            <Progress className="mt-2" value={used} max={limit} tone={quotaOut ? "danger" : used / limit > 0.8 ? "violet" : "cyan"} />
            <p className="mt-2 text-xs text-muted">
              {quotaOut ? "Cota do mês esgotada. As buscas voltam dia 1º." : `~${(quotaLeft * 20).toLocaleString("pt-BR")} leads gratuitos restantes este mês`}
            </p>
          </Card>

          <Card title={<span className="text-[11px] font-semibold uppercase tracking-wider text-ink">Máx. resultados por categoria: {maxPer}</span>}>
            <div className="flex items-center gap-3">
              <input type="range" min={10} max={200} step={10} value={maxPer} onChange={(e) => setMaxPer(Number(e.target.value))} className="flex-1" />
              <Input type="number" min={10} max={200} value={maxPer} onChange={(e) => setMaxPer(Math.max(10, Math.min(200, Number(e.target.value) || 10)))} className="h-9 w-20" />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-faint"><span>10</span><span>50</span><span>100</span><span>150</span><span>200</span></div>
            <p className="mt-3 flex gap-1.5 text-xs text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              <span>Até 60, o Google traz tudo de uma vez. Acima disso, o sistema divide a área em sub-regiões e varre só o necessário pra chegar na meta, e para sozinho quando a região se esgota, economizando a cota.</span>
            </p>
            {selected.length > 0 && (
              <p className="mt-2 text-xs text-faint">Estimativa: ~{estimate} requisições ({selected.length} nicho{selected.length > 1 ? "s" : ""} × até {Math.ceil(maxPer / 20)} páginas).</p>
            )}
          </Card>

          {running ? (
            <JobBox job={job!} onCancel={cancel} />
          ) : (
            <>
              <Button variant="cta" size="lg" className="w-full" icon={<Crosshair className="size-4" />} onClick={start} loading={starting}
                disabled={!!noKey || !!quotaOut || !point || !selected.length}>
                Iniciar Busca
              </Button>
              {job && <JobBox job={job} />}
            </>
          )}
        </div>
      </div>

      <Modal open={tutorial} onClose={() => setTutorial(false)} title="Como buscar leads">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink">
          <li>Clique no mapa (ou digite a cidade) pra marcar o centro. Ajuste o raio.</li>
          <li>Escolha os nichos. Se o seu não estiver na lista, digite e aperte Enter pra salvar.</li>
          <li>Escolha o filtro: o padrão guarda só quem tem telefone.</li>
          <li>Defina quantos resultados quer por nicho. Mais resultados = mais requisições da cota.</li>
          <li>Clique em <b>Iniciar Busca</b>. Pode fechar a página: a busca continua sozinha no servidor.</li>
          <li>Os leads aparecem em <Link href="/leads" className="text-cyan hover:underline">Leads</Link>, já com score. Duplicados e arquivados são ignorados.</li>
        </ol>
      </Modal>
      <Modal open={news} onClose={() => setNews(false)} title="Novidades">
        <div className="space-y-2 text-sm text-ink">
          <p><b>v1.0.0</b> · Primeira versão do Kroma Leads.</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            <li>Busca no Google Maps com varredura por sub-regiões e trava de cota.</li>
            <li>CRM de leads com score, abas, filtros, importação e exportação CSV.</li>
            <li>Campanhas de WhatsApp com aquecimento, janela de horário e pausa automática.</li>
            <li>Conversas em tempo real com bloqueio automático de quem pede pra sair.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}

function JobBox({ job, onCancel }: { job: SearchJob; onCancel?: () => void }) {
  const running = job.status === "queued" || job.status === "running";
  const cats = job.params.categories;
  const idx = job.current_category ? Math.max(0, cats.indexOf(job.current_category)) : running ? 0 : cats.length;
  const head = {
    queued: { icon: <Loader2 className="size-4 animate-spin text-cyan" />, text: "Na fila…" },
    running: { icon: <Loader2 className="size-4 animate-spin text-cyan" />, text: job.current_category ? `Buscando: ${job.current_category}` : "Buscando…" },
    done: { icon: <CheckCircle2 className="size-4 text-cyan" />, text: "Última busca concluída" },
    cancelled: { icon: <StopCircle className="size-4 text-muted" />, text: "Última busca cancelada" },
    quota: { icon: <AlertTriangle className="size-4 text-violet" />, text: "Parou na cota" },
    error: { icon: <AlertTriangle className="size-4 text-danger" />, text: "A busca parou com erro" },
  }[job.status];
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-strong">{head.icon}<span className="truncate">{head.text}</span></div>
        {running && onCancel && <Button size="sm" variant="danger" icon={<StopCircle className="size-3.5" />} onClick={onCancel}>Cancelar</Button>}
      </div>
      {running && (
        <>
          <Progress value={idx} max={cats.length} />
          <p className="mt-1 text-xs text-faint">Nicho {Math.min(idx + 1, cats.length)} de {cats.length}. Pode fechar a página, a busca continua.</p>
        </>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
        {[
          ["Encontrados", job.found], ["Novos", job.inserted], ["Duplicados", job.duplicates], ["Requisições", job.requests],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-card2 px-2 py-2">
            <div className="text-lg font-semibold text-strong">{v}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted">{l}</div>
          </div>
        ))}
      </div>
      {job.discarded > 0 && <p className="mt-2 text-xs text-faint">{job.discarded} descartados (sem telefone, fora do raio ou fechados de vez).</p>}
      {job.error && <p className={`mt-2 text-xs ${job.status === "error" ? "text-danger" : "text-muted"}`}>{job.error}</p>}
      {!running && job.inserted > 0 && (
        <Link href="/leads" className="mt-3 inline-flex items-center gap-1 text-sm text-cyan hover:underline">Ver leads <ArrowRight className="size-3.5" /></Link>
      )}
    </div>
  );
}
