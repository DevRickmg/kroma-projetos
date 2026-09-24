/**
 * Agenda do disparo. Funções puras (testáveis): recebem o estado dos números
 * e devolvem um scheduled_at para cada mensagem, respeitando:
 *  - intervalo aleatório (nunca redondo) entre mensagens
 *  - pausa longa a cada 8–10 mensagens (sorteado a cada ciclo)
 *  - janela de horário + dias da semana + feriados
 *  - limite diário por número conforme o aquecimento
 *  - rodízio entre números (cada mensagem vai pro número livre mais cedo)
 */
import type { SendConfig, WarmupConfig } from "../types";
import {
  addDaysKey, daysBetweenKeys, isHoliday, localDateKey, parseHHMM, zonedToUtc,
} from "../time";

export type Rng = () => number;

export interface NumberPlanState {
  id: string;
  warmupStart: string; // "YYYY-MM-DD"
  replyRate: number | null; // % (null = poucos dados)
  perDay: Map<string, number>; // mensagens já enviadas/agendadas por dia local
  cursor: Date; // horário da última mensagem agendada (ou agora)
  sinceLongPause: number;
  longPauseEvery: number;
}

export interface PlannedMessage {
  id: string;
  number_id: string;
  scheduled_at: Date;
}

function randBetween(rng: Rng, min: number, max: number): number {
  return min + rng() * Math.max(0, max - min);
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(min + rng() * (max - min + 1));
}

/** pseudo-aleatório determinístico: o mesmo número no mesmo dia tem sempre o mesmo limite */
function seeded(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function warmupWeek(warmupStart: string, dateKey: string): number {
  return Math.max(1, Math.floor(daysBetweenKeys(warmupStart, dateKey) / 7) + 1);
}

export function dailyLimit(
  numberId: string, warmupStart: string, dateKey: string, replyRate: number | null, w: WarmupConfig,
): number {
  const week = warmupWeek(warmupStart, dateKey);
  let range = { min: 10, max: 20 };
  const sorted = [...w.weeks].sort((a, b) => a.week - b.week);
  for (const r of sorted) if (week >= r.week) range = r;
  if (week >= w.mature.after_weeks && replyRate !== null && replyRate >= w.mature.min_reply_rate) {
    range = w.mature;
  }
  const pick = range.min + Math.floor(seeded(`${numberId}:${dateKey}`) * (range.max - range.min + 1));
  return Math.max(0, Math.min(pick, w.daily_cap));
}

export function isSendDay(dateKey: string, cfg: SendConfig): boolean {
  const [y, m, d] = dateKey.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (!cfg.weekdays.includes(wd)) return false;
  if (cfg.skip_holidays && isHoliday(dateKey)) return false;
  return true;
}

function windowBounds(dateKey: string, cfg: SendConfig): { start: Date; end: Date } {
  const [y, m, d] = dateKey.split("-").map(Number);
  const s = parseHHMM(cfg.window_start);
  const e = parseHHMM(cfg.window_end);
  return {
    start: zonedToUtc(y, m, d, s.h, s.m, 0, cfg.timezone),
    end: zonedToUtc(y, m, d, e.h, e.m, 0, cfg.timezone),
  };
}

/** Primeiro horário válido >= t para esse número (janela, dia útil, limite diário). */
export function nextValidSlot(t: Date, st: NumberPlanState, cfg: SendConfig, w: WarmupConfig, rng: Rng): Date {
  let cur = new Date(t);
  for (let guard = 0; guard < 400; guard++) {
    const key = localDateKey(cur, cfg.timezone);
    const { start, end } = windowBounds(key, cfg);
    const nextDay = () => {
      let k = addDaysKey(key, 1);
      for (let i = 0; i < 30 && !isSendDay(k, cfg); i++) k = addDaysKey(k, 1);
      const b = windowBounds(k, cfg);
      // começa uns minutos depois do início da janela, nunca no horário cravado
      return new Date(b.start.getTime() + randBetween(rng, 90, 1500) * 1000 + Math.floor(rng() * 1000));
    };
    if (!isSendDay(key, cfg)) { cur = nextDay(); continue; }
    if (cur < start) { cur = new Date(start.getTime() + randBetween(rng, 90, 1500) * 1000 + Math.floor(rng() * 1000)); continue; }
    if (cur >= end) { cur = nextDay(); continue; }
    const limit = dailyLimit(st.id, st.warmupStart, key, st.replyRate, w);
    if ((st.perDay.get(key) ?? 0) >= limit) { cur = nextDay(); continue; }
    return cur;
  }
  throw new Error("Não foi possível encontrar um horário de envio válido. Revise a janela e os dias de envio.");
}

export function randomInterval(cfg: SendConfig, rng: Rng): number {
  // segundos quebrados + milissegundos: nunca um intervalo redondo
  return randBetween(rng, cfg.min_interval_s, cfg.max_interval_s) * 1000 + Math.floor(rng() * 1000);
}

export function randomLongPause(cfg: SendConfig, rng: Rng): number {
  return randBetween(rng, cfg.long_pause_min_min * 60, cfg.long_pause_max_min * 60) * 1000 + Math.floor(rng() * 1000);
}

export function newLongPauseEvery(cfg: SendConfig, rng: Rng): number {
  return randInt(rng, cfg.long_pause_every_min, cfg.long_pause_every_max);
}

export function planSchedule(
  itemIds: string[],
  numbers: NumberPlanState[],
  cfg: SendConfig,
  w: WarmupConfig,
  rng: Rng = Math.random,
): PlannedMessage[] {
  if (!numbers.length) throw new Error("Nenhum número disponível para a campanha.");
  const out: PlannedMessage[] = [];
  for (const id of itemIds) {
    let best: { st: NumberPlanState; at: Date } | null = null;
    for (const st of numbers) {
      const at = nextValidSlot(new Date(st.cursor.getTime() + randomInterval(cfg, rng)), st, cfg, w, rng);
      if (!best || at < best.at) best = { st, at };
    }
    const { st, at } = best!;
    const key = localDateKey(at, cfg.timezone);
    st.perDay.set(key, (st.perDay.get(key) ?? 0) + 1);
    st.cursor = at;
    st.sinceLongPause++;
    if (st.sinceLongPause >= st.longPauseEvery) {
      st.cursor = new Date(at.getTime() + randomLongPause(cfg, rng));
      st.sinceLongPause = 0;
      st.longPauseEvery = newLongPauseEvery(cfg, rng);
    }
    out.push({ id, number_id: st.id, scheduled_at: at });
  }
  return out;
}

/** "digitando…" proporcional ao tamanho da mensagem, dentro do mínimo/máximo */
export function typingMs(text: string, cfg: SendConfig, rng: Rng = Math.random): number {
  const min = cfg.typing_min_s * 1000;
  const max = cfg.typing_max_s * 1000;
  const proportional = min + (text.length / 300) * (max - min);
  const jitter = randBetween(rng, -600, 600);
  return Math.round(Math.max(min, Math.min(max, proportional + jitter)));
}

export function isWithinWindow(now: Date, cfg: SendConfig): boolean {
  const key = localDateKey(now, cfg.timezone);
  if (!isSendDay(key, cfg)) return false;
  const { start, end } = windowBounds(key, cfg);
  return now >= start && now < end;
}

