"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BucketStat, SeriesPoint } from "@/lib/analytics";

/* Convenções dos gráficos do painel
   • um eixo por gráfico (nunca dois eixos Y);
   • marcas finas na cor da marca; grade e eixos discretos;
   • textos sempre na cor de texto, nunca na cor da série;
   • toda marca tem tooltip com o valor e o tamanho da amostra. */

const INK = "#2b1b17";
const MUTED = "#7a6a62";
const GRID = "#e9e4d8";
const BRAND = "var(--zf-primary)";
// caramelo da marca, um passo mais escuro para manter contraste 3:1 sobre o cartão branco
const CARAMEL = "#a67c52";

const axis = {
  tick: { fill: MUTED, fontSize: 12 },
  axisLine: { stroke: GRID },
  tickLine: false,
} as const;

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function TooltipBox({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-sm" style={{ color: INK }}>
      <p className="mb-0.5 font-medium">{title}</p>
      {lines.map((l) => (
        <p key={l} style={{ color: MUTED }}>{l}</p>
      ))}
    </div>
  );
}

const plural = (n: number) => `${n} ${n === 1 ? "avaliação" : "avaliações"}`;

/** Evolução da satisfação: média da nota geral por dia (ou semana). */
export function TrendChart({ data }: { data: SeriesPoint[] }) {
  const dense = data.length > 45;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={28} />
        <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...axis} axisLine={false} />
        <Tooltip
          cursor={{ stroke: MUTED, strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as SeriesPoint | undefined;
            if (!active || !p) return null;
            return (
              <TooltipBox
                title={p.label}
                lines={p.n ? [`Média ${fmt(p.avg ?? 0)} de 5`, plural(p.n)] : ["Sem avaliações"]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="avg"
          name="Média da experiência geral"
          stroke={BRAND}
          strokeWidth={2}
          connectNulls={false}
          dot={dense ? false : { r: 3, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
          activeDot={{ r: 5, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Volume de avaliações no mesmo eixo de tempo (gráfico separado: um eixo por gráfico). */
export function VolumeChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={110}>
      <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: -18 }}>
        <XAxis dataKey="label" {...axis} minTickGap={28} />
        <YAxis allowDecimals={false} {...axis} axisLine={false} width={48} />
        <Tooltip
          cursor={{ fill: GRID, opacity: 0.6 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as SeriesPoint | undefined;
            return active && p ? <TooltipBox title={p.label} lines={[plural(p.n)]} /> : null;
          }}
        />
        <Bar dataKey="n" name="Avaliações" fill={CARAMEL} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Distribuição das notas (1 a 5 estrelas) de uma categoria. */
export function DistributionChart({ distribution }: { distribution: number[] }) {
  const data = distribution.map((count, i) => ({ label: `${i + 1}★`, count }));
  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" {...axis} />
        <Tooltip
          cursor={{ fill: GRID, opacity: 0.6 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as { label: string; count: number } | undefined;
            return active && p ? (
              <TooltipBox title={`Nota ${p.label}`} lines={[`${p.count} ${p.count === 1 ? "resposta" : "respostas"}`]} />
            ) : null;
          }}
        />
        <Bar dataKey="count" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={34} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Média da experiência geral por dia da semana. */
export function WeekdayChart({ data }: { data: BucketStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} />
        <YAxis domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} {...axis} axisLine={false} />
        <Tooltip
          cursor={{ fill: GRID, opacity: 0.6 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as BucketStat | undefined;
            if (!active || !p) return null;
            return (
              <TooltipBox
                title={p.label}
                lines={p.n ? [`Média ${fmt(p.avg ?? 0)} de 5`, plural(p.n)] : ["Sem avaliações"]}
              />
            );
          }}
        />
        <Bar dataKey="avg" fill={BRAND} radius={[4, 4, 0, 0]} maxBarSize={40} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Avaliações por horário, destacando as negativas (nota ≤ 2). */
export function HourChart({ data }: { data: (BucketStat & { hour: number })[] }) {
  const withData = data.filter((d) => d.n > 0);
  const first = withData.length ? withData[0].hour : 0;
  const last = withData.length ? withData[withData.length - 1].hour : 23;
  const rows = data
    .filter((d) => d.hour >= first && d.hour <= last)
    .map((d) => ({ ...d, others: d.n - d.negatives }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows} margin={{ top: 10, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" {...axis} minTickGap={8} />
        <YAxis allowDecimals={false} {...axis} axisLine={false} />
        <Tooltip
          cursor={{ fill: GRID, opacity: 0.6 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as (BucketStat & { hour: number }) | undefined;
            if (!active || !p) return null;
            return (
              <TooltipBox
                title={`${p.hour}h às ${p.hour + 1}h`}
                lines={[plural(p.n), `${p.negatives} ${p.negatives === 1 ? "negativa" : "negativas"}`]}
              />
            );
          }}
        />
        <Legend
          verticalAlign="top"
          align="right"
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: MUTED, fontSize: 12 }}>{value}</span>}
        />
        <Bar dataKey="negatives" name="Negativas (nota 1–2)" stackId="a" fill={BRAND} stroke="#fff" strokeWidth={1} maxBarSize={28} isAnimationActive={false} />
        <Bar dataKey="others" name="Demais avaliações" stackId="a" fill={CARAMEL} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
