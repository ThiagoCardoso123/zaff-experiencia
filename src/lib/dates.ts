import { TIMEZONE, TZ_OFFSET } from "./constants";

const partsFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export interface LocalParts {
  /** AAAA-MM-DD no fuso do restaurante */
  ymd: string;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  /** 0–23 */
  hour: number;
}

export function localParts(iso: string | Date): LocalParts {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const p: Record<string, string> = {};
  for (const part of partsFmt.formatToParts(d)) p[part.type] = part.value;
  return {
    ymd: `${p.year}-${p.month}-${p.day}`,
    weekday: WD[p.weekday] ?? 0,
    hour: Number(p.hour) % 24,
  };
}

export const startOfLocalDay = (ymd: string) => new Date(`${ymd}T00:00:00${TZ_OFFSET}`);

export function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export type PeriodKey = "hoje" | "7d" | "30d" | "mes" | "custom";

export interface Range {
  /** início inclusivo */
  from: Date;
  /** fim exclusivo */
  to: Date;
  /** período imediatamente anterior, de mesma duração */
  prevFrom: Date;
  fromYmd: string;
  /** último dia incluído */
  toYmd: string;
  days: number;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(
  period: PeriodKey,
  customFrom?: string,
  customTo?: string,
  now: Date = new Date(),
): Range {
  const today = localParts(now).ymd;
  let fromYmd = today;
  let toYmd = today;

  if (period === "7d") fromYmd = addDays(today, -6);
  else if (period === "30d") fromYmd = addDays(today, -29);
  else if (period === "mes") fromYmd = `${today.slice(0, 8)}01`;
  else if (period === "custom" && customFrom && customTo && YMD.test(customFrom) && YMD.test(customTo)) {
    fromYmd = customFrom <= customTo ? customFrom : customTo;
    toYmd = customFrom <= customTo ? customTo : customFrom;
  }

  const from = startOfLocalDay(fromYmd);
  const to = startOfLocalDay(addDays(toYmd, 1));
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000));
  const prevFrom = startOfLocalDay(addDays(fromYmd, -days));
  return { from, to, prevFrom, fromYmd, toYmd, days };
}

const dtFmt = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIMEZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDateTime = (iso: string) => dtFmt.format(new Date(iso)).replace(",", " às");

export const formatYmd = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
