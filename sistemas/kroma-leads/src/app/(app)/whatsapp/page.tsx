"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Smartphone, Plus, QrCode, RefreshCw, PauseCircle, PlayCircle, Unplug, Trash2, AlertTriangle, ShieldAlert, CheckCircle2, Webhook, Flame, Pencil,
} from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, fmtDateTime } from "@/lib/client";
import { useSettings } from "@/lib/hooks";
import { formatPhone } from "@/lib/phone";
import { localDateKey } from "@/lib/time";
import { dailyLimit, warmupWeek } from "@/lib/sender/schedule";
import { Badge, Button, Callout, Card, Empty, Input, Label, Modal, PageHeader, Progress, Spinner, cn } from "@/components/ui";
import type { NumberStats, WhatsappNumber } from "@/lib/types";

const TZ = "America/Sao_Paulo";

export default function WhatsappPage() {
  const sb = supabaseBrowser();
  const { settings } = useSettings();
  const [numbers, setNumbers] = useState<WhatsappNumber[] | null>(null);
  const [stats, setStats] = useState<Record<string, NumberStats>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [qrFor, setQrFor] = useState<WhatsappNumber | null>(null);

  const load = useCallback(async () => {
    const [{ data: nums }, { data: st }] = await Promise.all([
      sb.from("whatsapp_numbers").select("*").order("created_at"),
      sb.from("number_stats").select("*"),
    ]);
    setNumbers((nums ?? []) as WhatsappNumber[]);
    setStats(Object.fromEntries(((st ?? []) as NumberStats[]).map((s) => [s.number_id, s])));
  }, [sb]);

  useEffect(() => {
    load();
    const ch = sb.channel("wa-numbers")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_numbers" }, () => load())
      .subscribe();
    const t = setInterval(load, 30_000);
    return () => { clearInterval(t); sb.removeChannel(ch); };
  }, [load, sb]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="WhatsApp" subtitle="Números conectados pela Uazapi pra disparo e conversas.">
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAddOpen(true)}>Adicionar número</Button>
      </PageHeader>

      <Callout tone="violet" className="mb-5" icon={<ShieldAlert className="size-4 text-violet" />} title="Use um chip só pra prospecção">
        Nunca use seu número pessoal nem o número que atende clientes. Se o WhatsApp restringir o chip de prospecção, o resto da sua operação continua de pé.
        Número novo começa devagar (aquecimento) e sobe o volume sozinho com o tempo.
      </Callout>

      {numbers === null ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : numbers.length === 0 ? (
        <Card>
          <Empty icon={<Smartphone className="size-8" />} title="Nenhum número cadastrado.">
            Crie uma instância no painel da Uazapi, copie a URL do servidor e o token da instância, e clique em &quot;Adicionar número&quot;.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {numbers.map((n) => (
            <NumberCard key={n.id} n={n} stats={stats[n.id]} settings={settings} onChanged={load} onConnect={() => setQrFor(n)} />
          ))}
        </div>
      )}

      <AddNumberModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={(id) => { setAddOpen(false); load().then(() => {
        sb.from("whatsapp_numbers").select("*").eq("id", id).single().then(({ data }: { data: WhatsappNumber | null }) => data && data.status !== "connected" && setQrFor(data));
      }); }} />
      {qrFor && <QrModal n={qrFor} onClose={() => { setQrFor(null); load(); }} />}
    </div>
  );
}

function NumberCard({ n, stats, settings, onChanged, onConnect }: {
  n: WhatsappNumber; stats?: NumberStats; settings: ReturnType<typeof useSettings>["settings"]; onChanged: () => void; onConnect: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(false);
  const [date, setDate] = useState(n.warmup_start_date);
  const today = localDateKey(new Date(), TZ);
  const replyRate = stats && stats.leads_contacted > 0 ? (stats.leads_replied / stats.leads_contacted) * 100 : null;
  const limit = settings ? dailyLimit(n.id, n.warmup_start_date, today, stats && stats.leads_contacted >= 20 ? replyRate : null, settings.warmup_config) : null;
  const week = warmupWeek(n.warmup_start_date, today);

  async function run(action: string, path: string, method = "POST", msg?: string) {
    setBusy(action);
    try {
      await api(`/api/whatsapp/numbers/${n.id}${path}`, method === "DELETE" ? undefined : {}, method);
      if (msg) toast.success(msg);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function saveDate() {
    try {
      await api(`/api/whatsapp/numbers/${n.id}`, { warmup_start_date: date }, "PATCH");
      setEditDate(false);
      toast.success("Data de início atualizada.");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const statusBadge = n.status === "connected"
    ? <Badge tone="cyan"><span className="size-1.5 rounded-full bg-cyan" /> Conectado</Badge>
    : n.status === "connecting"
      ? <Badge tone="violet"><span className="size-1.5 rounded-full bg-violet pulse-dot" /> Aguardando QR</Badge>
      : <Badge><span className="size-1.5 rounded-full bg-faint" /> Desconectado</Badge>;

  return (
    <Card className={cn(n.paused && "border-violet/40")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-strong">{n.label}</h3>
            {statusBadge}
            {n.paused && <Badge tone="violet"><PauseCircle className="size-3" /> Pausado</Badge>}
          </div>
          <div className="mt-1 text-sm text-muted">
            {n.phone ? formatPhone(n.phone) : "Número ainda não identificado"}{n.profile_name ? ` · ${n.profile_name}` : ""}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-faint">{n.server_url} · token ••••{n.token_last4}</div>
        </div>
      </div>

      {n.paused && n.pause_reason && (
        <div className="mb-4 flex gap-2 rounded-lg border border-violet/30 bg-violet/[0.06] p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-violet" />
          <div><div>{n.pause_reason}</div>{n.paused_at && <div className="mt-1 text-xs text-muted">Desde {fmtDateTime(n.paused_at)}. Retomar é manual.</div>}</div>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted">Enviados hoje</span>
          <span><b className="text-strong">{stats?.sent_today ?? 0}</b><span className="text-muted"> / {limit ?? "…"} (limite de hoje)</span></span>
        </div>
        <Progress value={stats?.sent_today ?? 0} max={limit ?? 1} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Stat label="Aquecimento" value={<span className="inline-flex items-center gap-1"><Flame className="size-3.5 text-cyan" /> Semana {week}</span>} />
        <Stat label="Taxa de resposta" value={replyRate === null ? "—" : `${replyRate.toFixed(1)}%`} hint={stats ? `${stats.leads_replied}/${stats.leads_contacted} leads` : undefined} />
        <Stat label="Falhas (7 dias)" value={String(stats?.failures_7d ?? 0)} hint={n.consecutive_failures ? `${n.consecutive_failures} seguidas agora` : undefined} />
        <Stat label="Total enviado" value={String(stats?.sent_total ?? 0)} />
        <Stat label="Início" value={
          editDate ? (
            <span className="flex items-center gap-1">
              <Input type="date" className="h-7 px-1.5 text-xs" value={date} onChange={(e) => setDate(e.target.value)} />
              <button onClick={saveDate} className="text-cyan"><CheckCircle2 className="size-4" /></button>
            </span>
          ) : (
            <button onClick={() => setEditDate(true)} className="inline-flex items-center gap-1 hover:text-cyan">
              {new Date(n.warmup_start_date + "T12:00:00").toLocaleDateString("pt-BR")} <Pencil className="size-3 text-faint" />
            </button>
          )
        } />
        <Stat label="Webhook" value={n.webhook_ok ? <span className="inline-flex items-center gap-1 text-cyan"><Webhook className="size-3.5" /> Ativo</span> : <span className="text-muted">Não registrado</span>} />
      </div>
      {n.last_error && !n.paused && <p className="mt-3 text-xs text-danger">Último erro: {n.last_error}</p>}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {n.status !== "connected" && <Button size="sm" variant="primary" icon={<QrCode className="size-3.5" />} onClick={onConnect}>Conectar (QR)</Button>}
        <Button size="sm" variant="secondary" icon={<RefreshCw className="size-3.5" />} loading={busy === "refresh"} onClick={() => run("refresh", "/refresh", "POST", "Status atualizado.")}>Status</Button>
        {n.paused ? (
          <Button size="sm" variant="primary" icon={<PlayCircle className="size-3.5" />} loading={busy === "resume"} disabled={n.status !== "connected"}
            onClick={() => run("resume", "/resume", "POST", "Número retomado. A fila foi reagendada a partir de agora.")}>Retomar</Button>
        ) : (
          <Button size="sm" variant="secondary" icon={<PauseCircle className="size-3.5" />} loading={busy === "pause"} onClick={() => run("pause", "/pause", "POST", "Número pausado.")}>Pausar</Button>
        )}
        {n.status === "connected" && (
          <Button size="sm" variant="ghost" icon={<Unplug className="size-3.5" />} loading={busy === "disc"}
            onClick={() => confirm("Desconectar esse WhatsApp? Vai precisar ler o QR de novo.") && run("disc", "/disconnect", "POST", "Desconectado.")}>Desconectar</Button>
        )}
        {n.status !== "connected" && n.webhook_ok === false && (
          <Button size="sm" variant="ghost" icon={<Webhook className="size-3.5" />} onClick={onConnect}>Registrar webhook</Button>
        )}
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Trash2 className="size-3.5" />} loading={busy === "del"}
          onClick={() => confirm("Remover esse número do sistema? Mensagens agendadas nele serão canceladas. O histórico de conversas fica.") && run("del", "", "DELETE", "Número removido.")}>
          Remover
        </Button>
      </div>
    </Card>
  );
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg bg-card2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-strong">{value}</div>
      {hint && <div className="text-[10px] text-faint">{hint}</div>}
    </div>
  );
}

function AddNumberModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (id: string) => void }) {
  const [form, setForm] = useState({ label: "Prospecção 1", server_url: "", token: "", warmup_start_date: localDateKey(new Date(), TZ) });
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try {
      const { id } = await api<{ id: string }>("/api/whatsapp/numbers", form);
      toast.success("Instância validada e salva.");
      setForm({ ...form, token: "" });
      onAdded(id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="Adicionar número (Uazapi)"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="primary" loading={loading} onClick={submit}>Validar e salvar</Button></>}>
      <div className="space-y-4">
        <div><Label>Nome pra identificar</Label><Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></div>
        <div>
          <Label>URL do servidor</Label>
          <Input placeholder="https://suaconta.uazapi.com" value={form.server_url} onChange={(e) => setForm({ ...form, server_url: e.target.value })} />
          <p className="mt-1 text-xs text-faint">Aparece no painel da Uazapi como &quot;Server URL&quot;.</p>
        </div>
        <div>
          <Label>Token da instância</Label>
          <Input type="password" autoComplete="off" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} className="font-mono" />
          <p className="mt-1 text-xs text-faint">Fica guardado só no servidor. A tela mostra apenas os 4 últimos caracteres.</p>
        </div>
        <div>
          <Label>Data de início (aquecimento)</Label>
          <Input type="date" value={form.warmup_start_date} onChange={(e) => setForm({ ...form, warmup_start_date: e.target.value })} />
          <p className="mt-1 text-xs text-faint">Chip novo? Deixe hoje. Chip que já usa há semanas pra conversar normal? Pode voltar a data.</p>
        </div>
      </div>
    </Modal>
  );
}

function QrModal({ n, onClose }: { n: WhatsappNumber; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("starting");
  const [error, setError] = useState<string | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const r = await api<{ status: string; qr: string | null; webhookOk: boolean; webhookError: string | null }>(`/api/whatsapp/numbers/${n.id}/connect`, {});
        if (!alive.current) return;
        setQr(r.qr);
        setStatus(r.status);
        setWebhookError(r.webhookOk ? null : r.webhookError);
        for (let i = 0; i < 60 && alive.current; i++) {
          await new Promise((res) => setTimeout(res, 3000));
          if (!alive.current) return;
          const s = await api<{ status: string; qr: string | null }>(`/api/whatsapp/numbers/${n.id}/refresh`, {});
          setStatus(s.status);
          if (s.qr) setQr(s.qr);
          if (s.status === "connected") {
            toast.success("WhatsApp conectado!");
            setTimeout(onClose, 1200);
            return;
          }
        }
      } catch (e) {
        setError((e as Error).message);
      }
    })();
    return () => { alive.current = false; };
  }, [n.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal open onClose={onClose} title={`Conectar ${n.label}`}>
      <div className="flex flex-col items-center gap-4 text-center">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : status === "connected" ? (
          <div className="flex flex-col items-center gap-2 py-8 text-strong"><CheckCircle2 className="size-10 text-cyan" /> Conectado</div>
        ) : qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR code do WhatsApp" className="size-64 rounded-xl bg-white p-3" />
            <p className="text-sm text-muted">No celular: WhatsApp → <b className="text-ink">Aparelhos conectados</b> → <b className="text-ink">Conectar aparelho</b> → aponte pra esse código.</p>
            <p className="text-xs text-faint">O código se renova sozinho. Esperando leitura…</p>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-muted"><Spinner /> Gerando QR code…</div>
        )}
        {webhookError && <p className="text-xs text-danger">Webhook não registrado: {webhookError}. As respostas não vão aparecer em Conversas até resolver.</p>}
      </div>
    </Modal>
  );
}
