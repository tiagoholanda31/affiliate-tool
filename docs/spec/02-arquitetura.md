# 02 · Arquitetura

## Decisão de stack

Next.js full-stack em um único container + PostgreSQL 16, no EasyPanel da VPS.
Justificativa: um processo, um deploy, sem API separada; Server Components reduzem JS no cliente (afiliados
usam celular). A implementação real usa Next 16 + Prisma 7 (ver D-013 em `docs/DECISIONS.md`).

Alternativa descartada: hospedar o app no mesmo plano PHP/WordPress do site institucional — inviável para filas, arquivos e isolamento.

## Versões-alvo (fixar no `package.json` com `^` apenas em patch)

Next 15.x · React 19 · TypeScript 5.x · Prisma 6.x · Better Auth 1.x · Tailwind 4 · Zod 3.x · Vitest 3 · Playwright 1.5x · Node 22 LTS · pnpm 10

## Camadas

```
┌───────────────────────── src/app (rotas) ──────────────────────────┐
│ Server Components (leitura)   Server Actions (escrita)   Route Handlers (webhooks, cron, download) │
└──────────────┬──────────────────────┬──────────────────────┬────────┘
               ▼                      ▼                      ▼
        features/*/queries.ts  features/*/actions.ts   app/api/**/route.ts
               │                      │                      │
               └──────────► features/*/service.ts ◄──────────┘   (regras puras, testáveis, sem Next)
                                      │
                     ┌────────────────┼────────────────┐
                     ▼                ▼                 ▼
               lib/db (Prisma)  server/pagarme    lib/mail · lib/storage · server/n8n
```

- **queries.ts**: funções `async` chamadas por Server Components. Recebem `session` já resolvida. Usam `cache()`/`unstable_cache` com tags por entidade quando útil.
- **actions.ts**: `"use server"`. Sempre via wrapper `authedAction(schema, handler)` ou `adminAction(schema, handler)` (`src/lib/safe-action.ts`): valida com Zod, resolve sessão, checa role/status do afiliado, executa, grava `AuditLog` se `audit: {...}` informado, retorna `ActionResult<T> = { ok: true, data } | { ok: false, error: string, fieldErrors? }`.
- **service.ts**: recebe dados primitivos + `tx: PrismaClient | Prisma.TransactionClient`. Sem `headers()`, `cookies()`, `redirect()`. Aqui vivem máquinas de estado (`transitionAffiliate`, `transitionOrder`, `calculateCommission`, `buildPayout`).
- **Route Handlers** (`app/api/`): só para o que não pode ser action: `webhooks/pagarme`, `cron/*`, `download/[token]`, `r/[code]`, `health`, `auth/[...all]`.

## Módulos em `src/features/`

`auth` · `affiliates` · `products` · `tracking` (links/cliques) · `checkout` · `orders` · `commissions` · `payouts` · `materials` · `settings` · `dashboard` · `audit`

Cada módulo pode importar de `lib/` e `server/`, e de outros módulos **apenas** via `service.ts` (nunca componentes cruzados).

## `src/lib/`

| arquivo                      | responsabilidade                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `env.ts`                     | `@t3-oss/env-nextjs` + Zod. Server: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `APP_URL`, `ENCRYPTION_KEY` (32 bytes base64), `REF_COOKIE_SECRET`, `PAGARME_SECRET_KEY`, `PAGARME_WEBHOOK_USER/PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_DRIVER=resend\|smtp\|log`, `SMTP_*`, `STORAGE_DIR=/data/storage`, `CRON_SECRET`, `N8N_WEBHOOK_URL?`, `N8N_WEBHOOK_SECRET?`, `ADMIN_EMAIL`. Client: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`. |
| `db.ts`                      | singleton Prisma com log de queries lentas (> 300 ms) em dev.                                                                                                                                                                                                                                                                                                                                                                                                            |
| `auth.ts` / `auth-client.ts` | Better Auth config (Prisma adapter, emailAndPassword, `requireEmailVerification`, `sendVerificationEmail`/`sendResetPassword` via `lib/mail`, sessão 7 dias, `additionalFields.role`). Helper `getSession()`, `requireAdmin()`, `requireAffiliate({ statuses })`.                                                                                                                                                                                                        |
| `safe-action.ts`             | wrappers descritos acima.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `money.ts`                   | `formatBRL(cents)`, `parseBRL(str)`, `percentFromBp`, `applyPercent` (half-even).                                                                                                                                                                                                                                                                                                                                                                                        |
| `dates.ts`                   | `date-fns` + `@date-fns/tz` com `SAO_PAULO`. `formatDate`, `formatDateTime`, `addBusinessDays?` (não usar), `nextPayoutDate(payoutDay)`.                                                                                                                                                                                                                                                                                                                                 |
| `crypto.ts`                  | AES-256-GCM `encrypt(text)`/`decrypt(payload)` com `ENCRYPTION_KEY`; `mask(pixKey, type)`; `sha256`; `randomToken(bytes)`; `hashToken`.                                                                                                                                                                                                                                                                                                                                  |
| `mail/`                      | `sendMail({ to, template, props })` com drivers `resend`, `smtp` (nodemailer), `log` (dev/test). Grava `EmailLog`. Retry 3× com backoff.                                                                                                                                                                                                                                                                                                                                 |
| `storage.ts`                 | `saveFile(buffer, { dir, ext })` → `{ path, sha256, size }`; `openStream(path)`; `deleteFile`. Raiz `STORAGE_DIR`, subpastas `products/`, `materials/`, `proofs/`. Nomes = uuid. Valida magic bytes (`file-type`).                                                                                                                                                                                                                                                       |
| `rate-limit.ts`              | token bucket em memória (single instance) com chaves por IP/rota: login 10/15min, signup 5/h, checkout 20/h/IP, webhook 600/min, download 30/h/token. Falha aberta se memória zerar (log).                                                                                                                                                                                                                                                                               |
| `logger.ts`                  | `pino` JSON em prod, pretty em dev. Nunca loga PII completa (usa mask). `requestId` por request via `headers`.                                                                                                                                                                                                                                                                                                                                                           |
| `http.ts`                    | helpers de Route Handler: `json`, `unauthorized`, `badRequest`, `getClientIp` (respeita `x-forwarded-for` do Traefik).                                                                                                                                                                                                                                                                                                                                                   |
| `i18n/pt-BR.ts`              | mensagens de erro reutilizadas e labels de enums.                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Jobs (sem fila dedicada)

Route Handlers protegidos por `Authorization: Bearer ${CRON_SECRET}`, agendados **no n8n** (já na VPS) ou no cron do EasyPanel:

| rota                                 | frequência    | faz                                            |
| ------------------------------------ | ------------- | ---------------------------------------------- |
| `POST /api/cron/release-commissions` | diário 03:00  | `PENDING` → `AVAILABLE` vencidas; envia digest |
| `POST /api/cron/reconcile-orders`    | a cada 15 min | reconciliação Pagar.me; expira Pix             |
| `POST /api/cron/anonymize-removed`   | diário 04:00  | anonimiza afiliados `REMOVED` há > 30 dias     |
| `POST /api/cron/retry-emails`        | a cada 10 min | reenvia `EmailLog.status=FAILED` (máx 3)       |

Cada job é idempotente e registra `JobRun` (nome, início, fim, contagem, erro). Página admin "Sistema" lista últimas execuções.

## Cache e revalidação

- Server Components leem direto do banco (Node runtime). Sem `fetch` interno.
- Tags: `affiliate:<id>`, `products`, `product:<id>`, `orders`, `commissions:<affiliateId>`, `settings`, `materials`.
- Mutations chamam `revalidateTag` das entidades tocadas + `revalidatePath` da rota atual.
- Dashboard do afiliado: `unstable_cache` 60 s por afiliado.

## Tratamento de erros

- `AppError extends Error { code, status, expose }` em `lib/errors.ts`. Services lançam `AppError` para erros de domínio (`AFFILIATE_NOT_APPROVED`, `PRODUCT_INACTIVE`, `INVALID_TRANSITION`…).
- `safe-action` converte `AppError.expose` em `{ ok:false, error }`; qualquer outro erro → log + `"Algo deu errado. Tente novamente."`.
- `app/error.tsx` e `not-found.tsx` com identidade visual; `global-error.tsx` mínimo.

## Testes

- **Unit** (`*.test.ts` ao lado): services, money, dates, crypto, validators (CPF/CNPJ/Pix), máquina de estados. Cobertura mínima 90% em `features/*/service.ts` e `lib/`.
- **Integration** (`tests/integration/`): actions e route handlers contra Postgres real (`docker compose` `db_test`, `DATABASE_URL_TEST`), com `prisma migrate deploy` no setup e truncate entre testes.
- **E2E** (`tests/e2e/`): Playwright — cadastro→aprovação→link→checkout Pix (fake gateway)→webhook→comissão→lote pago→extrato. Roda com `PAGARME_DRIVER=fake`.
- Fábricas em `tests/fixtures/` (`makeAffiliate`, `makeProduct`, `makeOrder`).

## Convenções

- Nomes de arquivo `kebab-case.tsx`; componentes `PascalCase`; server actions `verbNoun` (`approveAffiliate`).
- Rotas: `(public)/` vitrine, `/p/[slug]`, `/pedido/[code]`, `/r/[code]/[[...slug]]` · `(auth)/entrar`, `/cadastro`, `/verificar-email`, `/recuperar-senha` · `(affiliate)/painel/**` · `(admin)/admin/**`.
- `middleware.ts` (ou proxy do Next 15.x conforme versão): redireciona não autenticado; **não** decide role (isso é no layout do route group com `requireAdmin`/`requireAffiliate`, que também checa status).
- Formulários: React Hook Form + `zodResolver` com o **mesmo** schema da action (`schemas.ts` compartilhado, sem campos server-only).
- IDs: `cuid2`. Nunca expor IDs sequenciais.
