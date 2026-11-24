import Link from "next/link";
import { Suspense } from "react";
import { DistributionChart, HourChart, TrendChart, VolumeChart, WeekdayChart } from "@/components/admin/Charts";
import { Filters } from "@/components/admin/Filters";
import {
  applyFilters,
  buildSeries,
  byHour,
  byWeekday,
  computeMetrics,
  fmt1,
  fmtPct,
  type ReviewRow,
} from "@/lib/analytics";
import { HOUR_BANDS, WEEKDAY_LABELS } from "@/lib/constants";
import { formatYmd, resolveRange, type PeriodKey } from "@/lib/dates";
import { buildInsights, type Insight } from "@/lib/insights";
import { countCriticalOpen, fetchAll } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const PERIODS: PeriodKey[] = ["hoje", "7d", "30d", "mes", "custom"];

export default async function DashboardPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const period = (PERIODS as string[]).includes(one(sp.periodo)) ? (one(sp.periodo) as PeriodKey) : "30d";
  const range = resolveRange(period, one(sp.de), one(sp.ate));

  const weekdayRaw = one(sp.dia);
  const weekday = /^[0-6]$/.test(weekdayRaw) ? Number(weekdayRaw) : null;
  const hourBand = HOUR_BANDS.some((b) => b.key === one(sp.horario)) ? one(sp.horario) : null;
  const table = one(sp.mesa) || null;

  const supabase = await createClient();
  const [{ rows, truncated }, tablesRes, criticalOpen] = await Promise.all([
    fetchAll<ReviewRow>(() =>
      supabase
        .from("reviews")
        .select("created_at,overall,food,service,ambience,wait_time,nps,tags,table_label,status")
        .gte("created_at", range.prevFrom.toISOString())
        .lt("created_at", range.to.toISOString())
        .order("created_at")
        .order("id"),
    ),
    supabase.from("restaurant_tables").select("label").order("label"),
    countCriticalOpen(supabase),
  ]);

  const filtered = applyFilters(rows, { weekday, hourBand, table });
  const fromIso = range.from.toISOString();
  const current = filtered.filter((r) => r.created_at >= fromIso);
  const previous = filtered.filter((r) => r.created_at < fromIso);

  const m = computeMetrics(current);
  const series = buildSeries(current, range.fromYmd, range.toYmd);
  const { insights, insufficient } = buildInsights(current, previous);

  const ranked = m.categories.filter((c) => c.avg != null && c.n > 0);
  const best = ranked.length > 1 ? [...ranked].sort((a, b) => b.avg! - a.avg!)[0] : null;
  const worst = ranked.length > 1 ? [...ranked].sort((a, b) => a.avg! - b.avg!)[0] : null;
  const distinct = best && worst && best.avg !== worst.avg;

  const tables = (tablesRes.data ?? [])
    .map((t) => t.label as string)
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const scope = [
    range.fromYmd === range.toYmd
      ? formatYmd(range.fromYmd)
      : `${formatYmd(range.fromYmd)} a ${formatYmd(range.toYmd)}`,
    weekday != null ? WEEKDAY_LABELS[weekday] : null,
    hourBand ? HOUR_BANDS.find((b) => b.key === hourBand)?.label : null,
    table ? `Mesa ${table}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-8">
      <header>
        <p className="eyebrow">Zaff Gastronomia</p>
        <h1 className="mt-1 font-display text-4xl text-brand">Visão geral da experiência</h1>
        <p className="mt-1 text-sm text-muted">{scope}</p>
      </header>

      <Suspense>
        <Filters tables={tables} period={period} from={range.fromYmd} to={range.toYmd} />
      </Suspense>

      {truncated ? (
        <p className="rounded-xl bg-brand/10 px-4 py-3 text-sm text-brand">
          O período selecionado tem mais avaliações do que o painel carrega de uma vez. Os números
          abaixo consideram apenas as mais antigas; reduza o período para ver tudo.
        </p>
      ) : null}

      {/* ── Indicadores principais ─────────────────────────────────────────── */}
      <section aria-label="Indicadores principais" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Avaliações recebidas" value={String(m.total)} note="no período selecionado" />
        <Kpi
          label="Média geral de satisfação"
          value={fmt1(m.avgOverall)}
          suffix={m.avgOverall != null ? "/ 5" : undefined}
          note="nota da experiência geral"
        />
        <Kpi
          label="Índice de satisfação"
          value={m.satisfactionIndex == null ? "—" : String(Math.round(m.satisfactionIndex))}
          suffix={m.satisfactionIndex != null ? "/ 100" : undefined}
          note="todas as notas de 1 a 5, em escala 0–100"
        />
        <Kpi
          label="NPS"
          value={m.nps.score == null ? "—" : `${m.nps.score > 0 ? "+" : ""}${m.nps.score}`}
          note={
            m.nps.n
              ? `${m.nps.promoters} promotores · ${m.nps.passives} neutros · ${m.nps.detractors} detratores`
              : "sem respostas de recomendação"
          }
        />
        <Kpi label="Avaliações positivas" value={fmtPct(m.positivePct)} note={`${m.positive} com nota 4 ou 5`} />
        <Kpi label="Avaliações negativas" value={fmtPct(m.negativePct)} note={`${m.negative} com nota 1 ou 2`} />
        <Kpi label="Avaliações regulares" value={fmtPct(m.neutralPct)} note={`${m.neutral} com nota 3`} />
        <Link
          href="/admin/feedbacks?criticas=abertas"
          className={`card block transition hover:border-brand ${criticalOpen ? "border-brand bg-brand text-cream" : ""}`}
        >
          <p className={`eyebrow ${criticalOpen ? "text-cream/80!" : ""}`}>Críticas aguardando atendimento</p>
          <p className="mt-3 font-display text-5xl leading-none">{criticalOpen}</p>
          <p className={`mt-3 text-xs ${criticalOpen ? "text-cream/80" : "text-muted"}`}>
            em todo o histórico · ver na central →
          </p>
        </Link>
      </section>

      {m.total === 0 ? (
        <div className="card py-14 text-center">
          <p className="font-display text-2xl text-ink">Nenhuma avaliação neste recorte.</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Os gráficos e insights aparecem assim que as primeiras avaliações reais chegarem. Gere
            os QR Codes das mesas para começar a coletar.
          </p>
          <Link href="/admin/qrcodes" className="btn btn-primary mt-6">Gerar QR Codes</Link>
        </div>
      ) : (
        <>
          {/* ── Desempenho por categoria ─────────────────────────────────── */}
          <section aria-labelledby="cat">
            <h2 id="cat" className="card-title mb-4">Desempenho por categoria</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {m.categories.map((c) => (
                <div key={c.key} className="card">
                  <div className="flex items-start justify-between gap-2">
                    <p className="eyebrow">{c.label}</p>
                    {distinct && best?.key === c.key ? (
                      <span className="badge bg-leaf/15 text-ink">▲ Melhor avaliada</span>
                    ) : null}
                    {distinct && worst?.key === c.key ? (
                      <span className="badge bg-brand/10 text-ink">▼ Menor avaliação</span>
                    ) : null}
                  </div>
                  <p className="mt-3 font-display text-5xl leading-none text-ink">
                    {fmt1(c.avg)}
                    {c.avg != null ? <span className="ml-1.5 font-sans text-sm text-muted">/ 5</span> : null}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {c.n ? `${c.n} ${c.n === 1 ? "resposta" : "respostas"}` : "sem respostas no período"}
                  </p>
                  {c.n ? (
                    <div className="mt-3">
                      <DistributionChart distribution={c.distribution} />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          {/* ── Evolução ─────────────────────────────────────────────────── */}
          <section aria-labelledby="evo" className="card">
            <h2 id="evo" className="card-title">Evolução da satisfação</h2>
            <p className="mb-4 mt-1 text-sm text-muted">
              Média da experiência geral por {series.length > 1 && range.days > 92 ? "semana" : "dia"}.
              Dias sem avaliações ficam em branco.
            </p>
            <TrendChart data={series} />
            <p className="eyebrow mb-1 mt-6">Avaliações recebidas</p>
            <VolumeChart data={series} />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <section aria-labelledby="dow" className="card">
              <h2 id="dow" className="card-title">Satisfação por dia da semana</h2>
              <p className="mb-4 mt-1 text-sm text-muted">Média da experiência geral.</p>
              <WeekdayChart data={byWeekday(current)} />
            </section>
            <section aria-labelledby="hrs" className="card">
              <h2 id="hrs" className="card-title">Avaliações por horário</h2>
              <p className="mb-4 mt-1 text-sm text-muted">Quantidade por hora de envio.</p>
              <HourChart data={byHour(current)} />
            </section>
          </div>
        </>
      )}

      {/* ── Insights da Experiência ──────────────────────────────────────── */}
      <section aria-labelledby="ins" id="insights" className="card">
        <h2 id="ins" className="card-title">Insights da Experiência</h2>
        <p className="mb-5 mt-1 max-w-2xl text-sm text-muted">
          Padrões calculados sobre as avaliações reais do período, comparadas aos {range.days}{" "}
          {range.days === 1 ? "dia anterior" : "dias anteriores"}. Cada frase mostra os números em
          que se baseia.
        </p>

        {insights.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {insights.map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-paper px-4 py-5 text-sm text-ink">
            Ainda não há dados suficientes neste recorte para apontar padrões com segurança.
          </p>
        )}

        {insufficient.length ? (
          <details className="mt-5 text-sm text-muted">
            <summary className="cursor-pointer select-none">
              Análises sem dados suficientes ({insufficient.length})
            </summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {insufficient.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </div>
  );
}

function Kpi({ label, value, suffix, note }: { label: string; value: string; suffix?: string; note: string }) {
  return (
    <div className="card">
      <p className="eyebrow">{label}</p>
      <p className="mt-3 font-display text-5xl leading-none text-ink">
        {value}
        {suffix ? <span className="ml-1.5 font-sans text-sm text-muted">{suffix}</span> : null}
      </p>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </div>
  );
}

const TONE = {
  positivo: { mark: "▲", label: "Ponto forte", cls: "bg-leaf/15" },
  atencao: { mark: "▼", label: "Atenção", cls: "bg-brand/10" },
  neutro: { mark: "●", label: "Observação", cls: "bg-paper" },
} as const;

function InsightCard({ insight }: { insight: Insight }) {
  const tone = TONE[insight.tone];
  return (
    <li className="rounded-xl border border-line p-4">
      <span className={`badge text-ink ${tone.cls}`}>
        {tone.mark} {tone.label}
      </span>
      <p className="mt-2.5 text-[15px] font-medium leading-snug text-ink">{insight.title}</p>
      <p className="mt-1 text-sm text-muted">{insight.basis}</p>
    </li>
  );
}
