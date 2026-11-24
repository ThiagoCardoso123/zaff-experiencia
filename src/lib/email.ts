import "server-only";
import { Resend } from "resend";
import { BRAND_DEFAULTS } from "./brand";
import { CATEGORY_KEYS, CATEGORY_LABELS, OVERALL_LABELS, SOURCE_LABELS, isCritical } from "./constants";
import { formatDateTime } from "./dates";
import { createServiceClient } from "./supabase/service";
import type { Review, Settings } from "./types";

export const MAX_EMAIL_ATTEMPTS = 5;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");

export function originLabel(r: Pick<Review, "source" | "table_label" | "campaign">): string {
  if (r.source === "mesa" && r.table_label) return `Mesa ${r.table_label}`;
  if (r.source === "promo" && r.campaign) return `${SOURCE_LABELS.promo} · ${r.campaign}`;
  return SOURCE_LABELS[r.source];
}

export function buildReviewEmail(review: Review, alertsEnabled: boolean) {
  const critical = isCritical(review.overall) && alertsEnabled;
  const subject = critical
    ? "[ATENÇÃO] Nova avaliação negativa — Zaff"
    : "Nova avaliação de experiência — Zaff";

  const red = BRAND_DEFAULTS.primary;
  const cream = BRAND_DEFAULTS.background;
  const link = `${siteUrl()}/admin/feedbacks/${review.id}`;

  const row = (label: string, value: string) =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #e4dfd2;color:#6b5a52;font-size:14px;">${esc(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e4dfd2;color:#2a1a16;font-size:14px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  const stars = (n: number | null) =>
    n == null
      ? `<span style="color:#9a8c84;font-weight:400;">não respondida</span>`
      : `<span style="color:${red};letter-spacing:2px;">${"★".repeat(n)}</span><span style="color:#cfc7b8;letter-spacing:2px;">${"★".repeat(5 - n)}</span>&nbsp; ${n}/5`;

  const rows = [
    row("Data e horário", esc(formatDateTime(review.created_at))),
    row("Origem", esc(originLabel(review))),
    review.table_label ? row("Mesa", esc(review.table_label)) : "",
    row("Nota geral", `${stars(review.overall)} · ${esc(OVERALL_LABELS[review.overall])}`),
    ...CATEGORY_KEYS.map((k) => row(CATEGORY_LABELS[k], stars(review[k]))),
    row(
      "Recomendação (0–10)",
      review.nps == null ? `<span style="color:#9a8c84;font-weight:400;">não respondida</span>` : String(review.nps),
    ),
    review.tags.length ? row("Pontos assinalados", esc(review.tags.join(", "))) : "",
  ].join("");

  const comment = review.comment
    ? `<div style="margin-top:24px;padding:16px 18px;background:#ffffff;border-left:3px solid ${red};border-radius:4px;">
         <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b5a52;margin-bottom:6px;">Comentário do cliente</div>
         <div style="font-size:15px;line-height:1.55;color:#2a1a16;white-space:pre-wrap;">${esc(review.comment)}</div>
       </div>`
    : "";

  // Contato só aparece quando foi informado E autorizado.
  const hasContact = review.contact_consent && (review.contact_name || review.contact_whatsapp);
  const contact = hasContact
    ? `<div style="margin-top:24px;padding:16px 18px;background:#ffffff;border-radius:4px;">
         <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#6b5a52;margin-bottom:6px;">Contato autorizado pelo cliente</div>
         <div style="font-size:15px;color:#2a1a16;line-height:1.6;">
           ${review.contact_name ? `${esc(review.contact_name)}<br>` : ""}
           ${review.contact_whatsapp ? `WhatsApp: <a href="https://wa.me/${waNumber(review.contact_whatsapp)}" style="color:${red};">${esc(formatWhatsapp(review.contact_whatsapp))}</a>` : ""}
         </div>
       </div>`
    : "";

  const banner = critical
    ? `<div style="background:${red};color:${cream};padding:12px 28px;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:700;">Atenção · avaliação negativa aguardando atendimento</div>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<body style="margin:0;background:#f5f2ea;font-family:Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px 12px;">
    <div style="background:${cream};border-radius:10px;overflow:hidden;">
      ${banner}
      <div style="padding:28px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:28px;color:${red};letter-spacing:0.5px;">Zaff</div>
        <div style="font-size:11px;letter-spacing:3px;color:${red};text-transform:uppercase;margin-bottom:22px;">Gastronomia</div>
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#2a1a16;margin-bottom:14px;">
          ${critical ? "Nova avaliação negativa" : "Nova avaliação de experiência"}
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
        ${comment}
        ${contact}
        <div style="margin-top:28px;">
          <a href="${esc(link)}" style="display:inline-block;background:${red};color:${cream};text-decoration:none;padding:13px 22px;border-radius:999px;font-size:14px;font-weight:600;">Ver avaliação no painel</a>
        </div>
      </div>
    </div>
    <div style="text-align:center;color:#9a8c84;font-size:12px;padding:16px;">Enviado automaticamente pela plataforma de experiência do Zaff.</div>
  </div>
</body>
</html>`;

  const text = [
    critical ? "ATENÇÃO: avaliação negativa" : "Nova avaliação de experiência",
    `Data: ${formatDateTime(review.created_at)}`,
    `Origem: ${originLabel(review)}`,
    `Nota geral: ${review.overall}/5 (${OVERALL_LABELS[review.overall]})`,
    ...CATEGORY_KEYS.map((k) => `${CATEGORY_LABELS[k]}: ${review[k] ?? "não respondida"}${review[k] ? "/5" : ""}`),
    `Recomendação: ${review.nps ?? "não respondida"}`,
    review.tags.length ? `Pontos assinalados: ${review.tags.join(", ")}` : "",
    review.comment ? `Comentário: ${review.comment}` : "",
    hasContact ? `Contato: ${[review.contact_name, review.contact_whatsapp].filter(Boolean).join(" · ")}` : "",
    `Ver no painel: ${link}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { subject, html, text, critical };
}

export const waNumber = (digits: string) => (digits.length <= 11 ? `55${digits}` : digits);

export function formatWhatsapp(digits: string): string {
  const d = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * Envia (ou reenvia) o e-mail de uma avaliação e registra o resultado.
 * Nunca lança: a avaliação já está salva e deve permanecer assim.
 */
export async function sendReviewEmail(reviewId: string): Promise<SendResult> {
  const db = createServiceClient();
  const fail = async (error: string, status: "failed" | "skipped", attempts: number) => {
    await db
      .from("reviews")
      .update({ email_status: status, email_last_error: error.slice(0, 500), email_attempts: attempts })
      .eq("id", reviewId);
    return { ok: false, error };
  };

  const [{ data: review, error: rErr }, { data: settings, error: sErr }] = await Promise.all([
    db.from("reviews").select("*").eq("id", reviewId).single(),
    db.from("settings").select("*").eq("id", 1).single(),
  ]);
  if (rErr || !review) return { ok: false, error: "Avaliação não encontrada." };
  const r = review as Review;
  if (sErr || !settings) return fail("Configurações indisponíveis.", "failed", r.email_attempts + 1);
  const s = settings as Settings;

  const critical = isCritical(r.overall) && s.negative_alerts_enabled;
  const to = [...new Set([...s.recipient_emails, ...(critical ? s.alert_emails : [])])];
  if (!to.length) {
    return fail("Nenhum destinatário configurado em Configurações → E-mails.", "skipped", r.email_attempts);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return fail("RESEND_API_KEY ou EMAIL_FROM não configurados no servidor.", "failed", r.email_attempts + 1);
  }

  try {
    const { subject, html, text } = buildReviewEmail(r, s.negative_alerts_enabled);
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
      text,
      headers: critical ? { "X-Priority": "1", Importance: "high" } : undefined,
    });
    if (error) return fail(error.message ?? "Falha no envio.", "failed", r.email_attempts + 1);

    await db
      .from("reviews")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        email_last_error: null,
        email_attempts: r.email_attempts + 1,
      })
      .eq("id", reviewId);
    return { ok: true };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Erro inesperado no envio.", "failed", r.email_attempts + 1);
  }
}

/** Reenvia e-mails pendentes ou com falha (até o limite de tentativas). */
export async function retryPendingEmails(limit = 20): Promise<{ tried: number; sent: number }> {
  const db = createServiceClient();
  // "pending" com mais de 2 minutos = envio interrompido antes de registrar o resultado
  const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data } = await db
    .from("reviews")
    .select("id")
    .in("email_status", ["pending", "failed"])
    .lt("email_attempts", MAX_EMAIL_ATTEMPTS)
    .lt("created_at", cutoff)
    .order("created_at")
    .limit(limit);

  let sent = 0;
  for (const row of data ?? []) {
    const res = await sendReviewEmail(row.id as string);
    if (res.ok) sent++;
  }
  return { tried: data?.length ?? 0, sent };
}
