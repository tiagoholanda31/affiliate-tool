# RUNBOOK — Affiliate Tool

Operação do app em `https://affiliates.example.com`. Segredos só no EasyPanel
(e no `.env` local). Este arquivo não contém senhas, chaves nem tokens.

## Contatos

| papel | quem |
| ----- | ---- |
| Dev / infra (VPS, EasyPanel, n8n) | operator |
| Conteúdo / termos | program owner |
| Pagamentos | Pagar.me dashboard |
| E-mail transacional | Resend (`mail.example.com`) |

## URLs

| o quê | onde |
| ----- | ---- |
| App | `https://affiliates.example.com` |
| Health | `GET /api/health` → `{ ok, db, version }` |
| Webhook Pagar.me | `POST /api/webhooks/pagarme` (Basic Auth) |
| Crons | `POST /api/cron/<job>` com `Authorization: Bearer <CRON_SECRET>` |
| Admin | `/admin` |
| Painel afiliado | `/painel` |

`version` é o `BUILD_SHA` injetado no build (EasyPanel: git SHA como build arg). Sem arg, vale `"dev"`.

Rotas `/dev/*` respondem **404 em produção** (proxy + `notFound()` nas páginas).

## Deploy

1. Push em `main` (EasyPanel: *Deploy on push*).
2. Conferir logs: `Aplicando migrations…` → servidor na porta 3000.
3. `GET /api/health` deve ser 200 com `ok: true`, `db: true`, `version` = SHA do deploy.
4. Smoke rápido: `/` carrega; `/entrar` abre; um Pix de teste se as chaves de produção estiverem no ar.

Build args obrigatórios no EasyPanel (embutidos no bundle): `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`, `BUILD_SHA`.

Env de runtime: copiar de `.env.example` com valores reais. Volume `affiliate-storage` → `/data/storage`. Sem o volume, uploads somem no redeploy.

`pnpm audit --prod` deve estar limpo (ou justificado em `docs/PROGRESS.md`) **antes** de cada deploy.

## Rollback

EasyPanel → serviço `web` → *Deployments* → *Redeploy* da imagem anterior.

Migrations são só para frente. Se a fatia tiver migration destrutiva, restaurar backup do Postgres (abaixo). Regra: migration aditiva primeiro; drop de coluna só na fatia seguinte.

## Trocar chaves Pagar.me

1. Dashboard da conta (teste ou produção) → copiar `sk_` e `pk_`.
2. EasyPanel → env: `PAGARME_SECRET_KEY`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`.
3. `PAGARME_DRIVER=real`.
4. Webhook no dashboard: URL `https://affiliates.example.com/api/webhooks/pagarme`, Basic Auth = `PAGARME_WEBHOOK_USER` / `PAGARME_WEBHOOK_PASSWORD`, eventos de `docs/spec/06-pagamentos-pagarme.md`.
5. Redeploy (a `pk_` entra no bundle no **build**).
6. Pedido Pix de R$ 1,00 → conferir `/admin/sistema` (webhook PROCESSED) → estornar no dashboard → comissão `REVERSED`.

## Rotacionar `ENCRYPTION_KEY`

App em manutenção (ninguém alterando Pix nem fechando pedido).

```
OLD_KEY=<chave atual> NEW_KEY=<openssl rand -base64 32> pnpm keys:rotate
```

O script re-encripta `Affiliate.pixKeyEncrypted` e `Order.customerDocEnc`. Depois:

1. EasyPanel: `ENCRYPTION_KEY=<NEW_KEY>`
2. Redeploy
3. Abrir um afiliado em `/admin/pagamentos` e *Revelar* Pix (audit `pix.reveal`) para conferir.

Rodar a partir de uma máquina com o repositório e `DATABASE_URL` apontando para o banco (a imagem de produção é slim e não traz `tsx`).

## Criar admin

Primeiro boot (sem seed de exemplo):

```
SEED_ADMIN_PASSWORD='…≥14 chars…' ADMIN_EMAIL='…' DATABASE_URL='…' pnpm admin:create
```

Se o e-mail já existir como `ADMIN`, o script não mexe na senha. A cliente troca a senha em `/painel/perfil` (fluxo de senha do Better Auth) no primeiro acesso.

**Não** rode `pnpm db:seed` em produção — cria afiliados e produtos de teste. `scripts/seed-volume.ts` é recusado em produção.

## Reprocessar webhook

`/admin/sistema` → aba Webhooks → reprocessar pelo `eventId`. Idempotente: evento já `PROCESSED` não aplica de novo o dinheiro.

Se o Pagar.me não reenviar: conferir Basic Auth, URL pública e se o `gatewayOrderId` existe no pedido.

## E-mail (Resend free estourou)

Sintoma: `EmailLog` em `FAILED`, alerta admin, `/admin/sistema` aba E-mails.

1. Painel Resend → cota / domínio `mail.example.com`.
2. Fallback: `MAIL_DRIVER=smtp` + your SMTP credentials in EasyPanel, redeploy.
3. Reenviar pela aba E-mails (reseta tentativas) ou esperar o cron `retry-emails` (10 min).

## Backups e restore

- Postgres: EasyPanel *Backups* (R2/S3) diário 02:00, retenção 14 dias.
- Volume `/data/storage`: tar semanal no mesmo destino.

**Restore (testar em serviço temporário, não em produção):**

1. Subir um Postgres `db-restore` no EasyPanel.
2. `pg_restore` (ou `psql` no dump) nesse serviço.
3. `SELECT count(*) FROM "Order";` — tem de bater com o dump de origem.
4. Derrubar `db-restore`.

Anotar a data do último restore testado em `docs/PROGRESS.md`.

## Crons (n8n)

Workflow "Affiliate Tool Crons", URL **pública** (Traefik), header `Authorization: Bearer <CRON_SECRET>`:

| job | intervalo | alerta se atrasado |
| --- | --------- | ------------------ |
| release-commissions | 24 h | > 48 h |
| reconcile-orders | 15 min | > 30 min |
| anonymize-removed | 24 h | > 48 h |
| retry-emails | 10 min | > 20 min |
| purge-clicks | 24 h | > 48 h |

Erro HTTP → e-mail/WhatsApp do operador. A página `/admin/sistema` destaca jobs atrasados.

## Monitor

UptimeRobot / Better Stack (free) a cada 5 min em `/api/health`. Falha → e-mail/WhatsApp do operador.

## Segurança rápida

- `pnpm audit --prod` antes do deploy
- Checklist em `docs/spec/04-seguranca.md`
- CSP com nonce em `src/proxy.ts` (produção sem `unsafe-eval` em scripts)
- HSTS: `max-age=63072000; includeSubDomains; preload`
