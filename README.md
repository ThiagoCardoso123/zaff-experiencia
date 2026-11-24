# Zaff · Plataforma de Avaliação de Experiência

Formulário de avaliação para o cliente (mobile) e painel de gestão da experiência para o restaurante (desktop), com a identidade visual oficial do Zaff Gastronomia.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Auth) · Resend · Recharts

---

## Colocando no ar

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, cole e execute `supabase/migrations/0001_init.sql`.
3. Em **Authentication → Users**, crie o usuário do proprietário (e-mail + senha, com "Auto Confirm User").
4. De volta ao SQL Editor, dê a ele o acesso de proprietário (troque o e-mail):

   ```sql
   insert into public.admin_users (user_id, email, role)
   select id, email, 'owner' from auth.users where email = 'voce@seudominio.com.br';
   ```

5. Em **Authentication → Sign In / Providers**, desative "Allow new users to sign up". Novos administradores são criados pelo painel.
6. Em **Project Settings → API**, copie a URL, a chave `anon` e a chave `service_role`.

### 2. Resend

1. Crie uma conta em [resend.com](https://resend.com) e verifique o domínio do restaurante (registros DNS).
2. Gere uma API Key. O remetente (`EMAIL_FROM`) precisa ser desse domínio.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env.local` (desenvolvimento) e cadastre as mesmas variáveis na hospedagem.

| Variável | Para que serve |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Login do painel |
| `SUPABASE_SERVICE_ROLE_KEY` | Gravação das avaliações no servidor. **Nunca** exponha no navegador |
| `RESEND_API_KEY` / `EMAIL_FROM` | Envio de e-mails |
| `NEXT_PUBLIC_SITE_URL` | Domínio final. Vai nos QR Codes e nos links do e-mail |
| `CRON_SECRET` | Protege a rota de reenvio automático |
| `IP_HASH_SALT` | Texto aleatório usado no antispam |

### 4. Rodar e publicar

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes dos indicadores e insights
npm run build
```

Para publicar na Vercel: importe o repositório, cadastre as variáveis e aponte o domínio próprio. O `vercel.json` já agenda o reenvio diário de e-mails pendentes (no plano Pro é possível reduzir o intervalo, por exemplo `*/15 * * * *`).

### 5. Primeiros passos no painel (`/admin`)

1. **Configurações → E-mails:** informe quem recebe as avaliações.
2. **Configurações → Mesas:** cadastre as mesas (aceita `1-20`).
3. **Configurações → Mensagens:** cole o link de avaliação do Google.
4. **QR Codes:** baixe os códigos em PNG ou SVG e imprima.

---

## Como funciona

### Rotas

| Rota | Quem usa |
|---|---|
| `/avaliar` | Cliente. Aceita `?mesa=12`, `?origem=comanda`, `?origem=promo&campanha=nome` |
| `/privacidade` | Cliente. Aviso de privacidade (LGPD) |
| `/admin` | Gestor. Visão geral, indicadores, gráficos e Insights da Experiência |
| `/admin/feedbacks` | Central de feedbacks, com exportação CSV |
| `/admin/qrcodes` | Geração de QR Codes |
| `/admin/configuracoes` | E-mails, perguntas, mensagens, mesas, identidade, usuários |

### Regras de negócio

- **Positiva:** nota geral 4 ou 5. **Regular:** 3. **Negativa / crítica:** 1 ou 2.
- Quem dá nota 4 ou 5 vê a pergunta e o agradecimento "positivos"; os demais veem a versão de melhoria.
- O botão do Google aparece para **todos**, qualquer que seja a nota (filtrar por nota contraria as políticas do Google).
- **Índice de satisfação:** média de todas as notas de 1 a 5 (geral e categorias), convertida para 0–100.
- **NPS:** % de promotores (9–10) menos % de detratores (0–6).
- **Críticas aguardando atendimento:** nota 1 ou 2 com status diferente de "resolvido", em todo o histórico.
- Datas, dias da semana e horários seguem o fuso de Brasília (`src/lib/constants.ts`).

### Insights da Experiência

Regras em `src/lib/insights.ts`. Nenhuma frase é gerada por IA: cada uma vem de um cálculo sobre as avaliações do período e mostra os números em que se baseia. Cada análise exige um mínimo de dados (objeto `MIN` no mesmo arquivo); abaixo dele, o painel informa que não há dados suficientes em vez de afirmar algo.

| Análise | Mínimo |
|---|---|
| Melhor / pior categoria | 10 respostas em pelo menos duas categorias, diferença ≥ 0,2 |
| Dia da semana acima / abaixo da média | 20 avaliações no período, 5 no dia, diferença ≥ 0,3 |
| Melhora / queda frente ao período anterior | 10 avaliações em cada período, diferença ≥ 0,2 |
| Motivo mais citado | 5 menções |
| Horário que concentra negativas | 5 negativas, 40% delas na mesma hora |

### E-mails

- Enviados logo após a resposta ao cliente; a avaliação é salva antes e não depende do envio.
- Nota geral ≤ 2 com alertas ativos: assunto `[ATENÇÃO] Nova avaliação negativa — Zaff`, prioridade alta e destinatários extras de alerta.
- Falhou? A avaliação fica marcada e é reenviada automaticamente (a cada nova avaliação e pelo agendamento diário, até 5 tentativas) ou manualmente, na página da avaliação.
- Contato do cliente só entra no e-mail quando foi informado **e** autorizado.

### Segurança

- O navegador do cliente nunca fala com o banco. O formulário envia para `/api/avaliacoes`, que valida (Zod), aplica antispam e grava com a chave de serviço.
- RLS ativo em todas as tabelas, sem nenhuma política para visitantes. Usuários autenticados só leem algo se estiverem em `admin_users`.
- Antispam: campo-isca, tempo mínimo de preenchimento, limite de 5 envios por conexão a cada 10 minutos e checagem de origem.
- Painel protegido por middleware + verificação de administrador em cada página e em cada ação.
- CSV protegido contra injeção de fórmulas.

### LGPD

- Nome e WhatsApp são opcionais. Sem autorização de contato, o WhatsApp não é armazenado.
- O IP nunca é guardado, apenas um hash com sal, usado no limite de envios.
- Em cada avaliação há **Excluir dados pessoais** (mantém as notas, já anônimas) e **Excluir a avaliação inteira**.
- `/privacidade` explica o tratamento ao cliente; o contato exibido é configurável.

### Identidade visual

- Logotipos em `public/brand/`, extraídos em vetor do manual da marca (versão colorida, creme, selo e folha).
- Cores oficiais: vermelho `#882214`, creme `#EBE7DC`, verde `#58A112`, caramelo `#B48E69`.
- **Tipografia:** o manual traz o logotipo em curvas, sem o arquivo da fonte. O logotipo é usado como imagem; para os textos foram escolhidas Cormorant Garamond (títulos) e Jost (interface), que acompanham o desenho da marca. Se o Zaff tiver uma fonte institucional licenciada, troque em `src/app/layout.tsx`.

---

## Estrutura

```
supabase/migrations/0001_init.sql   tabelas, índices e políticas de segurança
src/app/avaliar                     formulário público
src/app/api/avaliacoes              recebimento das avaliações
src/app/api/cron/reenviar-emails    reenvio automático
src/app/admin                       painel (login, páginas e ações)
src/components/survey               formulário e seu CSS
src/components/admin                gráficos, filtros, QR Codes, formulários
src/lib                             indicadores, insights, e-mail, validação, datas
tests                               testes dos indicadores e insights
```

## Limites conhecidos

- O painel carrega até 50.000 avaliações por consulta; acima disso, avisa e pede um período menor.
- A edição de perguntas altera textos e ativa/desativa etapas; os tipos de resposta (estrelas, 0–10 etc.) são fixos.
- O logotipo alternativo é informado por URL; não há upload de arquivo.
