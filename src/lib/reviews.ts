import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

const PAGE = 1000; // limite padrão de linhas por requisição no Supabase
const MAX_ROWS = 50_000;

/**
 * Busca todas as linhas de uma consulta, paginando de 1.000 em 1.000.
 * `build` deve devolver a consulta já filtrada e ORDENADA de forma estável.
 */
export async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  build: () => { range: (from: number, to: number) => PromiseLike<any> },
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = (await build().range(from, from + PAGE - 1)) as {
      data: T[] | null;
      error: { message: string } | null;
    };
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export interface FeedbackFilters {
  nota: number | null;
  status: string | null;
  criticas: boolean;
  comentario: boolean;
}

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function parseFeedbackFilters(sp: SP): FeedbackFilters {
  const nota = one(sp.nota);
  const status = one(sp.status);
  return {
    nota: /^[1-5]$/.test(nota) ? Number(nota) : null,
    status: ["pendente", "em_analise", "resolvido"].includes(status) ? status : null,
    criticas: one(sp.criticas) === "abertas",
    comentario: one(sp.comentario) === "1",
  };
}

/** Aplica os filtros da central de feedbacks a uma consulta em `reviews`. */
export function applyFeedbackFilters<Q>(query: Q, f: FeedbackFilters): Q {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = query as any;
  if (f.nota) q = q.eq("overall", f.nota);
  if (f.status) q = q.eq("status", f.status);
  if (f.criticas) q = q.lte("overall", 2).neq("status", "resolvido");
  if (f.comentario) q = q.not("comment", "is", null);
  return q as Q;
}

/** Avaliações críticas (nota ≤ 2) que ainda não foram resolvidas — em todo o histórico. */
export async function countCriticalOpen(supabase: SupabaseClient): Promise<number> {
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .lte("overall", 2)
    .neq("status", "resolvido");
  return count ?? 0;
}
