import { OVERALL_LABELS, STATUS_LABELS, isNegative, isPositive } from "@/lib/constants";
import type { ReviewStatus } from "@/lib/types";

/** Nota geral: o número e o rótulo carregam o significado; a cor apenas reforça. */
export function ScoreBadge({ overall }: { overall: number }) {
  const cls = isNegative(overall)
    ? "bg-brand text-cream"
    : isPositive(overall)
      ? "bg-leaf/15 text-ink"
      : "bg-caramel/25 text-ink";
  return (
    <span className={`badge whitespace-nowrap ${cls}`}>
      {overall} · {OVERALL_LABELS[overall]}
    </span>
  );
}

const STATUS_CLS: Record<ReviewStatus, string> = {
  pendente: "border border-brand/40 text-brand",
  em_analise: "bg-caramel/25 text-ink",
  resolvido: "bg-leaf/15 text-ink",
};

export function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`badge whitespace-nowrap ${STATUS_CLS[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function Stars({ value }: { value: number | null }) {
  if (value == null) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap" aria-label={`${value} de 5`}>
      <span className="text-brand">{"★".repeat(value)}</span>
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}
