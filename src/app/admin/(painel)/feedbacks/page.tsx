import Link from "next/link";
import { ScoreBadge, StatusBadge } from "@/components/admin/bits";
import { OVERALL_LABELS, STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { originLabel } from "@/lib/email";
import { applyFeedbackFilters, parseFeedbackFilters } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types";

const PAGE_SIZE = 25;
type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function FeedbacksPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const filters = parseFeedbackFilters(sp);
  const page = Math.max(1, Number(typeof sp.pagina === "string" ? sp.pagina : 1) || 1);

  const supabase = await createClient();
  const base = supabase
    .from("reviews")
    .select(
      "id,created_at,source,table_label,campaign,overall,nps,comment,tags,status,contact_name,contact_consent",
      { count: "exact" },
    );
  const { data, count, error } = await applyFeedbackFilters(base, filters)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const reviews = (data ?? []) as Review[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = (patch: Record<string, string | null>) => {
    const p = new URLSearchParams();
    if (filters.nota) p.set("nota", String(filters.nota));
    if (filters.status) p.set("status", filters.status);
    if (filters.criticas) p.set("criticas", "abertas");
    if (filters.comentario) p.set("comentario", "1");
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-[13px] transition ${
      active ? "border-brand bg-brand text-cream" : "border-line bg-white text-ink hover:border-brand"
    }`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Central de feedbacks</p>
          <h1 className="mt-1 font-display text-4xl text-brand">Todas as avaliações</h1>
          <p className="mt-1 text-sm text-muted">
            {total} {total === 1 ? "avaliação" : "avaliações"} neste filtro
          </p>
        </div>
        <a href={`/admin/feedbacks/exportar${qs({})}`} className="btn btn-outline">
          Exportar CSV
        </a>
      </header>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-14">Nota</span>
          <Link href={`/admin/feedbacks${qs({ nota: null, pagina: null })}`} className={chip(!filters.nota)}>
            Todas
          </Link>
          {[5, 4, 3, 2, 1].map((n) => (
            <Link
              key={n}
              href={`/admin/feedbacks${qs({ nota: String(n), pagina: null })}`}
              className={chip(filters.nota === n)}
            >
              {n} · {OVERALL_LABELS[n]}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="eyebrow mr-1 w-14">Status</span>
          <Link href={`/admin/feedbacks${qs({ status: null, pagina: null })}`} className={chip(!filters.status)}>
            Todos
          </Link>
          {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
            <Link
              key={s}
              href={`/admin/feedbacks${qs({ status: s, pagina: null })}`}
              className={chip(filters.status === s)}
            >
              {STATUS_LABELS[s]}
            </Link>
          ))}
          <span className="mx-2 h-5 w-px bg-line" />
          <Link
            href={`/admin/feedbacks${qs({ criticas: filters.criticas ? null : "abertas", pagina: null })}`}
            className={chip(filters.criticas)}
          >
            Críticas em aberto
          </Link>
          <Link
            href={`/admin/feedbacks${qs({ comentario: filters.comentario ? null : "1", pagina: null })}`}
            className={chip(filters.comentario)}
          >
            Com comentário
          </Link>
        </div>
      </div>

      {error ? (
        <p role="alert" className="card text-sm text-brand">
          Não foi possível carregar as avaliações. Atualize a página para tentar novamente.
        </p>
      ) : reviews.length === 0 ? (
        <div className="card py-14 text-center">
          <p className="font-display text-2xl">Nenhuma avaliação encontrada.</p>
          <p className="mt-2 text-sm text-muted">Ajuste os filtros ou aguarde novas avaliações.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.12em] text-muted">
                <th className="px-5 py-3 font-medium">Data</th>
                <th className="px-3 py-3 font-medium">Origem</th>
                <th className="px-3 py-3 font-medium">Nota geral</th>
                <th className="px-3 py-3 font-medium">NPS</th>
                <th className="px-3 py-3 font-medium">Comentário</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="whitespace-nowrap px-5 py-3.5 tabular-nums">{formatDateTime(r.created_at)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5">{originLabel(r)}</td>
                  <td className="px-3 py-3.5"><ScoreBadge overall={r.overall} /></td>
                  <td className="px-3 py-3.5 tabular-nums">{r.nps ?? "—"}</td>
                  <td className="max-w-[340px] px-3 py-3.5">
                    {r.comment ? (
                      <span className="line-clamp-2">{r.comment}</span>
                    ) : r.tags.length ? (
                      <span className="text-muted">{r.tags.join(", ")}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5"><StatusBadge status={r.status} /></td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/admin/feedbacks/${r.id}`} className="whitespace-nowrap text-brand underline underline-offset-4">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginação">
          {page > 1 ? (
            <Link href={`/admin/feedbacks${qs({ pagina: String(page - 1) })}`} className="btn btn-outline">← Anteriores</Link>
          ) : <span />}
          <span className="text-muted">Página {page} de {pages}</span>
          {page < pages ? (
            <Link href={`/admin/feedbacks${qs({ pagina: String(page + 1) })}`} className="btn btn-outline">Próximas →</Link>
          ) : <span />}
        </nav>
      ) : null}
    </div>
  );
}
