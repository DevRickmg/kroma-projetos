"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plus, Send, ChevronRight } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { fmtDateTime } from "@/lib/client";
import { Button, Card, Empty, PageHeader, Progress, Spinner } from "@/components/ui";
import { CampaignStatusBadge } from "@/components/campaigns/status";
import type { Campaign, CampaignStats } from "@/lib/types";

export default function CampanhasPage() {
  const sb = supabaseBrowser();
  const [camps, setCamps] = useState<Campaign[] | null>(null);
  const [stats, setStats] = useState<Record<string, CampaignStats>>({});

  const load = useCallback(async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      sb.from("campaigns").select("*").order("created_at", { ascending: false }),
      sb.from("campaign_stats").select("*"),
    ]);
    setCamps((c ?? []) as Campaign[]);
    setStats(Object.fromEntries(((s ?? []) as CampaignStats[]).map((x) => [x.campaign_id, x])));
  }, [sb]);

  useEffect(() => {
    load();
    const ch = sb.channel("campaigns-list").on("postgres_changes", { event: "*", schema: "public", table: "campaigns" }, load).subscribe();
    const t = setInterval(load, 30_000);
    return () => { clearInterval(t); sb.removeChannel(ch); };
  }, [load, sb]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Campanhas" subtitle="Disparo no WhatsApp com ritmo humano, horário comercial e pausa automática.">
        <Link href="/campanhas/nova"><Button variant="cta" icon={<Plus className="size-4" />}>Nova campanha</Button></Link>
      </PageHeader>
      {camps === null ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : camps.length === 0 ? (
        <Card><Empty icon={<Send className="size-8" />} title="Nenhuma campanha ainda.">Selecione leads na tela Leads e clique em &quot;Adicionar a uma campanha&quot;, ou crie uma aqui.</Empty></Card>
      ) : (
        <div className="space-y-3">
          {camps.map((c) => {
            const s = stats[c.id];
            const done = (s?.sent ?? 0) + (s?.failed ?? 0) + (s?.skipped ?? 0);
            const rate = s && s.sent > 0 ? (s.replies / s.sent) * 100 : null;
            return (
              <Link key={c.id} href={`/campanhas/${c.id}`} className="block">
                <Card className="transition hover:border-line2 hover:bg-[#1c2026]">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-semibold text-strong">{c.name}</span>
                        <CampaignStatusBadge status={c.status} />
                      </div>
                      <div className="mt-1 text-xs text-muted">
                        Criada em {fmtDateTime(c.created_at)}
                        {c.status === "running" && s?.next_send_at && <> · próximo envio {fmtDateTime(s.next_send_at)}</>}
                        {c.pause_reason && c.status === "paused" && <> · {c.pause_reason}</>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-5 text-center text-sm">
                      <div><div className="font-semibold text-strong">{s?.sent ?? 0}</div><div className="text-[10px] uppercase tracking-wider text-muted">Enviadas</div></div>
                      <div><div className="font-semibold text-strong">{s?.replies ?? 0}</div><div className="text-[10px] uppercase tracking-wider text-muted">Respostas</div></div>
                      <div><div className="font-semibold text-cyan">{rate === null ? "—" : `${rate.toFixed(0)}%`}</div><div className="text-[10px] uppercase tracking-wider text-muted">Taxa</div></div>
                    </div>
                    <ChevronRight className="size-4 text-faint" />
                  </div>
                  {s && s.total > 0 && <Progress className="mt-4" value={done} max={s.total} />}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
