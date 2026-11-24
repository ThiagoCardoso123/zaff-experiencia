import type { CategoryKey, QuestionKey, ReviewSource, ReviewStatus } from "./types";

/** Fuso do restaurante. O Brasil não adota horário de verão desde 2019. */
export const TIMEZONE = "America/Sao_Paulo";
export const TZ_OFFSET = "-03:00";

export const OVERALL_LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Muito boa",
  5: "Excelente",
};

export const STAR_LABELS: Record<number, string> = {
  1: "Muito ruim",
  2: "Ruim",
  3: "Regular",
  4: "Muito bom",
  5: "Excelente",
};

export const FEEDBACK_TAGS = [
  "Qualidade dos pratos",
  "Atendimento",
  "Tempo de espera",
  "Ambiente",
  "Custo-benefício",
  "Limpeza",
  "Outros",
] as const;

export const CATEGORY_KEYS: CategoryKey[] = ["food", "service", "ambience", "wait_time"];

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  food: "Gastronomia",
  service: "Atendimento",
  ambience: "Ambiente",
  wait_time: "Tempo de espera",
};

export const QUESTION_LABELS: Record<QuestionKey, string> = {
  overall: "Experiência geral",
  food: "Qualidade da gastronomia",
  service: "Atendimento",
  ambience: "Ambiente",
  wait_time: "Tempo de espera",
  nps: "Recomendação (NPS)",
  feedback: "Feedback inteligente",
  contact: "Identificação opcional",
};

export const SOURCE_LABELS: Record<ReviewSource, string> = {
  geral: "QR geral",
  mesa: "Mesa",
  comanda: "Comanda",
  promo: "Material promocional",
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pendente: "Pendente",
  em_analise: "Em análise",
  resolvido: "Resolvido",
};

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const HOUR_BANDS = [
  { key: "manha", label: "Manhã (6h–11h)", from: 6, to: 11 },
  { key: "almoco", label: "Almoço (11h–15h)", from: 11, to: 15 },
  { key: "tarde", label: "Tarde (15h–18h)", from: 15, to: 18 },
  { key: "noite", label: "Noite (18h–24h)", from: 18, to: 24 },
  { key: "madrugada", label: "Madrugada (0h–6h)", from: 0, to: 6 },
] as const;

/** Regras de classificação usadas em todo o sistema. */
export const isPositive = (overall: number) => overall >= 4;
export const isNegative = (overall: number) => overall <= 2;
/** Avaliação crítica: dispara alerta prioritário e entra na fila de atendimento. */
export const isCritical = isNegative;
