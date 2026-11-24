import assert from "node:assert/strict";
import { test } from "node:test";
import { applyFilters, buildSeries, byHour, byWeekday, computeMetrics, computeNps, type ReviewRow } from "../src/lib/analytics";
import { localParts, resolveRange } from "../src/lib/dates";
import { buildInsights, MIN } from "../src/lib/insights";

let seq = 0;
function row(patch: Partial<ReviewRow> & { at?: string } = {}): ReviewRow {
  const { at, ...rest } = patch;
  return {
    // padrão: uma quarta-feira às 20h (horário de Brasília)
    created_at: at ?? `2026-11-18T23:${String(seq++ % 60).padStart(2, "0")}:00Z`,
    overall: 5,
    food: null,
    service: null,
    ambience: null,
    wait_time: null,
    nps: null,
    tags: [],
    table_label: null,
    status: "pendente",
    ...rest,
  };
}
const many = (n: number, patch: Parameters<typeof row>[0]) => Array.from({ length: n }, () => row(patch));

test("fuso: 02h UTC ainda é o dia anterior em São Paulo", () => {
  const p = localParts("2026-11-22T02:30:00Z"); // domingo em UTC
  assert.equal(p.ymd, "2026-11-21");
  assert.equal(p.weekday, 6); // sábado
  assert.equal(p.hour, 23);
});

test("período: últimos 7 dias inclui hoje e define o período anterior de mesma duração", () => {
  const r = resolveRange("7d", undefined, undefined, new Date("2026-11-24T19:00:00Z"));
  assert.equal(r.fromYmd, "2026-11-18");
  assert.equal(r.toYmd, "2026-11-24");
  assert.equal(r.days, 7);
  assert.equal(r.from.toISOString(), "2026-11-18T03:00:00.000Z");
  assert.equal(r.to.toISOString(), "2026-11-25T03:00:00.000Z");
  assert.equal(r.prevFrom.toISOString(), "2026-11-11T03:00:00.000Z");
});

test("período personalizado invertido é corrigido", () => {
  const r = resolveRange("custom", "2026-11-10", "2026-11-01");
  assert.equal(r.fromYmd, "2026-11-01");
  assert.equal(r.toYmd, "2026-11-10");
  assert.equal(r.days, 10);
});

test("métricas vazias não inventam números", () => {
  const m = computeMetrics([]);
  assert.equal(m.total, 0);
  assert.equal(m.avgOverall, null);
  assert.equal(m.satisfactionIndex, null);
  assert.equal(m.nps.score, null);
  assert.equal(m.positivePct, null);
});

test("NPS: promotores − detratores, ignorando quem não respondeu", () => {
  const nps = computeNps([row({ nps: 10 }), row({ nps: 9 }), row({ nps: 8 }), row({ nps: 3 }), row({ nps: null })]);
  assert.deepEqual([nps.n, nps.promoters, nps.passives, nps.detractors], [4, 2, 1, 1]);
  assert.equal(nps.score, 25);
});

test("percentuais e índice de satisfação", () => {
  const m = computeMetrics([
    row({ overall: 5, food: 5 }),
    row({ overall: 4, food: 3 }),
    row({ overall: 3 }),
    row({ overall: 1, food: 1 }),
  ]);
  assert.equal(m.positivePct, 50);
  assert.equal(m.negativePct, 25);
  assert.equal(m.neutralPct, 25);
  assert.equal(m.avgOverall, 3.25);
  // notas: 5,4,3,1 + 5,3,1 = 22/7 → (3,142… − 1) / 4
  assert.ok(Math.abs(m.satisfactionIndex! - ((22 / 7 - 1) / 4) * 100) < 1e-9);
  const food = m.categories.find((c) => c.key === "food")!;
  assert.equal(food.n, 3);
  assert.deepEqual(food.distribution, [1, 0, 1, 0, 1]);
});

test("filtros por dia da semana, horário e mesa", () => {
  const rows = [
    row({ at: "2026-11-21T23:00:00Z", table_label: "12" }), // sábado 20h
    row({ at: "2026-11-21T15:00:00Z", table_label: "3" }), // sábado 12h
    row({ at: "2026-11-18T23:00:00Z", table_label: "12" }), // quarta 20h
  ];
  assert.equal(applyFilters(rows, { weekday: 6 }).length, 2);
  assert.equal(applyFilters(rows, { hourBand: "noite" }).length, 2);
  assert.equal(applyFilters(rows, { weekday: 6, hourBand: "almoco" }).length, 1);
  assert.equal(applyFilters(rows, { table: "12", weekday: 3 }).length, 1);
});

test("série diária deixa lacunas (nulo) em dias sem avaliações", () => {
  const s = buildSeries([row({ at: "2026-11-18T23:00:00Z", overall: 4 })], "2026-11-17", "2026-11-19");
  assert.deepEqual(s.map((p) => [p.label, p.avg, p.n]), [["17/11", null, 0], ["18/11", 4, 1], ["19/11", null, 0]]);
});

test("agrupamentos por dia da semana e por hora", () => {
  const rows = [row({ at: "2026-11-21T23:00:00Z", overall: 1 }), row({ at: "2026-11-21T23:30:00Z", overall: 5 })];
  assert.deepEqual([byWeekday(rows)[6].n, byWeekday(rows)[6].avg, byWeekday(rows)[6].negatives], [2, 3, 1]);
  assert.equal(byHour(rows)[20].n, 2);
});

test("insights: com poucos dados, nenhum padrão é afirmado", () => {
  const { insights, insufficient } = buildInsights(many(4, { overall: 5, food: 5, wait_time: 1 }), []);
  assert.equal(insights.length, 0);
  assert.ok(insufficient.length >= 3);
});

test("insights: pior e melhor categoria com amostra suficiente", () => {
  const rows = many(MIN.category, { overall: 4, food: 5, wait_time: 2 });
  const { insights } = buildInsights(rows, []);
  const worst = insights.find((i) => i.id === "pior-categoria")!;
  const best = insights.find((i) => i.id === "melhor-categoria")!;
  assert.match(worst.title, /^Tempo de espera é a categoria com menor avaliação/);
  assert.match(best.title, /^Gastronomia/);
  assert.match(worst.basis, /Média 2,0 em 10 respostas/);
});

test("insights: sábado abaixo da média do período", () => {
  const rows = [
    ...many(15, { at: "2026-11-18T23:00:00Z", overall: 5 }),
    ...many(6, { at: "2026-11-21T23:00:00Z", overall: 2 }),
  ];
  const day = buildInsights(rows, []).insights.find((i) => i.id === "dia-abaixo")!;
  assert.match(day.title, /aos sábados é inferior/);
});

test("insights: melhora do atendimento frente ao período anterior", () => {
  const cur = many(10, { service: 5 });
  const prev = many(10, { service: 3 });
  const t = buildInsights(cur, prev).insights.find((i) => i.id === "tendencia-service")!;
  assert.match(t.title, /^O atendimento apresentou melhora/);
  assert.match(t.basis, /De 3,0 \(10 respostas\) para 5,0 \(10 respostas\)/);
});

test("insights: variação pequena não vira tendência", () => {
  const cur = [...many(9, { service: 4 }), row({ service: 5 })]; // 4,1
  const prev = many(10, { service: 4 });
  assert.equal(buildInsights(cur, prev).insights.find((i) => i.id === "tendencia-service"), undefined);
});

test("insights: motivo mais citado e horário que concentra negativas", () => {
  const rows = [
    ...many(6, { overall: 5, tags: ["Qualidade dos pratos"] }),
    ...many(5, { at: "2026-11-20T00:10:00Z", overall: 1, tags: ["Tempo de espera"] }), // 21h
    row({ at: "2026-11-19T16:00:00Z", overall: 2 }),
  ];
  const { insights } = buildInsights(rows, []);
  assert.match(insights.find((i) => i.id === "motivo-positivo")!.title, /^Qualidade dos pratos é o principal ponto positivo/);
  assert.match(insights.find((i) => i.id === "motivo-negativo")!.title, /^Tempo de espera/);
  assert.match(insights.find((i) => i.id === "horario-negativas")!.title, /das 21h às 22h/);
});
