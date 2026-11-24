-- ════════════════════════════════════════════════════════════════════════════
-- Zaff · Plataforma de Avaliação de Experiência
-- Execute este arquivo no SQL Editor do Supabase (ou via `supabase db push`).
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ── Administradores ─────────────────────────────────────────────────────────
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  role       text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now()
);

-- security definer: consulta admin_users sem depender das políticas da própria tabela
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_owner() to authenticated;

-- ── Configurações (linha única) ─────────────────────────────────────────────
create table if not exists public.settings (
  id                       smallint primary key default 1 check (id = 1),
  recipient_emails         text[]  not null default '{}',
  negative_alerts_enabled  boolean not null default true,
  alert_emails             text[]  not null default '{}',
  google_review_url        text    not null default '',
  welcome_title            text    not null default 'Como foi sua experiência no Zaff?',
  welcome_body             text    not null default 'Queremos tornar cada visita ainda melhor. Sua opinião faz parte disso.',
  thanks_positive_title    text    not null default 'Foi um prazer receber você.',
  thanks_positive_body     text    not null default 'Obrigado por compartilhar sua experiência. Esperamos encontrar você novamente em breve.',
  thanks_negative_title    text    not null default 'Obrigado por nos ajudar a melhorar.',
  thanks_negative_body     text    not null default 'Sua opinião é muito importante para nós. Seu feedback será encaminhado à nossa equipe.',
  privacy_contact          text    not null default '',
  brand                    jsonb   not null default '{}'::jsonb,
  updated_at               timestamptz not null default now()
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ── Perguntas do formulário ─────────────────────────────────────────────────
create table if not exists public.questions (
  key            text primary key
                 check (key in ('overall','food','service','ambience','wait_time','nps','feedback','contact')),
  title          text not null,
  title_negative text,
  enabled        boolean not null default true,
  sort_order     smallint not null
);

insert into public.questions (key, title, title_negative, sort_order) values
  ('overall',   'Como você avalia sua experiência no Zaff?', null, 1),
  ('food',      'Como você avalia a qualidade dos nossos pratos?', null, 2),
  ('service',   'Como foi o atendimento da nossa equipe?', null, 3),
  ('ambience',  'Como você avalia nosso ambiente e conforto?', null, 4),
  ('wait_time', 'Como você avalia o tempo de espera pelo seu pedido?', null, 5),
  ('nps',       'De 0 a 10, o quanto você recomendaria o Zaff para amigos e familiares?', null, 6),
  ('feedback',  'O que mais marcou positivamente sua experiência?', 'O que poderíamos ter feito melhor?', 7),
  ('contact',   'Gostaria de se identificar?', null, 8)
on conflict (key) do nothing;

-- ── Mesas ───────────────────────────────────────────────────────────────────
create table if not exists public.restaurant_tables (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique check (char_length(label) between 1 and 20),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── Avaliações ──────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- origem (QR Code)
  source           text not null default 'geral' check (source in ('geral','mesa','comanda','promo')),
  table_label      text check (table_label is null or char_length(table_label) <= 20),
  campaign         text check (campaign is null or char_length(campaign) <= 60),

  -- notas
  overall          smallint not null check (overall between 1 and 5),
  food             smallint check (food between 1 and 5),
  service          smallint check (service between 1 and 5),
  ambience         smallint check (ambience between 1 and 5),
  wait_time        smallint check (wait_time between 1 and 5),
  nps              smallint check (nps between 0 and 10),

  -- feedback
  tags             text[] not null default '{}',
  comment          text check (comment is null or char_length(comment) <= 1000),

  -- identificação opcional (LGPD: pode ser apagada sem perder as notas)
  contact_name     text check (contact_name is null or char_length(contact_name) <= 80),
  contact_whatsapp text check (contact_whatsapp is null or char_length(contact_whatsapp) <= 20),
  contact_consent  boolean not null default false,

  -- gestão
  status           text not null default 'pendente' check (status in ('pendente','em_analise','resolvido')),

  -- e-mail
  email_status     text not null default 'pending' check (email_status in ('pending','sent','failed','skipped')),
  email_attempts   smallint not null default 0,
  email_last_error text,
  email_sent_at    timestamptz,

  -- antispam: hash irreversível do IP (com sal), nunca o IP em si
  ip_hash          text
);

create index if not exists reviews_created_at_idx on public.reviews (created_at desc);
create index if not exists reviews_overall_idx    on public.reviews (overall);
create index if not exists reviews_status_idx     on public.reviews (status);
create index if not exists reviews_email_idx      on public.reviews (email_status) where email_status in ('pending','failed');
create index if not exists reviews_ip_idx         on public.reviews (ip_hash, created_at desc);

-- ── Observações internas ────────────────────────────────────────────────────
create table if not exists public.review_notes (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid not null references public.reviews (id) on delete cascade,
  author_id    uuid references auth.users (id) on delete set null,
  author_email text not null,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index if not exists review_notes_review_idx on public.review_notes (review_id, created_at);

-- ════════════════════════════════════════════════════════════════════════════
-- Segurança (RLS)
--
-- • O público (anon) NÃO tem nenhuma política: não lê nem grava direto no banco.
--   O formulário grava pela rota /api/avaliacoes, no servidor, com validação,
--   antispam e a chave service_role (que ignora RLS e nunca vai ao navegador).
-- • Usuários autenticados só enxergam algo se estiverem em admin_users.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.admin_users       enable row level security;
alter table public.settings          enable row level security;
alter table public.questions         enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.reviews           enable row level security;
alter table public.review_notes      enable row level security;

-- admin_users: admins leem; apenas o proprietário altera (via servidor)
drop policy if exists admin_users_select on public.admin_users;
create policy admin_users_select on public.admin_users
  for select to authenticated using (public.is_admin());

-- settings
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (public.is_admin());
drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- questions
drop policy if exists questions_select on public.questions;
create policy questions_select on public.questions
  for select to authenticated using (public.is_admin());
drop policy if exists questions_update on public.questions;
create policy questions_update on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- restaurant_tables
drop policy if exists tables_all on public.restaurant_tables;
create policy tables_all on public.restaurant_tables
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reviews: admins leem, atualizam (status / anonimização) e excluem. Nunca inserem.
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select to authenticated using (public.is_admin());
drop policy if exists reviews_update on public.reviews;
create policy reviews_update on public.reviews
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete to authenticated using (public.is_admin());

-- review_notes
drop policy if exists notes_select on public.review_notes;
create policy notes_select on public.review_notes
  for select to authenticated using (public.is_admin());
drop policy if exists notes_insert on public.review_notes;
create policy notes_insert on public.review_notes
  for insert to authenticated with check (public.is_admin() and author_id = auth.uid());
drop policy if exists notes_delete on public.review_notes;
create policy notes_delete on public.review_notes
  for delete to authenticated using (public.is_admin() and author_id = auth.uid());

-- Garante que anon não tenha privilégios diretos nas tabelas
revoke all on public.admin_users, public.settings, public.questions,
              public.restaurant_tables, public.reviews, public.review_notes from anon;

-- ════════════════════════════════════════════════════════════════════════════
-- PRIMEIRO ACESSO
-- 1) Em Authentication → Users, crie o usuário do proprietário (e-mail + senha).
-- 2) Rode, trocando o e-mail:
--
--   insert into public.admin_users (user_id, email, role)
--   select id, email, 'owner' from auth.users where email = 'voce@seudominio.com.br';
-- ════════════════════════════════════════════════════════════════════════════
