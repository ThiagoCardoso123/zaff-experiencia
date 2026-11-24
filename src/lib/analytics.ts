import {
  CATEGORY_KEYS,
  CATEGORY_LABELS,
  HOUR_BANDS,
  WEEKDAY_SHORT,
  isNegative,
  isPositive,
} from "./constants";
import { addDays, localParts } from "./dates";
import type { CategoryKey, Review } from "./types";

/** Subconjunto de Review suficiente para os cálculos. */
export type ReviewRow = Pick<
  Review,
  | "created_at"
  | "overall"
  | "food"
  | "service"
  | "ambience"
  | "wait_time"
  | "nps"
  | "tags"
  | "table_label"
  | "status"
>;

export interface RowFilters {
  weekday?: number | null;
  hourBand?: string | null;
  table?: string | null;
}

export function applyFilters<T extends ReviewRow>(rows: T[], f: RowFilters): T[] {
  const band = f.hourBand ? HOUR_BANDS.find((b) => b.key === f.hourBand) : null;
  return rows.filter((r) => {
    if (f.table && r.table_label !== f.table) return false;
    if (f.weekday == null && !band) return true;
    const p = localParts(r.created_at);
    if (f.weekday != null && p.weekday !== f.weekday) return false;
    if (band && !(p.hour >= band.from && p.hour < band.to)) return false;
    return true;
  });
}

export const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

const pct = (part: number, total: number): number | null =>
  total ? (part / total) * 100 : null;

export interface CategoryStat {
  key: CategoryKey;
  label: string;
  avg: number | null;
  n: number;
  /** quantidade de notas 1..5 (índice 0 = nota 1) */
  distribution: number[];
}

export interface NpsStat {
  score: number | null;
  n: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export interface Metrics {
  total: number;
  avgOverall: number | null;
  /** média de todas as notas de 1 a 5 (geral + categorias), em escala 0–100 */
  satisfactionIndex: number | null;
  nps: NpsStat;
  positivePct: number | null;
  negativePct: number | null;
  neutralPct: number | null;
  positive: number;
  negative: number;
  neutral: number;
  categories: CategoryStat[];
}

export function categoryValues(rows: ReviewRow[], key: CategoryKey): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = r[key];
    if (typeof v === "number") out.push(v);
  }
  return out;
}

export function computeNps(rows: ReviewRow[]): NpsStat {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const r of rows) {
    if (typeof r.nps !== "number") continue;
    if (r.nps >= 9) promoters++;
    else if (r.nps >= 7) passives++;
    else detractors++;
  }
  const n = promoters + passives + detractors;
  return {
    n,
    promoters,
    passives,
    detractors,
    score: n ? Math.round(((promoters - detractors) / n) * 100) : null,
  };
}

export function computeMetrics(rows: ReviewRow[]): Metrics {
  const total = rows.length;
  const positive = rows.filter((r) => isPositive(r.overall)).length;
  const negative = rows.filter((r) => isNegative(r.overall)).length;
  const neutral = total - positive - negative;

  const allScores: number[] = rows.map((r) => r.overall);
  const categories = CATEGORY_KEYS.map<CategoryStat>((key) => {
    const values = categoryValues(rows, key);
    allScores.push(...values);
    const distribution = [0, 0, 0, 0, 0];
    for (const v of values) distribution[v - 1]++;
    return { key, label: CATEGORY_LABELS[key], avg: mean(values), n: values.length, distribution };
  });

  const overallMean = mean(allScores);

  return {
    total,
    avgOverall: mean(rows.map((r) => r.overall)),
    satisfactionIndex: overallMean == null ? null : ((overallMean - 1) / 4) * 100,
    nps: computeNps(rows),
    positivePct: pct(positive, total),
    negativePct: pct(negative, total),
    neutralPct: pct(neutral, total),
    positive,
    negative,
    neutral,
    categories,
  };
}

export interface SeriesPoint {
  /** rótulo do eixo (DD/MM) */
  label: string;
  ymd: string;
  avg: number | null;
  n: number;
}

/**
 * Evolução da satisfação. Agrupa por dia; em períodos acima de 92 dias, por semana.
 * Dias sem avaliações aparecem com média nula (lacuna no gráfico), nunca com zero.
 */
export function buildSeries(rows: ReviewRow[], fromYmd: string, toYmd: string): SeriesPoint[] {
  const byDay = new Map<string, number[]>();
  for (const r of rows) {
    const { ymd } = localParts(r.created_at);
    const list = byDay.get(ymd);
    if (list) list.push(r.overall);
    else byDay.set(ymd, [r.overall]);
  }

  const days: string[] = [];
  for (let d = fromYmd; d <= toYmd && days.length < 800; d = addDays(d, 1)) days.push(d);

  const step = days.length > 92 ? 7 : 1;
  const out: SeriesPoint[] = [];
  for (let i = 0; i < days.length; i += step) {
    const chunk = days.slice(i, i + step);
    const values = chunk.flatMap((d) => byDay.get(d) ?? []);
    const ymd = chunk[0];
    out.push({
      ymd,
      label: `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`,
      avg: mean(values),
      n: values.length,
    });
  }
  return out;
}

export interface BucketStat {
  label: string;
  avg: number | null;
  n: number;
  negatives: number;
}

export function byWeekday(rows: ReviewRow[]): BucketStat[] {
  const buckets = WEEKDAY_SHORT.map(() => [] as number[]);
  for (const r of rows) buckets[localParts(r.created_at).weekday].push(r.overall);
  return buckets.map((values, i) => ({
    label: WEEKDAY_SHORT[i],
    avg: mean(values),
    n: values.length,
    negatives: values.filter(isNegative).length,
  }));
}

export function byHour(rows: ReviewRow[]): (BucketStat & { hour: number })[] {
  const buckets = Array.from({ length: 24 }, () => [] as number[]);
  for (const r of rows) buckets[localParts(r.created_at).hour].push(r.overall);
  return buckets.map((values, hour) => ({
    hour,
    label: `${hour}h`,
    avg: mean(values),
    n: values.length,
    negatives: values.filter(isNegative).length,
  }));
}

export function tagCounts(rows: ReviewRow[]): { tag: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) for (const t of r.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export const fmt1 = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtPct = (v: number | null) => (v == null ? "—" : `${Math.round(v)}%`);
