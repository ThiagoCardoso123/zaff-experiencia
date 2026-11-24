import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addNote,
  anonymizeReview,
  deleteReview,
  resendEmail,
  updateStatus,
} from "../../../actions";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { ScoreBadge, Stars, StatusBadge } from "@/components/admin/bits";
import { CATEGORY_KEYS, CATEGORY_LABELS, STATUS_LABELS, isCritical } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { formatWhatsapp, MAX_EMAIL_ATTEMPTS, originLabel, waNumber } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import type { Review, ReviewNote } from "@/lib/types";

const EMAIL_LABEL = {
  pending: "Aguardando envio",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Não enviado",
} as const;

export default async function FeedbackDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: review }, { data: notes }] = await Promise.all([
    supabase.from("reviews").select("*").eq("id", id).maybeSingle(),
    supabase.from("review_notes").select("*").eq("review_id", id).order("created_at"),
  ]);
  if (!review) notFound();
  const r = review as Review;
  const noteList = (notes ?? []) as ReviewNote[];
  const hasPersonal = Boolean(r.contact_name || r.contact_whatsapp);

  return (
    <div className="space-y-6">
      <Link href="/admin/feedbacks" className="text-sm text-muted underline underline-offset-4 hover:text-brand">
        ← Central de feedbacks
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{originLabel(r)}</p>
          <h1 className="mt-1 font-display text-4xl text-brand">
            Avaliação de {formatDateTime(r.created_at)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ScoreBadge overall={r.overall} />
            <StatusBadge status={r.status} />
            {isCritical(r.overall) && r.status !== "resolvido" ? (
              <span className="badge bg-brand text-cream">Crítica · aguardando atendimento</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <section className="card">
            <h2 className="card-title mb-4">Notas</h2>
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <Row label="Experiência geral"><Stars value={r.overall} /></Row>
              {CATEGORY_KEYS.map((k) => (
                <Row key={k} label={CATEGORY_LABELS[k]}><Stars value={r[k]} /></Row>
              ))}
              <Row label="Recomendação (0–10)">
                {r.nps == null ? <span className="text-muted">—</span> : <strong>{r.nps}</strong>}
              </Row>
            </dl>
          </section>

          <section className="card">
            <h2 className="card-title mb-4">Feedback do cliente</h2>
            {r.tags.length ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {r.tags.map((t) => (
                  <span key={t} className="badge bg-cream text-ink">{t}</span>
                ))}
              </div>
            ) : null}
            {r.comment ? (
              <blockquote className="whitespace-pre-wrap border-l-2 border-brand pl-4 text-[15px] leading-relaxed">
                {r.comment}
              </blockquote>
            ) : (
              <p className="text-sm text-muted">O cliente não deixou comentário.</p>
            )}
          </section>

          <section className="card">
            <h2 className="card-title mb-1">Observações internas</h2>
            <p className="mb-4 text-sm text-muted">Visíveis apenas para a equipe administrativa.</p>
            {noteList.length ? (
              <ul className="mb-5 space-y-3">
                {noteList.map((n) => (
                  <li key={n.id} className="rounded-xl bg-paper px-4 py-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {n.author_email} · {formatDateTime(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <ActionForm action={addNote}>
              <input type="hidden" name="id" value={r.id} />
              <label className="label" htmlFor="body">Nova observação</label>
              <textarea id="body" name="body" rows={3} maxLength={2000} required className="input" placeholder="Ex.: Liguei para o cliente e oferecemos uma cortesia na próxima visita." />
              <div className="mt-3">
                <SubmitButton>Adicionar observação</SubmitButton>
              </div>
            </ActionForm>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card">
            <h2 className="card-title mb-4">Atendimento</h2>
            <ActionForm action={updateStatus}>
              <input type="hidden" name="id" value={r.id} />
              <label className="label" htmlFor="status">Status</label>
              <div className="flex gap-2">
                <select id="status" name="status" defaultValue={r.status} className="input">
                  {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <SubmitButton>Salvar</SubmitButton>
              </div>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="card-title mb-4">Contato</h2>
            {hasPersonal ? (
              <div className="space-y-1.5 text-sm">
                {r.contact_name ? <p className="font-medium">{r.contact_name}</p> : null}
                {r.contact_whatsapp ? (
                  <p>
                    <a
                      href={`https://wa.me/${waNumber(r.contact_whatsapp)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand underline underline-offset-4"
                    >
                      {formatWhatsapp(r.contact_whatsapp)}
                    </a>
                  </p>
                ) : null}
                <p className="text-muted">
                  {r.contact_consent ? "✓ Autorizou contato sobre esta avaliação." : "Não autorizou contato."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">Avaliação anônima.</p>
            )}
          </section>

          <section className="card">
            <h2 className="card-title mb-4">E-mail de notificação</h2>
            <p className="text-sm">
              <strong>{EMAIL_LABEL[r.email_status]}</strong>
              {r.email_sent_at ? ` em ${formatDateTime(r.email_sent_at)}` : ""}
            </p>
            {r.email_status !== "sent" ? (
              <p className="hint">
                {r.email_last_error ?? "O envio ainda não foi concluído."}
                {r.email_status === "failed"
                  ? ` Tentativas: ${r.email_attempts} de ${MAX_EMAIL_ATTEMPTS} automáticas.`
                  : ""}
              </p>
            ) : null}
            <ActionForm action={resendEmail} className="mt-4">
              <input type="hidden" name="id" value={r.id} />
              <SubmitButton className="btn btn-outline" pendingLabel="Enviando…">
                {r.email_status === "sent" ? "Enviar novamente" : "Reenviar agora"}
              </SubmitButton>
            </ActionForm>
          </section>

          <section className="card">
            <h2 className="card-title mb-1">Privacidade (LGPD)</h2>
            <p className="mb-4 text-sm text-muted">
              Use quando o cliente pedir a exclusão dos seus dados.
            </p>
            <ActionForm
              action={anonymizeReview}
              confirm="Excluir os dados pessoais desta avaliação? Esta ação não pode ser desfeita."
            >
              <input type="hidden" name="id" value={r.id} />
              <label className="mb-3 flex items-start gap-2 text-sm">
                <input type="checkbox" name="remove_comment" className="mt-1 accent-[var(--zf-primary)]" />
                Apagar também o comentário (pode conter dados pessoais)
              </label>
              <SubmitButton className="btn btn-outline" pendingLabel="Excluindo…">
                Excluir dados pessoais
              </SubmitButton>
              <p className="hint">Remove nome e WhatsApp e mantém as notas, já sem identificação.</p>
            </ActionForm>

            <div className="mt-5 border-t border-line pt-5">
              <ActionForm action={deleteReview}>
                <input type="hidden" name="id" value={r.id} />
                <label className="label" htmlFor="confirm">Excluir a avaliação inteira</label>
                <div className="flex gap-2">
                  <input id="confirm" name="confirm" className="input" placeholder="Digite EXCLUIR" autoComplete="off" />
                  <SubmitButton className="btn btn-danger" pendingLabel="Excluindo…">Excluir</SubmitButton>
                </div>
                <p className="hint">A avaliação deixa de contar nos indicadores.</p>
              </ActionForm>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line pb-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
