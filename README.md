# Affiliate Tool

Self-hosted affiliate platform for digital products and services.

Affiliates share tracked links. Buyers pay through a first-party checkout (Pix and card via [Pagar.me](https://pagar.me)). Commissions are calculated in-app, held for a configurable period, and paid out manually by the operator. Digital files are delivered through time-limited, hit-capped grants — never as a public URL.

The product UI is Brazilian Portuguese (`pt-BR`). This README and the architecture docs are in English.

> This repository is a **genericized** snapshot of a production system. Client brand, domains, address, WhatsApp, and private files were removed. What remains is the tool itself so you can run, study, or fork it.

## Visual prototype

Click through the product in the browser — no install, no database, no secrets.

**[Open the live prototype](https://tiagoholanda31.github.io/affiliate-tool/)** · or open [`prototype/index.html`](prototype/index.html) locally.

Five screens: overview, storefront, Pix checkout (simulate `order.paid`), affiliate dashboard, admin queue. `⌘K` / `Ctrl+K` opens the command palette.

## What you get

- Affiliate signup, email verification, admin approval / rejection / suspension
- Tracked links (`/r/<code>` and `/r/<code>/<product>`) with last-click attribution
- Catalog of **services** and **digital books** (PDF/EPUB), commissions as % or fixed cents
- Checkout: Pix QR + copy-paste, card tokenization in the browser, installments
- Webhooks + reconciliation job (the gateway is never trusted blindly)
- Hold period, manual sales, refunds/chargebacks, payout batches with proof upload
- Affiliate statement and admin CSV/XLSX exports
- Promo materials (images, PDFs, ready-made copy with `{{link}}`)
- Dashboards, command palette, system health and cron visibility
- Docker image for EasyPanel / any VPS

## Stack

Next.js 16 · React 19 · TypeScript · PostgreSQL 16 · Prisma 7 · Better Auth · Tailwind CSS 4 · shadcn/ui · Pagar.me Core API v5 · Resend · Vitest · Playwright

## Architecture (short)

```
Browser ──HTTPS──► Next.js (App Router, one process)
                      │
                      ├─ Server Components / Actions / Route Handlers
                      ├─ features/*/service.ts     domain (testable, no Next APIs)
                      ├─ PostgreSQL                cents, UTC, cuid2
                      ├─ Pagar.me                  Pix + card; fake driver in tests
                      ├─ Resend / SMTP             React Email
                      └─ local volume              grants, not public paths
```

Money is always **integer cents**. Percentages are **basis points** (`1500` = 15.00%). Dates are UTC in the database and shown in `America/Sao_Paulo`. Every external input goes through Zod. Admin and money mutations write an `AuditLog`.

Full write-up:

- [Architecture](docs/ARCHITECTURE.md) — layers, domain, payments, security, jobs, deploy
- [Decisions (ADR)](docs/DECISIONS.md) — D-001 … D-030, why each choice exists
- [Domain rules](docs/spec/01-dominio-e-regras.md) · [Data model](docs/spec/03-modelo-de-dados.md) · [Security](docs/spec/04-seguranca.md)
- [Runbook](docs/RUNBOOK.md) · [EasyPanel deploy](docs/spec/08-deploy-easypanel.md)

## Quick start

Needs **Node 24**, **pnpm 11**, and **Docker**.

```bash
pnpm install
cp .env.example .env          # generate secrets: openssl rand -base64 32
docker compose up -d db       # Postgres 16 on 5432
pnpm db:migrate
pnpm db:seed                  # admin + sample affiliates (see .env SEED_ADMIN_PASSWORD)
pnpm dev                      # http://localhost:3000
```

Sign in as the admin from `ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. Affiliates from the seed:

| Email | Status |
| --- | --- |
| `afiliado.pendente@exemplo.test` | waiting for review |
| `afiliado.aprovado@exemplo.test` | approved (`brnt4vs`) |
| `afiliado.reprovado@exemplo.test` | rejected (can resubmit) |
| `afiliado.suspenso@exemplo.test` | suspended |

Shared seed password: `afiliado-teste-2026`.

In development, `/dev/ui` shows the component catalog (404 in production). Pagar.me stays on the **fake** driver until you set real keys.

## Commands

```bash
pnpm dev                 # Next.js dev server
pnpm build && pnpm start # production build
pnpm check               # typecheck + lint + tests — required before every commit
pnpm test                # Vitest (unit + integration; needs db_test)
pnpm test:e2e            # Playwright (starts the app)
pnpm db:migrate          # prisma migrate dev
pnpm db:seed
pnpm db:studio
pnpm admin:create        # extra admin, from a workstation with DATABASE_URL
pnpm keys:rotate         # rotate ENCRYPTION_KEY (maintenance window)
docker compose up -d db  # app DB 5432; db_test 5434
```

## Project layout

```
src/app/                 routes — (public) (auth) (affiliate) (admin) api/
src/features/<domain>/   actions.ts · queries.ts · schemas.ts · service.ts · components/
src/components/          shared layout, data-display, feedback, forms
src/lib/                 env · db · money · dates · crypto · storage · rate-limit
src/server/              pagarme/ · n8n/ · jobs
src/proxy.ts             former middleware (auth redirect, CSP nonce)
prisma/                  schema, migrations, seed
docker/                  Prisma config used only in the production image
tests/                   e2e · integration · fixtures
docs/                    architecture, ADRs, spec, slices, runbook
```

Domain rules live in `service.ts`. Actions and Route Handlers are thin: validate → authorize → call service → return.

## Environment

Copy `.env.example`. Nothing reads `process.env` except `src/lib/env.ts` (Zod). Minimum to boot locally:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres (compose default `affiliate:affiliate@localhost:5432/affiliate`) |
| `BETTER_AUTH_SECRET` | 32+ chars |
| `ENCRYPTION_KEY` | 32 bytes base64 — Pix keys and buyer tax ids |
| `REF_COOKIE_SECRET` | signs the attribution cookie |
| `CRON_SECRET` | `Authorization: Bearer` on `/api/cron/*` |
| `PAGARME_DRIVER` | `fake` (default) or `real` |
| `MAIL_DRIVER` | `log` (default) · `resend` · `smtp` |

Production also needs Pagar.me keys, webhook Basic Auth, Resend, `APP_URL`, and a mounted volume at `STORAGE_DIR`.

## Security notes for forks

- Do **not** commit `.env`, `storage/`, or uploaded files.
- Generate new secrets; the example values are placeholders.
- Pagar.me v5 webhooks have no HMAC — use Basic Auth **and** keep the `getOrder` re-fetch.
- `NEXT_PUBLIC_*` and `APP_URL` are baked in at **build** time.

## License

[MIT](LICENSE) © Tiago Holanda

You may use, modify, and run this commercially. You are responsible for your own Pagar.me account, tax/LGPD compliance, and terms of service.
