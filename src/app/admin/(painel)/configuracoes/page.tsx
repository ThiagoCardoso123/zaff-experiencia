import {
  addTables,
  createAdminUser,
  deleteTable,
  removeAdminUser,
  resetBrand,
  saveBrand,
  saveEmails,
  saveMessages,
  saveQuestions,
  toggleTable,
} from "../../actions";
import { ActionForm, SubmitButton } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/auth";
import { resolveBrand } from "@/lib/brand";
import { QUESTION_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { AdminUser, Question, RestaurantTable, Settings } from "@/lib/types";

const SECTIONS = [
  { id: "emails", label: "E-mails e alertas" },
  { id: "perguntas", label: "Perguntas" },
  { id: "mensagens", label: "Mensagens" },
  { id: "mesas", label: "Mesas" },
  { id: "identidade", label: "Identidade visual" },
  { id: "usuarios", label: "Usuários" },
];

export default async function ConfiguracoesPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const [settingsRes, questionsRes, tablesRes, adminsRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("questions").select("*").order("sort_order"),
    supabase.from("restaurant_tables").select("*"),
    supabase.from("admin_users").select("*").order("created_at"),
  ]);

  if (settingsRes.error || !settingsRes.data) {
    return (
      <p role="alert" className="card text-sm text-brand">
        Não foi possível carregar as configurações. Verifique se a migração do banco foi executada.
      </p>
    );
  }

  const s = settingsRes.data as Settings;
  const questions = (questionsRes.data ?? []) as Question[];
  const tables = ((tablesRes.data ?? []) as RestaurantTable[]).sort((a, b) =>
    a.label.localeCompare(b.label, "pt-BR", { numeric: true }),
  );
  const admins = (adminsRes.data ?? []) as AdminUser[];
  const brand = resolveBrand(s.brand);

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Configurações</p>
        <h1 className="mt-1 font-display text-4xl text-brand">Ajustes da plataforma</h1>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Seções">
        {SECTIONS.map((sec) => (
          <a key={sec.id} href={`#${sec.id}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] hover:border-brand">
            {sec.label}
          </a>
        ))}
      </nav>

      {/* ── E-mails ──────────────────────────────────────────────────────── */}
      <section id="emails" className="card scroll-mt-6">
        <h2 className="card-title">E-mails e alertas</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Quem recebe cada avaliação assim que ela é concluída.</p>
        <ActionForm action={saveEmails} className="max-w-xl space-y-4">
          <div>
            <label className="label" htmlFor="recipient_emails">Destinatários de todas as avaliações</label>
            <textarea id="recipient_emails" name="recipient_emails" rows={2} className="input" defaultValue={s.recipient_emails.join(", ")} placeholder="gerente@seudominio.com.br, socio@seudominio.com.br" />
            <p className="hint">Separe por vírgula. Sem destinatários, nenhum e-mail é enviado.</p>
          </div>
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="negative_alerts_enabled" defaultChecked={s.negative_alerts_enabled} className="mt-1 accent-[var(--zf-primary)]" />
            <span>
              <strong className="font-medium">Alerta prioritário para avaliações negativas</strong>
              <br />
              <span className="text-muted">Nota geral 1 ou 2 chega com o assunto “[ATENÇÃO] Nova avaliação negativa — Zaff”.</span>
            </span>
          </label>
          <div>
            <label className="label" htmlFor="alert_emails">Destinatários extras apenas dos alertas</label>
            <textarea id="alert_emails" name="alert_emails" rows={2} className="input" defaultValue={s.alert_emails.join(", ")} placeholder="Opcional" />
          </div>
          <SubmitButton>Salvar e-mails</SubmitButton>
        </ActionForm>
      </section>

      {/* ── Perguntas ────────────────────────────────────────────────────── */}
      <section id="perguntas" className="card scroll-mt-6">
        <h2 className="card-title">Perguntas do formulário</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          Edite os textos e desative as etapas que não quiser exibir. A experiência geral é sempre
          exibida, pois define o restante do fluxo.
        </p>
        <ActionForm action={saveQuestions} className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.key} className="grid gap-3 border-b border-line pb-4 lg:grid-cols-[200px_1fr_auto] lg:items-start">
              <p className="pt-2 text-sm">
                <span className="text-muted">Etapa {i + 1}</span>
                <br />
                <span className="font-medium">{QUESTION_LABELS[q.key]}</span>
              </p>
              <div className="space-y-2">
                <input name={`title_${q.key}`} defaultValue={q.title} maxLength={160} required className="input" aria-label={`Texto da etapa ${QUESTION_LABELS[q.key]}`} />
                {q.key === "feedback" ? (
                  <>
                    <p className="text-xs text-muted">↑ exibida a clientes satisfeitos (nota 4 ou 5) · ↓ aos demais</p>
                    <input name="title_negative_feedback" defaultValue={q.title_negative ?? ""} maxLength={160} required className="input" aria-label="Pergunta para clientes insatisfeitos" />
                  </>
                ) : null}
              </div>
              <label className="flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  name={`enabled_${q.key}`}
                  defaultChecked={q.enabled || q.key === "overall"}
                  disabled={q.key === "overall"}
                  className="accent-[var(--zf-primary)]"
                />
                Ativa
              </label>
            </div>
          ))}
          <SubmitButton>Salvar perguntas</SubmitButton>
        </ActionForm>
      </section>

      {/* ── Mensagens ────────────────────────────────────────────────────── */}
      <section id="mensagens" className="card scroll-mt-6">
        <h2 className="card-title">Mensagens e links</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Textos de boas-vindas e de agradecimento, e o link do Google.</p>
        <ActionForm action={saveMessages} className="grid gap-5 lg:grid-cols-2">
          <Field label="Boas-vindas · título" name="welcome_title" value={s.welcome_title} />
          <Field label="Boas-vindas · texto" name="welcome_body" value={s.welcome_body} area />
          <Field label="Agradecimento positivo · título" name="thanks_positive_title" value={s.thanks_positive_title} />
          <Field label="Agradecimento positivo · texto" name="thanks_positive_body" value={s.thanks_positive_body} area />
          <Field label="Agradecimento negativo · título" name="thanks_negative_title" value={s.thanks_negative_title} />
          <Field label="Agradecimento negativo · texto" name="thanks_negative_body" value={s.thanks_negative_body} area />
          <div>
            <label className="label" htmlFor="google_review_url">Link de avaliação no Google</label>
            <input id="google_review_url" name="google_review_url" type="url" defaultValue={s.google_review_url} className="input" placeholder="https://g.page/r/…/review" />
            <p className="hint">
              O botão aparece para todos os clientes, qualquer que seja a nota. Deixe em branco para ocultar.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="privacy_contact">Contato para pedidos de privacidade</label>
            <input id="privacy_contact" name="privacy_contact" defaultValue={s.privacy_contact} maxLength={120} className="input" placeholder="E-mail ou telefone exibido na página de privacidade" />
          </div>
          <div className="lg:col-span-2">
            <SubmitButton>Salvar mensagens</SubmitButton>
          </div>
        </ActionForm>
      </section>

      {/* ── Mesas ────────────────────────────────────────────────────────── */}
      <section id="mesas" className="card scroll-mt-6">
        <h2 className="card-title">Mesas cadastradas</h2>
        <p className="mb-5 mt-1 text-sm text-muted">
          Só mesas ativas são aceitas no formulário e ganham QR Code. {tables.length} cadastrada(s).
        </p>
        <ActionForm action={addTables} className="mb-6 max-w-xl">
          <label className="label" htmlFor="labels">Adicionar mesas</label>
          <div className="flex gap-2">
            <input id="labels" name="labels" className="input" placeholder="Ex.: 1-20, Varanda 1, Varanda 2" required />
            <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
          </div>
          <p className="hint">Use vírgulas para várias mesas e hífen para intervalos numéricos.</p>
        </ActionForm>
        {tables.length ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-sm">
                <span className={t.active ? "font-medium" : "text-muted line-through"}>Mesa {t.label}</span>
                <span className="flex items-center gap-3">
                  <ActionForm action={toggleTable}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="active" value={String(!t.active)} />
                    <button type="submit" className="cursor-pointer text-xs text-muted underline underline-offset-4 hover:text-brand">
                      {t.active ? "Desativar" : "Ativar"}
                    </button>
                  </ActionForm>
                  <ActionForm action={deleteTable} confirm={`Remover a mesa ${t.label}? As avaliações já recebidas são mantidas.`}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="cursor-pointer text-xs text-brand underline underline-offset-4" aria-label={`Remover mesa ${t.label}`}>
                      Remover
                    </button>
                  </ActionForm>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* ── Identidade visual ────────────────────────────────────────────── */}
      <section id="identidade" className="card scroll-mt-6">
        <h2 className="card-title">Identidade visual</h2>
        <p className="mb-5 mt-1 max-w-2xl text-sm text-muted">
          A plataforma já usa o logotipo e as cores oficiais do manual da marca Zaff. Altere apenas
          se a identidade do restaurante mudar.
        </p>
        <ActionForm action={saveBrand} className="max-w-xl space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Color label="Cor principal" name="primary" value={brand.primary} />
            <Color label="Fundo" name="background" value={brand.background} />
            <Color label="Destaque (folha)" name="accent" value={brand.accent} />
          </div>
          <div>
            <label className="label" htmlFor="logo_url">Logotipo alternativo (URL https)</label>
            <input id="logo_url" name="logo_url" type="url" defaultValue={s.brand?.logo_url ?? ""} className="input" placeholder="Em branco = logotipo oficial" />
            <p className="hint">Use um arquivo SVG ou PNG com fundo transparente, legível sobre a cor principal e sobre o fundo.</p>
          </div>
          <SubmitButton>Salvar identidade</SubmitButton>
        </ActionForm>
        <ActionForm action={resetBrand} className="mt-3" confirm="Restaurar as cores e o logotipo oficiais do Zaff?">
          <button type="submit" className="cursor-pointer text-sm text-muted underline underline-offset-4 hover:text-brand">
            Restaurar identidade oficial do Zaff
          </button>
        </ActionForm>
      </section>

      {/* ── Usuários ─────────────────────────────────────────────────────── */}
      <section id="usuarios" className="card scroll-mt-6">
        <h2 className="card-title">Usuários administrativos</h2>
        <p className="mb-5 mt-1 text-sm text-muted">Quem pode entrar neste painel.</p>
        <ul className="mb-6 max-w-xl divide-y divide-line rounded-xl border border-line text-sm">
          {admins.map((a) => (
            <li key={a.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0 truncate">
                {a.email}
                {a.user_id === me.userId ? <span className="text-muted"> (você)</span> : null}
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="badge bg-cream text-ink">{a.role === "owner" ? "Proprietário" : "Administrador"}</span>
                {me.role === "owner" && a.role !== "owner" ? (
                  <ActionForm action={removeAdminUser} confirm={`Remover o acesso de ${a.email}?`}>
                    <input type="hidden" name="user_id" value={a.user_id} />
                    <button type="submit" className="cursor-pointer text-xs text-brand underline underline-offset-4">Remover</button>
                  </ActionForm>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
        {me.role === "owner" ? (
          <ActionForm action={createAdminUser} className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="new_email">E-mail do novo usuário</label>
              <input id="new_email" name="email" type="email" required className="input" autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor="new_password">Senha provisória</label>
              <input id="new_password" name="password" type="text" required minLength={10} className="input" autoComplete="off" />
              <p className="hint">Mínimo de 10 caracteres.</p>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Criando…">Criar usuário</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <p className="text-sm text-muted">Apenas o proprietário pode adicionar ou remover usuários.</p>
        )}
      </section>
    </div>
  );
}

function Field({ label, name, value, area }: { label: string; name: string; value: string; area?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      {area ? (
        <textarea id={name} name={name} rows={3} maxLength={300} required defaultValue={value} className="input" />
      ) : (
        <input id={name} name={name} maxLength={300} required defaultValue={value} className="input" />
      )}
    </div>
  );
}

function Color({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type="color" defaultValue={value} className="h-10 w-full cursor-pointer rounded-xl border border-line bg-white p-1" />
    </div>
  );
}
