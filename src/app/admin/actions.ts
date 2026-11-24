"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { isHex } from "@/lib/brand";
import { CONFIG_TAG } from "@/lib/config";
import { sendReviewEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { QuestionKey } from "@/lib/types";
import { emailSchema } from "@/lib/validation";

export interface ActionState {
  ok: boolean;
  message: string;
}

const ok = (message: string): ActionState => ({ ok: true, message });
const fail = (message: string): ActionState => ({ ok: false, message });
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const uuid = z.string().uuid();

function refreshConfig() {
  revalidateTag(CONFIG_TAG);
  revalidatePath("/", "layout");
}

function parseEmails(raw: string): { list: string[]; invalid: string[] } {
  const list: string[] = [];
  const invalid: string[] = [];
  for (const part of raw.split(/[\s,;]+/).filter(Boolean)) {
    const parsed = emailSchema.safeParse(part);
    if (parsed.success) list.push(parsed.data);
    else invalid.push(part);
  }
  return { list: [...new Set(list)], invalid };
}

// ── Sessão ──────────────────────────────────────────────────────────────────

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = emailSchema.safeParse(str(fd, "email"));
  const password = String(fd.get("password") ?? "");
  if (!email.success || password.length < 6) return fail("Informe e-mail e senha válidos.");

  const supabase = await createClient();
  const { data: auth, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  // Mensagem única: não revela se o e-mail existe.
  if (error || !auth.user) return fail("E-mail ou senha incorretos.");

  const { data: admin } = await supabase
    .from("admin_users")
    .select("role")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut();
    return fail("Esta conta não tem acesso ao painel.");
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ── Central de feedbacks ────────────────────────────────────────────────────

export async function updateStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const status = z.enum(["pendente", "em_analise", "resolvido"]).safeParse(str(fd, "status"));
  if (!id.success || !status.success) return fail("Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ status: status.data }).eq("id", id.data);
  if (error) return fail("Não foi possível alterar o status.");
  revalidatePath("/admin", "layout");
  return ok("Status atualizado.");
}

export async function addNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  const body = str(fd, "body");
  if (!id.success) return fail("Avaliação inválida.");
  if (!body || body.length > 2000) return fail("Escreva uma observação de até 2.000 caracteres.");

  const supabase = await createClient();
  const { error } = await supabase.from("review_notes").insert({
    review_id: id.data,
    author_id: admin.userId,
    author_email: admin.email,
    body,
  });
  if (error) return fail("Não foi possível salvar a observação.");
  revalidatePath(`/admin/feedbacks/${id.data}`);
  return ok("Observação adicionada.");
}

export async function resendEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Avaliação inválida.");
  const result = await sendReviewEmail(id.data);
  revalidatePath(`/admin/feedbacks/${id.data}`);
  return result.ok ? ok("E-mail enviado.") : fail(result.error ?? "Falha no envio.");
}

/** LGPD: apaga os dados pessoais e preserva as notas, que deixam de identificar alguém. */
export async function anonymizeReview(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Avaliação inválida.");
  const removeComment = fd.get("remove_comment") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({
      contact_name: null,
      contact_whatsapp: null,
      contact_consent: false,
      ip_hash: null,
      ...(removeComment ? { comment: null } : {}),
    })
    .eq("id", id.data);
  if (error) return fail("Não foi possível excluir os dados pessoais.");
  revalidatePath(`/admin/feedbacks/${id.data}`);
  return ok("Dados pessoais excluídos desta avaliação.");
}

export async function deleteReview(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Avaliação inválida.");
  if (str(fd, "confirm") !== "EXCLUIR") return fail('Digite EXCLUIR para confirmar.');

  const supabase = await createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id.data);
  if (error) return fail("Não foi possível excluir a avaliação.");
  revalidatePath("/admin", "layout");
  redirect("/admin/feedbacks");
}

// ── Configurações ───────────────────────────────────────────────────────────

export async function saveEmails(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const recipients = parseEmails(str(fd, "recipient_emails"));
  const alerts = parseEmails(str(fd, "alert_emails"));
  const invalid = [...recipients.invalid, ...alerts.invalid];
  if (invalid.length) return fail(`E-mail inválido: ${invalid.join(", ")}`);
  if (recipients.list.length > 10 || alerts.list.length > 10) return fail("Use no máximo 10 e-mails por lista.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      recipient_emails: recipients.list,
      alert_emails: alerts.list,
      negative_alerts_enabled: fd.get("negative_alerts_enabled") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail("Não foi possível salvar.");
  refreshConfig();
  return ok(
    recipients.list.length
      ? "Destinatários salvos."
      : "Salvo. Atenção: sem destinatários, nenhum e-mail será enviado.",
  );
}

export async function saveMessages(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const fields = [
    "welcome_title",
    "welcome_body",
    "thanks_positive_title",
    "thanks_positive_body",
    "thanks_negative_title",
    "thanks_negative_body",
  ] as const;
  const update: Record<string, string> = {};
  for (const f of fields) {
    const v = str(fd, f);
    if (!v || v.length > 300) return fail("Preencha todas as mensagens (até 300 caracteres cada).");
    update[f] = v;
  }

  const google = str(fd, "google_review_url");
  if (google && !/^https:\/\/[^\s]+$/.test(google)) return fail("O link do Google deve começar com https://");
  const privacy = str(fd, "privacy_contact");
  if (privacy.length > 120) return fail("Contato de privacidade muito longo.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({ ...update, google_review_url: google, privacy_contact: privacy, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return fail("Não foi possível salvar.");
  refreshConfig();
  return ok("Mensagens salvas.");
}

const QUESTION_KEYS: QuestionKey[] = [
  "overall",
  "food",
  "service",
  "ambience",
  "wait_time",
  "nps",
  "feedback",
  "contact",
];

export async function saveQuestions(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  for (const key of QUESTION_KEYS) {
    const title = str(fd, `title_${key}`);
    if (!title || title.length > 160) return fail("Cada pergunta precisa de um texto de até 160 caracteres.");
    const update: Record<string, unknown> = {
      title,
      // A experiência geral define todo o fluxo e não pode ser desativada.
      enabled: key === "overall" ? true : fd.get(`enabled_${key}`) === "on",
    };
    if (key === "feedback") {
      const neg = str(fd, "title_negative_feedback");
      if (!neg || neg.length > 160) return fail("Informe a pergunta exibida a clientes insatisfeitos.");
      update.title_negative = neg;
    }
    const { error } = await supabase.from("questions").update(update).eq("key", key);
    if (error) return fail("Não foi possível salvar as perguntas.");
  }
  refreshConfig();
  return ok("Perguntas salvas.");
}

export async function saveBrand(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const primary = str(fd, "primary");
  const background = str(fd, "background");
  const accent = str(fd, "accent");
  const logo = str(fd, "logo_url");
  if (![primary, background, accent].every(isHex)) return fail("Cores devem estar no formato #RRGGBB.");
  if (logo && !/^https:\/\/[^\s]+$/.test(logo)) return fail("O logotipo deve ser um endereço https://");

  const supabase = await createClient();
  const { error } = await supabase
    .from("settings")
    .update({
      brand: { primary, background, accent, ...(logo ? { logo_url: logo } : {}) },
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return fail("Não foi possível salvar.");
  refreshConfig();
  return ok("Identidade visual salva.");
}

export async function resetBrand(_: ActionState, _fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("settings").update({ brand: {} }).eq("id", 1);
  if (error) return fail("Não foi possível restaurar.");
  refreshConfig();
  return ok("Identidade oficial do Zaff restaurada.");
}

// ── Mesas ───────────────────────────────────────────────────────────────────

export async function addTables(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const raw = str(fd, "labels");
  if (!raw) return fail("Informe ao menos uma mesa.");

  // Aceita "1, 2, 3", "Varanda 1" ou intervalos como "1-20".
  const labels = new Set<string>();
  for (const part of raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)) {
    const rangeMatch = /^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(part);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (b < a || b - a > 199) return fail(`Intervalo inválido: ${part}`);
      for (let i = a; i <= b; i++) labels.add(String(i));
    } else if (/^[\p{L}\p{N} _-]{1,20}$/u.test(part)) {
      labels.add(part);
    } else {
      return fail(`Nome de mesa inválido: "${part}". Use letras, números, espaço ou hífen (até 20 caracteres).`);
    }
  }
  if (labels.size > 200) return fail("Cadastre no máximo 200 mesas por vez.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .upsert([...labels].map((label) => ({ label })), { onConflict: "label", ignoreDuplicates: true });
  if (error) return fail("Não foi possível cadastrar as mesas.");
  refreshConfig();
  revalidatePath("/admin", "layout");
  return ok(`${labels.size} mesa(s) processada(s).`);
}

export async function toggleTable(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Mesa inválida.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("restaurant_tables")
    .update({ active: fd.get("active") === "true" })
    .eq("id", id.data);
  if (error) return fail("Não foi possível atualizar a mesa.");
  refreshConfig();
  revalidatePath("/admin", "layout");
  return ok("Mesa atualizada.");
}

export async function deleteTable(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = uuid.safeParse(str(fd, "id"));
  if (!id.success) return fail("Mesa inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("restaurant_tables").delete().eq("id", id.data);
  if (error) return fail("Não foi possível remover a mesa.");
  refreshConfig();
  revalidatePath("/admin", "layout");
  return ok("Mesa removida. As avaliações já recebidas foram mantidas.");
}

// ── Usuários administrativos (somente proprietário) ─────────────────────────

export async function createAdminUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  if (me.role !== "owner") return fail("Apenas o proprietário pode gerenciar usuários.");

  const email = emailSchema.safeParse(str(fd, "email"));
  const password = String(fd.get("password") ?? "");
  if (!email.success) return fail("E-mail inválido.");
  if (password.length < 10) return fail("A senha provisória precisa de ao menos 10 caracteres.");

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: email.data,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return fail(
      /already|registered|exists/i.test(error?.message ?? "")
        ? "Já existe um usuário com este e-mail."
        : "Não foi possível criar o usuário.",
    );
  }
  const { error: insertError } = await service
    .from("admin_users")
    .insert({ user_id: data.user.id, email: email.data, role: "admin" });
  if (insertError) {
    await service.auth.admin.deleteUser(data.user.id);
    return fail("Não foi possível conceder o acesso.");
  }
  revalidatePath("/admin/configuracoes");
  return ok("Usuário criado. Envie a senha provisória por um canal seguro.");
}

export async function removeAdminUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  if (me.role !== "owner") return fail("Apenas o proprietário pode gerenciar usuários.");
  const id = uuid.safeParse(str(fd, "user_id"));
  if (!id.success) return fail("Usuário inválido.");
  if (id.data === me.userId) return fail("Você não pode remover o próprio acesso.");

  const service = createServiceClient();
  const { data: target } = await service.from("admin_users").select("role").eq("user_id", id.data).maybeSingle();
  if (!target) return fail("Usuário não encontrado.");
  if (target.role === "owner") return fail("O proprietário não pode ser removido por aqui.");

  // Remover do Auth apaga também a linha em admin_users (on delete cascade).
  const { error } = await service.auth.admin.deleteUser(id.data);
  if (error) return fail("Não foi possível remover o usuário.");
  revalidatePath("/admin/configuracoes");
  return ok("Acesso removido.");
}
