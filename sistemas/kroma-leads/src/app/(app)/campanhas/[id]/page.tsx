"use client";
import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, PauseCircle, PlayCircle, XCircle, AlertTriangle, Clock, Trash2 } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { api, fmtDateTime } from "@/lib/client";
import { Badge, Button, Card, Empty, PageHeader, Progress, Spinner, cn } from "@/components/ui";
import { CampaignStatusBadge } from "@/components/campaigns/status";
import type { Campaign, CampaignStats } from "@/lib/types";

interface QueueItem {
  id: string; status: string; scheduled_at: string | null; sent_at: string | null; error: string | null; rendered_text: string | null;
  leads: { name: string } | null; whatsapp_numbers: { label: string } | null;
}

export default function CampaignDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sb = supabaseBrowser();
  const router = useRouter();
  const [camp, setCamp] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [upcoming, setUpcoming] = useState<QueueItem[]>([]);
  const [recent, setRecent] = useState<QueueItem[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const sel = "id,status,scheduled_at,sent_at,error,rendered_text,leads(name),whatsapp_numbers(label)";
    const [c, s, up, rc, t] = await Promise.all([
      sb.from("campaigns").select("*").eq("id", id).maybeSingle(),
      sb.from("campaign_stats").select("*").eq("campaign_id", id).maybeSingle(),
      sb.from("message_queue").select(sel).eq("campaign_id", id).eq("status", "scheduled").order("scheduled_at").limit(15),
      sb.from("message_queue").select(sel).eq("campaign_id", id).in("status", ["sent", "failed", "skipped", "cancelled"]).order("sent_at", { ascending: false, nullsFirst: false }).limit(30),
      sb.from("campaign_templates").select("body").eq("campaign_id", id).order("position"),
    ]);
    if (!c.data) { setMissing(true); return; }
    setCamp(c.data as Campaign);
    setStats(s.data as CampaignStats);
    setUpcoming((up.data ?? []) as unknown as QueueItem[]);
    setRecent((rc.data ?? []) as unknown as QueueItem[]);
    setTemplates((t.data ?? []).map((x: { body: string }) => x.body));
  }, [id, sb]);

  useEffect(() => {
    load();
    const ch = sb.channel(`camp-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "campaigns", filter: `id=eq.${id}` }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, load)
      .subscribe();
    const t = setInterval(load, 20_000);
    return () => { clearInterval(t); sb.removeChannel(ch); };
  }, [id, load, sb]);

  async function run(action: "pause" | "resume" | "cancel", msg: string) {
    if (action === "cancel" && !confirm("Cancelar a campanha? As mensagens que ainda não saíram não vão ser enviadas.")) return;
    setBusy(action);
    try {
      await api(`/api/campaigns/${id}/${action}`, {});
      toast.success(msg);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function remove() {
    if (!confirm("Apagar essa campanha? O histórico de mensagens dos leads continua.")) return;
    await sb.from("campaigns").delete().eq("id", id);
    router.push("/campanhas");
  }

  if (missing) return <Card><Empty title="Campanha não encontrada." /></Card>;
  if (!camp || !stats) return <div className="flex justify-center py-20"><Spinner /></div>;

  const done = stats.sent + stats.failed + stats.skipped;
  const rate = stats.sent ? (stats.replies / stats.sent) * 100 : 0;
  const metrics: [string, string | number, string?][] = [
    ["Enviadas", stats.sent],
    ["Entregues", stats.delivered],
    ["Lidas", stats.read, "Só aparece se o contato não desligou a confirmação de leitura."],
    ["Respostas", stats.replies],
    ["Taxa de resposta", `${rate.toFixed(1)}%`],
    ["Pedidos de saída", stats.optouts],
    ["Falhas", stats.failed],
    ["Agendadas", stats.scheduled],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/campanhas" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Campanhas</Link>
      <PageHeader title={camp.name} subtitle={<span className="inline-flex flex-wrap items-center gap-2"><CampaignStatusBadge status={camp.status} />{camp.started_at && <span>Iniciada em {fmtDateTime(camp.started_at)}</span>}</span>}>
        {camp.status === "running" && <Button variant="secondary" icon={<PauseCircle className="size-4" />} loading={busy === "pause"} onClick={() => run("pause", "Campanha pausada.")}>Pausar</Button>}
        {camp.status === "paused" && <Button variant="primary" icon={<PlayCircle className="size-4" />} loading={busy === "resume"} onClick={() => run("resume", "Campanha retomada. A fila foi reagendada a partir de agora.")}>Retomar</Button>}
        {["running", "paused"].includes(camp.status) && <Button variant="danger" icon={<XCircle className="size-4" />} loading={busy === "cancel"} onClick={() => run("cancel", "Campanha cancelada.")}>Cancelar</Button>}
        {["draft", "completed", "cancelled"].includes(camp.status) && <Button variant="ghost" icon={<Trash2 className="size-4" />} onClick={remove}>Apagar</Button>}
      </PageHeader>

      {camp.status === "paused" && camp.pause_reason && (
        <div className="mb-5 flex gap-2 rounded-xl border border-violet/30 bg-violet/[0.06] p-4 text-sm text-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-violet" /> {camp.pause_reason}
        </div>
      )}

      <Card className="mb-5">
        <div className="mb-2 flex justify-between text-sm"><span className="text-muted">Progresso</span><span className="text-ink">{done} de {stats.total}</span></div>
        <Progress value={done} max={stats.total} />
        {stats.next_send_at && camp.status === "running" && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" /> Próximo envio: {fmtDateTime(stats.next_send_at)}</p>
        )}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {metrics.map(([l, v, hint]) => (
            <div key={l} className="rounded-lg bg-card2 px-3 py-3" title={hint}>
              <div className={cn("text-xl font-semibold", l === "Taxa de resposta" ? "text-cyan" : "text-strong")}>{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted">{l}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Próximos envios">
          {upcoming.length === 0 ? <p className="text-sm text-muted">Nada agendado.</p> : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((q) => (
                <li key={q.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-ink">{q.leads?.name ?? "Lead removido"}</span>
                  <span className="shrink-0 text-xs text-muted">{q.whatsapp_numbers?.label} · {fmtDateTime(q.scheduled_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Últimos processados">
          {recent.length === 0 ? <p className="text-sm text-muted">Nada enviado ainda.</p> : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((q) => (
                <li key={q.id} className="py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-ink">{q.leads?.name ?? "Lead removido"}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      {q.status === "sent" ? <Badge tone="cyan">Enviada</Badge> : q.status === "failed" ? <Badge tone="danger">Falhou</Badge> : <Badge>{q.status === "skipped" ? "Pulada" : "Cancelada"}</Badge>}
                      {fmtDateTime(q.sent_at)}
                    </span>
                  </div>
                  {q.error && <div className="mt-0.5 text-xs text-faint">{q.error}</div>}
                  {q.rendered_text && q.status === "sent" && <div className="mt-1 line-clamp-2 text-xs text-muted">{q.rendered_text}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-5" title={`Modelos (${templates.length})${camp.use_ai ? " + IA" : ""}`}>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
          {templates.map((t, i) => <li key={i} className="whitespace-pre-wrap">{t}</li>)}
        </ol>
      </Card>
    </div>
  );
}
