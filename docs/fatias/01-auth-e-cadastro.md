# Fatia 01 · Autenticação e cadastro de afiliado

## Objetivo

Afiliado se cadastra em dois passos (dados + Pix/termos), verifica e-mail, entra e vê a tela correspondente ao seu status.
Admin entra e chega ao `/admin` (vazio). Sessões seguras, reset de senha, rate limit, auditoria.

## Pré-requisito

Fatia 00 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 1 Afiliado — ciclo de vida e cadastro; seção 9 Setting.terms*)
- `docs/spec/03-modelo-de-dados.md` (`User`, `Affiliate`, Better Auth)
- `docs/spec/04-seguranca.md` (Autenticação, Autorização, Dados sensíveis)
- `docs/spec/05-design-system-ux.md` (Padrões 5 e 6; telas Auth e Afiliado `/aguardando` `/suspenso` `/reprovado` `/perfil`)
- `docs/spec/07-emails-notificacoes-integracoes.md` (Provedor, templates `verify-email`, `reset-password`, `affiliate-pending-admin`, `pix-key-changed`)

## Escopo

**Dentro:** Better Auth, telas de auth, cadastro completo, verificação, reset, `requireAdmin`/`requireAffiliate`, telas de status do afiliado, perfil (editar dados, trocar Pix com senha), `lib/mail` com drivers, templates desta fatia, seed do admin, `safe-action.ts`, `AuditLog` de login admin.
**Fora:** aprovação pelo admin (fatia 02) — nesta fatia o status só muda via seed/Prisma Studio para testar telas.

## Tarefas

1. Better Auth com Prisma adapter; `emailAndPassword` com `requireEmailVerification`, `minPasswordLength: 10`, sessão 7 d; `additionalFields: role`; gerar schema e reconciliar com `03`. Rotas `/api/auth/[...all]`. `auth-client.ts` para o browser.
2. `Affiliate` model + migration. Validadores em `features/affiliates/schemas.ts`: telefone BR → E.164, `socialHandle`, Pix por tipo (CPF/CNPJ com DV, e-mail, telefone, aleatória UUID), senha comum (lista top-1000 embutida).
3. `lib/mail/` (drivers `resend`, `smtp`, `log`), `EmailLog`, layout base React Email, templates da fatia. Página `/dev/emails` (dev) para pré-visualizar.
4. Cadastro `/cadastro`: passo 1 (nome, e-mail, senha, celular, rede social + @), passo 2 (tipo + chave Pix com máscara por tipo, termos com link e checkbox). Estado entre passos no client; submit único na action `registerAffiliate` (cria User via Better Auth API server-side + Affiliate criptografando Pix, grava termos com IP). Honeypot + tempo mínimo. Após submit: tela "Confira seu e-mail".
5. `/verificar-email` (callback), `/entrar`, `/recuperar-senha`, `/redefinir-senha`. Mensagens anti-enumeração. Rate limit por IP.
6. `lib/auth.ts` helpers: `getSession`, `requireAdmin` (redirect `/entrar?next=`), `requireAffiliate({ allow: AffiliateStatus[] })` que redireciona `PENDING→/painel/aguardando`, `REJECTED→/painel/reprovado`, `SUSPENDED→/painel/suspenso`, `REMOVED→signOut+/entrar`. Layouts de `(admin)` e `(affiliate)` usam-nos.
7. `lib/safe-action.ts` (`authedAction`, `adminAction`, `ActionResult`), com opção `audit`.
8. Telas de status: `/painel/aguardando` (explica prazo, mostra dados enviados, botão editar), `/painel/reprovado` (motivo + formulário de reenvio → `PENDING`, `reviewCount++`), `/painel/suspenso` (motivo, contato). `/painel` provisório com "Bem-vindo" para `APPROVED`.
9. `/painel/perfil`: editar nome/celular/rede; trocar Pix exige senha atual, grava `AuditLog affiliate.pix_change`, envia `pix-key-changed`; trocar senha revoga outras sessões.
10. Login admin: `AuditLog auth.admin_login` + e-mail `admin-alert`. Seed cria admin com `ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`.
11. `middleware.ts`: protege `/painel/**` e `/admin/**` (só presença de sessão; role no layout).
12. Notificar admin (`affiliate-pending-admin`) quando o e-mail é verificado.

## Critérios de aceite

- Cadastro pelo celular (viewport 390 px) em ≤ 2 telas, com máscaras e validação inline; erros de servidor aparecem no campo certo.
- E-mail não verificado não loga; link expirado mostra opção de reenviar.
- `PENDING`/`REJECTED`/`SUSPENDED` só acessam suas telas de status e `/perfil`; `APPROVED` acessa `/painel`; afiliado nunca acessa `/admin`; admin nunca vê `/painel`.
- Chave Pix aparece mascarada; banco contém apenas `pixKeyEncrypted` + `pixKeyMasked`.
- 5 logins errados → bloqueio temporário com mensagem clara; rate limit em `/api/auth/*`.
- Todos os e-mails desta fatia renderizam em `/dev/emails` e o driver `log` grava `EmailLog`.

## Testes

- Unit: validadores (CPF/CNPJ DV, telefone, Pix por tipo, senha comum), `requireAffiliate` (matriz status→redirect), `safe-action` (rejeita sem sessão, sem role, com Zod inválido, grava audit).
- Integration: `registerAffiliate` cria User+Affiliate criptografando Pix e termos; reenvio após `REJECTED`; troca de Pix sem senha correta falha; sessões revogadas após troca de senha.
- E2E: cadastro → link de verificação lido do `EmailLog` → login → `/painel/aguardando`.

## Handoff

Documentar decisões sobre Better Auth (versão, quaisquer plugins), como o e-mail de verificação foi ligado, e como testar status via seed.
