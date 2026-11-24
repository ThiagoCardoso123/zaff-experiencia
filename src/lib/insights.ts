import {
  byHour,
  byWeekday,
  categoryValues,
  fmt1,
  mean,
  tagCounts,
  type ReviewRow,
} from "./analytics";
import { CATEGORY_KEYS, CATEGORY_LABELS, WEEKDAY_LABELS, isNegative, isPositive } from "./constants";

/**
 * Insights da Experiência
 *
 * Todas as frases são derivadas de cálculos sobre as avaliações reais do período.
 * Cada regra tem um mínimo de amostras; abaixo dele a regra simplesmente não fala.
 * Nada aqui é estimado, projetado ou gerado por modelo de linguagem.
 */

export const MIN = {
  /** respostas mínimas em uma categoria para compará-la com as demais */
  category: 10,
  /** diferença mínima (em pontos, escala 1–5) para considerar relevante */
  gap: 0.2,
  /** avaliações mínimas no período para análises por dia da semana */
  weekdayTotal: 20,
  /** avaliações mínimas em um dia da semana específico */
  weekdayEach: 5,
  weekdayGap: 0.3,
  /** avaliações mínimas em cada período para comparar com o anterior */
  trend: 10,
  /** menções mínimas para destacar um motivo */
  tagMentions: 5,
  /** avaliações negativas mínimas para analisar concentração por horário */
  negatives: 5,
  /** participação mínima de um horário no total de negativas */
  hourShare: 0.4,
} as const;

export type InsightTone = "positivo" | "atencao" | "neutro";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  /** de onde vem a afirmação: números e tamanho da amostra */
  basis: string;
}

export interface InsightResult {
  insights: Insight[];
  /** análises que não puderam ser feitas, com o motivo */
  insufficient: string[];
}

export function buildInsights(current: ReviewRow[], previous: ReviewRow[]): InsightResult {
  const insights: Insight[] = [];
  const insufficient: string[] = [];

  // 1 ─ Melhor e pior categoria
  const cats = CATEGORY_KEYS.map((key) => {
    const values = categoryValues(current, key);
    return { key, label: CATEGORY_LABELS[key], avg: mean(values), n: values.length };
  }).filter((c) => c.n >= MIN.category && c.avg != null) as {
    key: (typeof CATEGORY_KEYS)[number];
    label: string;
    avg: number;
    n: number;
  }[];

  if (cats.length >= 2) {
    const sorted = [...cats].sort((a, b) => a.avg - b.avg);
    const worst = sorted[0];
    const best = sorted[sorted.length - 1];
    if (best.avg - worst.avg >= MIN.gap) {
      insights.push({
        id: "pior-categoria",
        tone: "atencao",
        title: `${worst.label} é a categoria com menor avaliação.`,
        basis: `Média ${fmt1(worst.avg)} em ${worst.n} respostas, contra ${fmt1(best.avg)} de ${best.label}.`,
      });
      insights.push({
        id: "melhor-categoria",
        tone: "positivo",
        title: `${best.label} é a categoria mais bem avaliada.`,
        basis: `Média ${fmt1(best.avg)} em ${best.n} respostas.`,
      });
    } else {
      insights.push({
        id: "categorias-equilibradas",
        tone: "neutro",
        title: "As categorias estão equilibradas entre si.",
        basis: `A diferença entre a melhor (${best.label}, ${fmt1(best.avg)}) e a pior (${worst.label}, ${fmt1(worst.avg)}) é menor que ${fmt1(MIN.gap)} ponto.`,
      });
    }
  } else {
    insufficient.push(
      `Comparação entre categorias: são necessárias ao menos ${MIN.category} respostas em duas ou mais categorias.`,
    );
  }

  // 2 ─ Dias da semana abaixo / acima da média
  const overallAvg = mean(current.map((r) => r.overall));
  if (current.length >= MIN.weekdayTotal && overallAvg != null) {
    const days = byWeekday(current)
      .map((d, i) => ({ ...d, index: i }))
      .filter((d) => d.n >= MIN.weekdayEach && d.avg != null) as {
      index: number;
      avg: number;
      n: number;
    }[];
    const low = [...days].sort((a, b) => a.avg - b.avg)[0];
    const high = [...days].sort((a, b) => b.avg - a.avg)[0];
    if (low && overallAvg - low.avg >= MIN.weekdayGap) {
      insights.push({
        id: "dia-abaixo",
        tone: "atencao",
        title: `A satisfação ${weekdayPhrase(low.index)} é inferior à média do período.`,
        basis: `Média ${fmt1(low.avg)} em ${low.n} avaliações, contra ${fmt1(overallAvg)} no geral.`,
      });
    }
    if (high && high.avg - overallAvg >= MIN.weekdayGap && high.index !== low?.index) {
      insights.push({
        id: "dia-acima",
        tone: "positivo",
        title: `A satisfação ${weekdayPhrase(high.index)} é superior à média do período.`,
        basis: `Média ${fmt1(high.avg)} em ${high.n} avaliações, contra ${fmt1(overallAvg)} no geral.`,
      });
    }
  } else {
    insufficient.push(
      `Análise por dia da semana: são necessárias ao menos ${MIN.weekdayTotal} avaliações no período (há ${current.length}).`,
    );
  }

  // 3 ─ Evolução em relação ao período anterior
  let trendChecked = false;
  const trendTargets = [
    { key: "overall" as const, label: "A experiência geral" },
    ...CATEGORY_KEYS.map((key) => ({ key, label: articulate(CATEGORY_LABELS[key]) })),
  ];
  for (const t of trendTargets) {
    const cur =
      t.key === "overall" ? current.map((r) => r.overall) : categoryValues(current, t.key);
    const prev =
      t.key === "overall" ? previous.map((r) => r.overall) : categoryValues(previous, t.key);
    if (cur.length < MIN.trend || prev.length < MIN.trend) continue;
    trendChecked = true;
    const a = mean(cur)!;
    const b = mean(prev)!;
    const diff = a - b;
    if (Math.abs(diff) < MIN.gap) continue;
    insights.push({
      id: `tendencia-${t.key}`,
      tone: diff > 0 ? "positivo" : "atencao",
      title: `${t.label} apresentou ${diff > 0 ? "melhora" : "queda"} em relação ao período anterior.`,
      basis: `De ${fmt1(b)} (${prev.length} respostas) para ${fmt1(a)} (${cur.length} respostas).`,
    });
  }
  if (!trendChecked) {
    insufficient.push(
      `Comparação com o período anterior: são necessárias ao menos ${MIN.trend} avaliações em cada período (atual: ${current.length}, anterior: ${previous.length}).`,
    );
  }

  // 4 ─ Motivos mais citados
  const positives = current.filter((r) => isPositive(r.overall));
  const others = current.filter((r) => !isPositive(r.overall));
  const topPos = tagCounts(positives).filter((t) => t.tag !== "Outros")[0];
  const topNeg = tagCounts(others).filter((t) => t.tag !== "Outros")[0];
  if (topPos && topPos.count >= MIN.tagMentions) {
    insights.push({
      id: "motivo-positivo",
      tone: "positivo",
      title: `${topPos.tag} é o principal ponto positivo mencionado pelos clientes.`,
      basis: `Citado em ${topPos.count} de ${positives.length} avaliações positivas.`,
    });
  }
  if (topNeg && topNeg.count >= MIN.tagMentions) {
    insights.push({
      id: "motivo-negativo",
      tone: "atencao",
      title: `${topNeg.tag} é o ponto de melhoria mais citado.`,
      basis: `Citado em ${topNeg.count} de ${others.length} avaliações regulares ou negativas.`,
    });
  }
  if (!(topPos && topPos.count >= MIN.tagMentions) && !(topNeg && topNeg.count >= MIN.tagMentions)) {
    insufficient.push(
      `Motivos mais citados: nenhum motivo alcançou ${MIN.tagMentions} menções no período.`,
    );
  }

  // 5 ─ Horário que concentra avaliações negativas
  const negatives = current.filter((r) => isNegative(r.overall));
  if (negatives.length >= MIN.negatives) {
    const hours = byHour(current);
    const top = [...hours].sort((a, b) => b.negatives - a.negatives)[0];
    if (top && top.negatives / negatives.length >= MIN.hourShare) {
      insights.push({
        id: "horario-negativas",
        tone: "atencao",
        title: `O horário das ${top.hour}h às ${top.hour + 1}h concentra mais avaliações negativas.`,
        basis: `${top.negatives} de ${negatives.length} avaliações negativas do período (${Math.round((top.negatives / negatives.length) * 100)}%), de um total de ${top.n} avaliações nesse horário.`,
      });
    }
  } else if (current.length > 0) {
    insufficient.push(
      `Concentração de negativas por horário: são necessárias ao menos ${MIN.negatives} avaliações negativas (há ${negatives.length}).`,
    );
  }

  return { insights, insufficient };
}

function weekdayPhrase(weekday: number): string {
  if (weekday === 0) return "aos domingos";
  if (weekday === 6) return "aos sábados";
  return `às ${WEEKDAY_LABELS[weekday].toLowerCase().replace("-feira", "s-feiras")}`;
}

function articulate(label: string): string {
  if (label === "Tempo de espera") return "O tempo de espera";
  if (label === "Gastronomia") return "A gastronomia";
  return `O ${label.toLowerCase()}`;
}
