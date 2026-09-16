# Architecture

Self-hosted affiliate platform: tracked links, first-party checkout (Pix + card via Pagar.me), commissions with a hold period, manual payouts, and grant-based digital delivery.

The UI is **Brazilian Portuguese**. Money is **integer cents**. Dates are **UTC in the database** and displayed in `America/Sao_Paulo`. Secrets never leave `src/lib/env.ts`.

Canonical decisions: [`DECISIONS.md`](./DECISIONS.md). Domain rules: [`spec/01-dominio-e-regras.md`](./spec/01-dominio-e-regras.md).

---

## Why this shape

| Constraint | Architectural answer |
| --- | --- |
| Affiliates mostly on phones | Server Components by default; `"use client"` only on interactive leaves |
| Operator already has a VPS + EasyPanel | One Docker image + Postgres; no extra SaaS besides Pagar.me and Resend |
| Low volume (dozens of affiliates, hundreds of orders/month) | In-process rate limit, in-memory caches, n8n/EasyPanel cron — no Redis/queue |
| LGPD | Encrypt Pix keys and buyer documents at rest (AES-256-GCM); mask in the UI; anonymize removed affiliates after 30 days |
| Attribution must survive a round-trip to checkout | Signed HttpOnly JWT cookie, last-click, configurable window |
| Gateway cannot be trusted blindly | Webhook Basic Auth **and** re-fetch the order before any money/status transition |

---

## Runtime stack

| Layer | Choice | Notes |
| --- | --- | --- |
| App | Next.js 16 (App Router) · React 19 · TypeScript 5.9 strict | `src/proxy.ts` replaces `middleware.ts` (D-013) |
| UI | Tailwind CSS 4 · shadcn/ui · lucide-react · Recharts · TanStack Table | Light theme only (D-015) |
| Forms | React Hook Form + Zod | Same schema in the browser and in Server Actions |
| Auth | Better Auth | Email/password, verification, DB sessions, roles `ADMIN` \| `AFFILIATE` |
| ORM | Prisma 7 + `@prisma/adapter-pg` | URL in `prisma.config.ts`, never `db push` |
| Database | PostgreSQL 16 | IDs are `cuid2`; no sequential public IDs |
| Payments | Pagar.me Core API v5 | Pix QR + card tokenization in the browser; `PAGARME_DRIVER=fake` in tests |
| Email | Resend · SMTP fallback · `log` in dev | React Email templates |
| Files | Local volume | Magic-byte validation (`file-type`); grants for downloads |
| Jobs | HTTP cron + `CRON_SECRET` | Idempotent; recorded in `JobRun` |
| Tests | Vitest + Testing Library · Playwright | Real Postgres for integration; fake gateway for e2e |
| Deploy | Multi-stage Docker, `output: "standalone"` | Non-root, migrator stage (D-016), EasyPanel + Traefik |

---

## Container view

```
                   ┌──────────── visitors / affiliates / admin ────────────┐
                   │  Browser (pt-BR UI)                                   │
                   │   · card tokenization → api.pagar.me (public key)     │
                   └─────────────────────────┬─────────────────────────────┘
                                             │ HTTPS (Traefik)
                                             ▼
┌────────────────────────────────── Next.js (one process) ──────────────────────────────────┐
│  src/app          routes: (public) (auth) (affiliate) (admin) api/                         │
│  src/proxy.ts     auth redirect, CSP nonce, production 404 for /dev/*                      │
│  features/*/      queries · actions · schemas · service (pure) · components                │
│  lib/             env · db · money · dates · crypto · mail · storage · rate-limit          │
│  server/          pagarme/ (real | fake) · n8n/ · jobs                                     │
└────────────┬───────────────────┬───────────────────┬───────────────────┬──────────────────┘
             │                   │                   │                   │
             ▼                   ▼                   ▼                   ▼
        PostgreSQL 16      Pagar.me v5           Resend/SMTP        Volume /data/storage
        (Prisma)           webhooks + API        React Email        products/ materials/ proofs/
             ▲
             │  n8n or EasyPanel cron
             │  Authorization: Bearer CRON_SECRET
             └── POST /api/cron/{release-commissions,reconcile-orders,
                                 anonymize-removed,retry-emails,purge-clicks}
```

There is no separate API service. Server Components read; Server Actions write; Route Handlers exist only for webhooks, cron, download, tracking redirects, health, and Better Auth.

---

## Layering (non-negotiable)

```
src/app  (thin)
   │  Server Components → features/*/queries.ts
   │  Server Actions    → features/*/actions.ts   (authedAction / adminAction)
   │  Route Handlers    → app/api/**/route.ts
   ▼
features/*/service.ts   pure domain: state machines, money, no Next APIs
   │
   ├── lib/db (Prisma)
   ├── server/pagarme
   ├── lib/mail · lib/storage · server/n8n
   └── lib/crypto · lib/money · lib/dates
```

- **queries.ts** — async reads for Server Components. Session already resolved. Cache tags per entity when useful.
- **actions.ts** — `"use server"`. Always through `authedAction` / `adminAction` in `src/lib/safe-action.ts`: Zod → session → role/status → handler → optional `AuditLog` → `{ ok: true, data } | { ok: false, error }`.
- **service.ts** — primitives + `tx: PrismaClient | Prisma.TransactionClient`. No `headers()`, `cookies()`, `redirect()`. This is where `transitionAffiliate`, `transitionOrder`, `calculateCommission`, `buildPayout` live.
- Cross-feature imports go through `service.ts` only, never through another feature's components.

Feature modules: `auth` · `affiliates` · `products` · `tracking` · `checkout` · `orders` · `commissions` · `payouts` · `delivery` · `materials` · `settings` · `dashboard` · `audit` · `system` · `search`.

---

## Domain

### Actors

| Actor | Access |
| --- | --- |
| Visitor / buyer | No account. Arrives via `/r/<code>/...`, pays, gets email. Digital products get a download grant. |
| Affiliate | Signs up, waits for approval, copies links, tracks clicks/sales/commissions, downloads promo materials. |
| Admin | Approves affiliates, manages catalog and materials, records manual sales, pays commission batches, configures hold/payday/terms. |
| System | Attribution, commission math, webhooks, email, file grants, anonymization. |

### Money and time

- Amounts: `Int` cents. `R$ 199,90` = `19990`.
- Percents: basis points. `15,00%` = `1500`. Rounding is **half-even** (D-024).
- Dates: UTC in Postgres; format in `America/Sao_Paulo` via `src/lib/dates.ts`. No bare `new Date()` in UI.

### Affiliate lifecycle

`PENDING → APPROVED | REJECTED` · `APPROVED → SUSPENDED → APPROVED` · any → `REMOVED` (anonymized after 30 days).

First approval generates a short unique `code` used in `/r/<code>`. Status email is sent **after** the transaction commits (D-020).

### Order lifecycle

`PENDING → PAID | FAILED | EXPIRED | CANCELED` · `PAID → REFUNDED | CHARGEDBACK`.

Sources: `CHECKOUT` or `MANUAL`. Payment methods: `PIX`, `CREDIT_CARD`, `MANUAL`.

### Commission lifecycle

Created on `PAID` (if attributed). `PENDING` until `holdDays` elapse, then `AVAILABLE`. Admin groups `AVAILABLE` rows into a `Payout` (`DRAFT → PAID`). Refund/chargeback → `REVERSED` (+ adjustment if already paid).

Self-purchase (same email as the affiliate) is refused. Same IP is only flagged (D-011).

### Attribution

1. Hit `/r/<code>` or `/r/<code>/<productSlug>`.
2. Resolve affiliate (in-process TTL cache). Ignore obvious bots.
3. Insert `Click` (unique by cookie id). Fire-and-forget after uniqueness check.
4. Set `if_ref` JWT cookie (`{ a, c, exp }`, HS256, HttpOnly, SameSite=Lax).
5. Redirect to `/` or `/p/<slug>`.
6. Checkout reads the cookie. Last click inside `attributionDays` (default 30) wins.

A tampered or expired cookie is `null` — the sale still completes, unattributed.

### Digital delivery

On `PAID` of a `DIGITAL` product, a `DownloadGrant` is created: hashed token, expiry (`downloadGrantDays`), max hits (`downloadMaxCount`). `/download/<token>` streams the file after checks. The live token is also stored in `Order.metadata` so `/pedido` can show the link without minting a new grant (D-026).

---

## Data model (Prisma)

```
User 1──1 Affiliate
        ├── Click
        ├── Order (optional affiliateId)
        ├── Commission
        └── Payout
Product ── DigitalFile
        └── ProductSlugHistory
Order ── DownloadGrant
      └── Commission ── CommissionAdjustment
                      └── Payout
Setting (singleton id=1)
AuditLog · EmailLog · JobRun · WebhookEvent · Material
```

Better Auth owns `User`, `Session`, `Account`, `Verification`. `User.role` is the only extra field and is not user-writable (`input: false`).

Sensitive at rest: affiliate Pix key and buyer tax id, AES-256-GCM with `ENCRYPTION_KEY`. Rotation: `pnpm keys:rotate` (maintenance window).

---

## HTTP surface

| Area | Routes |
| --- | --- |
| Public | `/`, `/p/[slug]`, `/pedido/[code]`, `/r/[code]/[[...slug]]`, `/termos`, `/privacidade` |
| Auth | `/entrar`, `/cadastro`, `/verificar-email`, `/recuperar-senha` |
| Affiliate | `/painel/**` (blocked unless `APPROVED`, except waiting/rejected/suspended screens) |
| Admin | `/admin/**` |
| API | `/api/auth/[...all]`, `/api/webhooks/pagarme`, `/api/cron/*`, `/api/health`, `/api/admin/uploads/[kind]`, `/api/admin/export/[resource]`, `/download/[token]` |

`src/proxy.ts` redirects unauthenticated users on protected prefixes. **Role is not decided in the proxy** — each route-group layout calls `requireAdmin()` / `requireAffiliate({ statuses })`.

---

## Payments (Pagar.me v5)

```
Browser                         App                              Pagar.me
   │                             │                                  │
   │  card? tokenize (pk)        │                                  │
   │─────────────────────────────┼─────────────────────────────────►│
   │  tok_...                    │                                  │
   │  POST Server Action         │  POST /orders                    │
   │────────────────────────────►│─────────────────────────────────►│
   │                             │  persist Order PENDING           │
   │                             │                                  │
   │                             │  webhook (Basic Auth)            │
   │                             │◄─────────────────────────────────│
   │                             │  getOrder (re-fetch!)            │
   │                             │─────────────────────────────────►│
   │                             │  transition PAID / refund / …    │
```

Pagar.me v5 has **no HMAC**. Defense in depth: Basic Auth on the webhook + always re-query `getOrder` before transitioning (D-023). Idempotency is keyed on `WebhookEvent`.

Tests never call the real API. `PAGARME_DRIVER=fake` uses `src/server/pagarme/fake.ts`. Without a public key, the browser mints `tok_fake_*`; last4 `0002` declines.

---

## Security

| Control | Where |
| --- | --- |
| Env validation (Zod) | `src/lib/env.ts` — nothing else reads `process.env` |
| CSP nonce + `strict-dynamic` | `src/proxy.ts` + `src/lib/csp.ts` (D-029) |
| HSTS, frame deny, nosniff, Permissions-Policy | `next.config.ts` |
| Server Actions origin allow-list | production only |
| Rate limits (token bucket, in-process) | login, signup, checkout, webhook, download — off in `development` (D-019) |
| Password policy | min 10 chars + common/site-word checks |
| Audit log | admin mutations and money/status changes |
| File uploads | MIME + magic bytes + size caps; UUID names |
| `/dev/*` | 404 in production |

Never expose: absolute storage paths, gateway internal IDs, full Pix keys, full CPF.

---

## Jobs

| Route | Interval | Work |
| --- | --- | --- |
| `POST /api/cron/release-commissions` | 24 h | `PENDING` → `AVAILABLE` past hold; digest email |
| `POST /api/cron/reconcile-orders` | 15 min | Re-fetch gateway; expire Pix |
| `POST /api/cron/anonymize-removed` | 24 h | Anonymize `REMOVED` affiliates older than 30 days |
| `POST /api/cron/retry-emails` | 10 min | Resend `FAILED` EmailLog (max 3, backoff 10m/1h/6h) |
| `POST /api/cron/purge-clicks` | 24 h | Drop old unattributed click rows |

Each job is idempotent and writes `JobRun`. The admin **Sistema** page lists last runs and alerts if a job is more than 2× late.

---

## Caching

- Server Components read Postgres directly (Node runtime). No internal `fetch`.
- Tags: `affiliate:<id>`, `products`, `product:<id>`, `orders`, `commissions:<affiliateId>`, `settings`, `materials`.
- Mutations call `updateTag` / `revalidateTag` + `revalidatePath`.
- Affiliate code lookup: 60 s in-process Map (not shared across replicas).

---

## Errors

`AppError { code, status, expose }` in `lib/errors.ts`. Services throw domain errors (`AFFILIATE_NOT_APPROVED`, `INVALID_TRANSITION`, …). `safe-action` turns `expose` into `{ ok: false, error }`; anything else is logged with context and shown as a generic message.

---

## Tests

| Kind | How |
| --- | --- |
| Unit (`*.test.ts` next to source) | services, money, dates, crypto, CPF/CNPJ/Pix, state machines |
| Integration (`tests/integration/`) | real Postgres (`db_test` on 5434), migrate deploy, truncate between tests |
| E2E (`tests/e2e/`) | Playwright: signup → approve → link → Pix checkout (fake) → webhook → commission → payout → statement. `PAGARME_DRIVER=fake` |

Gate: `pnpm check` = typecheck + lint + unit/integration tests. Must be green before a commit.

---

## Deploy

Multi-stage Dockerfile: build → migrator (Prisma CLI via npm) → slim standalone runner (non-root). Entrypoint runs `migrate deploy` then `node server.js`.

`NEXT_PUBLIC_*` and `APP_URL` are inlined **at build time** — declare them as build arguments, not only as runtime env.

Step-by-step: [`spec/08-deploy-easypanel.md`](./spec/08-deploy-easypanel.md) and [`RUNBOOK.md`](./RUNBOOK.md).

---

## Rebranding a fork

The public name is **Affiliate Tool**. To run this for your own program:

1. Change the visible name in `src/components/layout/brand.tsx`, `src/app/layout.tsx`, `src/lib/auth.ts` (`appName`), and `emails/layout.tsx`.
2. Set `MAIL_FROM`, `ADMIN_EMAIL`, `APP_URL` in `.env`.
3. Replace tokens in `src/app/globals.css` **and** `src/lib/design-tokens.ts` (contrast tests will catch AA regressions).
4. Write real terms in `/admin/configuracoes` (seed terms are a placeholder).
5. Point Pagar.me `statement_descriptor` in `src/server/pagarme/orders.ts` at your 13-character billing name.
