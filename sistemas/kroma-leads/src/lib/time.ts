/**
 * Datas no fuso de envio (padrão America/Sao_Paulo), sem depender do fuso
 * do servidor (a Vercel roda em UTC).
 */

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = domingo … 6 = sábado
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      weekday: "short", hourCycle: "h23",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(date: Date, tz: string): LocalParts {
  const p: Record<string, string> = {};
  for (const part of fmt(tz).formatToParts(date)) p[part.type] = part.value;
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour % 24, minute: +p.minute, second: +p.second,
    weekday: WD[p.weekday],
  };
}

/** "2026-09-23" no fuso */
export function localDateKey(date: Date, tz: string): string {
  const p = localParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Converte horário local (no fuso) para o instante UTC correspondente */
export function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, ss: number, tz: string): Date {
  let guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const target = Date.UTC(y, m - 1, d, hh, mm, ss);
    const diff = target - asUtc;
    if (diff === 0) break;
    guess += diff;
  }
  return new Date(guess);
}

export function parseHHMM(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 9, m: Number.isFinite(m) ? m : 0 };
}

// ------------------------------------------------------------------
// Feriados nacionais (Brasil) + Carnaval e Corpus Christi (ponto
// facultativo, mas o comércio para — melhor não mandar)
// ------------------------------------------------------------------
function easter(year: number): { m: number; d: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: month, d: day };
}

const holidayCache = new Map<number, Set<string>>();

export function brazilHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const key = (m: number, d: number) => `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const set = new Set<string>([
    key(1, 1), key(4, 21), key(5, 1), key(9, 7), key(10, 12),
    key(11, 2), key(11, 15), key(11, 20), key(12, 25),
  ]);
  const e = easter(year);
  const base = Date.UTC(year, e.m - 1, e.d);
  const offset = (days: number) => {
    const dt = new Date(base + days * 86400000);
    return key(dt.getUTCMonth() + 1, dt.getUTCDate());
  };
  set.add(offset(-48)); // segunda de Carnaval
  set.add(offset(-47)); // terça de Carnaval
  set.add(offset(-2)); // Sexta-feira Santa
  set.add(offset(60)); // Corpus Christi
  holidayCache.set(year, set);
  return set;
}

export function isHoliday(dateKey: string): boolean {
  const year = Number(dateKey.slice(0, 4));
  return brazilHolidays(year).has(dateKey);
}

/** Soma dias a uma data-chave "YYYY-MM-DD" */
export function addDaysKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86400000);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayOfKey(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetweenKeys(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
