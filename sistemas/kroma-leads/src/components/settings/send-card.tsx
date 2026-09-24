"use client";
import { ShieldAlert, Timer, Flame, PauseCircle } from "lucide-react";
import { Card, Chip, Input, Label, Toggle } from "@/components/ui";
import type { AutopauseConfig, SendConfig, WarmupConfig } from "@/lib/types";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function Num({ label, value, onChange, min = 0, max = 100000, suffix, hint }: {
  label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; suffix?: string; hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        <Input type="number" min={min} max={max} value={value}
          onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className={suffix ? "pr-14" : ""} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">{suffix}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function SendCard({ send, warmup, autopause, onSend, onWarmup, onAutopause }: {
  send: SendConfig; warmup: WarmupConfig; autopause: AutopauseConfig;
  onSend: (s: SendConfig) => void; onWarmup: (w: WarmupConfig) => void; onAutopause: (a: AutopauseConfig) => void;
}) {
  const s = (patch: Partial<SendConfig>) => onSend({ ...send, ...patch });
  const a = (patch: Partial<AutopauseConfig>) => onAutopause({ ...autopause, ...patch });
  const weeks = [...warmup.weeks].sort((x, y) => x.week - y.week);

  return (
    <Card title="Envio (anti-bloqueio)" icon={<ShieldAlert className="size-4" />}>
      <p className="mb-5 text-sm text-muted">
        Tudo aqui existe pra seu número parecer uma pessoa digitando, não um robô. Os padrões já são seguros. Só mexa se souber o porquê.
      </p>

      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink"><Timer className="size-3.5 text-cyan" /> Ritmo</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Num label="Intervalo mínimo" suffix="seg" value={send.min_interval_s} min={20} max={3600} onChange={(v) => s({ min_interval_s: v })} />
        <Num label="Intervalo máximo" suffix="seg" value={send.max_interval_s} min={send.min_interval_s} max={7200} onChange={(v) => s({ max_interval_s: v })} />
        <Num label="Digitando… mín." suffix="seg" value={send.typing_min_s} min={1} max={30} onChange={(v) => s({ typing_min_s: v })} />
        <Num label="Digitando… máx." suffix="seg" value={send.typing_max_s} min={send.typing_min_s} max={60} onChange={(v) => s({ typing_max_s: v })} />
      </div>
      <p className="mt-2 text-xs text-faint">O intervalo é sorteado a cada mensagem, com segundos quebrados. O &quot;digitando…&quot; é proporcional ao tamanho do texto.</p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Num label="Pausa longa a cada (mín.)" suffix="msgs" value={send.long_pause_every_min} min={2} max={100} onChange={(v) => s({ long_pause_every_min: v })} />
        <Num label="Pausa longa a cada (máx.)" suffix="msgs" value={send.long_pause_every_max} min={send.long_pause_every_min} max={100} onChange={(v) => s({ long_pause_every_max: v })} />
        <Num label="Duração da pausa (mín.)" suffix="min" value={send.long_pause_min_min} min={1} max={180} onChange={(v) => s({ long_pause_min_min: v })} />
        <Num label="Duração da pausa (máx.)" suffix="min" value={send.long_pause_max_min} min={send.long_pause_min_min} max={240} onChange={(v) => s({ long_pause_max_min: v })} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Janela de horário (Brasília)</Label>
          <div className="flex items-center gap-2">
            <Input type="time" value={send.window_start} onChange={(e) => s({ window_start: e.target.value })} />
            <span className="text-muted">até</span>
            <Input type="time" value={send.window_end} onChange={(e) => s({ window_end: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Dias de envio</Label>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d, i) => (
              <Chip key={d} active={send.weekdays.includes(i)}
                onClick={() => s({ weekdays: send.weekdays.includes(i) ? send.weekdays.filter((x) => x !== i) : [...send.weekdays, i].sort() })}>
                {d}
              </Chip>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <Toggle checked={send.skip_holidays} onChange={(v) => s({ skip_holidays: v })} label={<span className="text-sm text-ink">Não enviar em feriados nacionais (inclui Carnaval e Corpus Christi)</span>} />
      </div>

      <h3 className="mb-3 mt-7 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink"><Flame className="size-3.5 text-cyan" /> Aquecimento (mensagens por dia, por número)</h3>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="bg-card2 text-left text-[11px] uppercase tracking-wider text-muted">
            <tr><th className="px-3 py-2">Fase</th><th className="px-3 py-2">Mínimo</th><th className="px-3 py-2">Máximo</th></tr>
          </thead>
          <tbody>
            {weeks.map((w, i) => (
              <tr key={w.week} className="border-t border-line">
                <td className="px-3 py-2 text-ink">{i === weeks.length - 1 ? `Semana ${w.week} em diante` : `Semana ${w.week}`}</td>
                {(["min", "max"] as const).map((k) => (
                  <td key={k} className="px-3 py-2">
                    <Input type="number" className="h-8 w-24" value={w[k]} min={1} max={500}
                      onChange={(e) => onWarmup({ ...warmup, weeks: weeks.map((x) => (x.week === w.week ? { ...x, [k]: Number(e.target.value) || 1 } : x)) })} />
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t border-line">
              <td className="px-3 py-2 text-ink">
                Maduro: a partir da semana{" "}
                <Input type="number" className="mx-1 inline-block h-8 w-16" value={warmup.mature.after_weeks} min={2} max={52}
                  onChange={(e) => onWarmup({ ...warmup, mature: { ...warmup.mature, after_weeks: Number(e.target.value) || 5 } })} />{" "}
                com resposta ≥{" "}
                <Input type="number" className="mx-1 inline-block h-8 w-16" value={warmup.mature.min_reply_rate} min={0} max={100}
                  onChange={(e) => onWarmup({ ...warmup, mature: { ...warmup.mature, min_reply_rate: Number(e.target.value) || 0 } })} /> %
              </td>
              {(["min", "max"] as const).map((k) => (
                <td key={k} className="px-3 py-2">
                  <Input type="number" className="h-8 w-24" value={warmup.mature[k]} min={1} max={500}
                    onChange={(e) => onWarmup({ ...warmup, mature: { ...warmup.mature, [k]: Number(e.target.value) || 1 } })} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-3 max-w-xs">
        <Num label="Teto diário absoluto" suffix="msgs" value={warmup.daily_cap} min={1} max={500} onChange={(v) => onWarmup({ ...warmup, daily_cap: v })}
          hint="Nenhum número passa disso, em nenhuma fase." />
      </div>
      <p className="mt-2 text-xs text-faint">Contado a partir da data de início de cada número (tela WhatsApp). O que passar do limite vai pro próximo dia útil.</p>

      <h3 className="mb-3 mt-7 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink"><PauseCircle className="size-3.5 text-cyan" /> Pausa automática do número</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Num label="Falhas seguidas" value={autopause.max_consecutive_failures} min={1} max={20} onChange={(v) => a({ max_consecutive_failures: v })} hint="Pausa após N erros de envio em sequência." />
        <Num label="Taxa de resposta mínima" suffix="%" value={autopause.min_reply_rate} min={0} max={100} onChange={(v) => a({ min_reply_rate: v })} />
        <Num label="…avaliada depois de" suffix="contatos" value={autopause.min_reply_rate_after} min={5} max={1000} onChange={(v) => a({ min_reply_rate_after: v })} />
        <Num label="Pedidos de saída" value={autopause.optout_streak} min={1} max={20} onChange={(v) => a({ optout_streak: v })} hint="Pausa se tiver N pedidos de saída…" />
        <Num label="…nas últimas" suffix="respostas" value={autopause.optout_window} min={autopause.optout_streak} max={50} onChange={(v) => a({ optout_window: v })} />
      </div>
      <p className="mt-2 text-xs text-faint">Também pausa na hora se a instância desconectar ou o WhatsApp sinalizar restrição. Retomar é sempre manual.</p>
    </Card>
  );
}
