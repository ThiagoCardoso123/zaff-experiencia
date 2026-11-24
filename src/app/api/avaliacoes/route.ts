import { createHash } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/config";
import { retryPendingEmails, sendReviewEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/service";
import { submissionSchema } from "@/lib/validation";

export const runtime = "nodejs";

const WINDOW_MINUTES = 10;
const MAX_PER_WINDOW = 5;
/** Ninguém responde o formulário inteiro em menos de 3 segundos. */
const MIN_ELAPSED_MS = 3000;

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

function hashIp(request: NextRequest): string | null {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  if (!ip) return null;
  const salt = process.env.IP_HASH_SALT ?? "zaff";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export async function POST(request: NextRequest) {
  // Só aceita chamadas do próprio site
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return json({ error: "Origem não permitida." }, 403);
  }

  const raw = await request.text();
  if (raw.length > 8000) return json({ error: "Requisição muito grande." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Formato inválido." }, 400);
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Confira os dados informados e tente novamente." }, 422);
  }
  const data = parsed.data;

  // Antispam silencioso: robôs recebem "ok" e nada é gravado.
  if (data.website || data.elapsed_ms < MIN_ELAPSED_MS) {
    return json({ ok: true });
  }

  let db;
  try {
    db = createServiceClient();
  } catch {
    return json({ error: "Serviço indisponível no momento. Tente novamente em instantes." }, 503);
  }

  const ipHash = hashIp(request);
  if (ipHash) {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await db
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_PER_WINDOW) {
      return json({ error: "Muitas avaliações em sequência. Tente novamente mais tarde." }, 429);
    }
  }

  // Origem: a mesa só é registrada se existir e estiver ativa.
  let enabled = new Set<string>();
  let table: string | null = null;
  try {
    const cfg = await getConfig();
    enabled = new Set(cfg.questions.filter((q) => q.enabled).map((q) => q.key));
    if (data.mesa && cfg.tables.includes(data.mesa)) table = data.mesa;
  } catch {
    return json({ error: "Serviço indisponível no momento. Tente novamente em instantes." }, 503);
  }

  const source = table ? "mesa" : (data.origem ?? "geral");
  const on = (key: string) => enabled.has(key);
  const consent = on("contact") && data.contact_consent;

  const { data: inserted, error } = await db
    .from("reviews")
    .insert({
      source,
      table_label: table,
      campaign: source === "promo" ? (data.campanha || null) : null,
      overall: data.overall,
      // Perguntas desativadas são descartadas mesmo que venham no corpo.
      food: on("food") ? (data.food ?? null) : null,
      service: on("service") ? (data.service ?? null) : null,
      ambience: on("ambience") ? (data.ambience ?? null) : null,
      wait_time: on("wait_time") ? (data.wait_time ?? null) : null,
      nps: on("nps") ? (data.nps ?? null) : null,
      tags: on("feedback") ? data.tags : [],
      comment: on("feedback") ? (data.comment ?? null) : null,
      contact_name: on("contact") ? (data.contact_name ?? null) : null,
      // LGPD (minimização): sem autorização de contato, o WhatsApp não é guardado.
      contact_whatsapp: consent ? (data.contact_whatsapp ?? null) : null,
      contact_consent: consent,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    console.error("[avaliacoes] falha ao salvar:", error?.message);
    return json({ error: "Não foi possível registrar sua avaliação. Tente novamente." }, 500);
  }

  // O e-mail sai depois da resposta: o cliente não espera, e uma falha
  // no envio não afeta a avaliação já salva (fica marcada para reenvio).
  after(async () => {
    await sendReviewEmail(inserted.id as string);
    await retryPendingEmails(3);
  });

  return json({ ok: true });
}
