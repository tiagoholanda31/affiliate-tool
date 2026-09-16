# Architecture Decision Records

Chronological log. Add a new entry instead of rewriting old ones.
Format: **context → decision → consequences.**

This is the public, genericized record of every structural choice in Affiliate Tool.
Implementation details live in `docs/spec/` and `docs/ARCHITECTURE.md`.

---

## D-001 · Next.js + Postgres on a self-managed VPS (2026-09-05)

Many operators already host a marketing site on shared PHP/WordPress hosting with no persistent Node/Docker.
**Decision:** the affiliate app runs on its own VPS (EasyPanel + Traefik). The marketing site stays where it is; a subdomain points at the VPS.
**Consequences:** full control of Node, Postgres, volumes, and cron. Document in the contract who owns the infra.

## D-002 · First-party checkout with Pagar.me, manual commission split

**Decision:** checkout lives inside the product (Pix + card). Commissions are calculated in-app and paid out manually by the admin. The data model already reserves `Affiliate.gatewayRecipientId` for automatic split later.
**Consequences:** full control of attribution, but webhooks, reconciliation, and refunds must be treated rigorously.

## D-003 · Better Auth instead of Auth.js

Email/password with verification and reset is native, with sessions stored in the database. Auth.js needs extra work for credentials.
**Consequences:** younger library — pin the minor version and read the docs on the auth slice.

## D-004 · No dedicated queue; crons via n8n (or EasyPanel cron)

Expected volume is low; n8n often already runs on the same VPS. Idempotent Route Handlers gated by `CRON_SECRET`.
**Consequences:** one less moving part; the operator must monitor that the scheduler is alive.

## D-005 · Email: Resend free on a subdomain, SMTP fallback, `log` driver in dev

Zero extra SaaS cost on the MVP. A mail subdomain isolates reputation from the root domain.
**Consequences:** 100 emails/day ceiling — transactional mail is prioritized over operational mail.

## D-006 · Files on a local volume, served by a grant-aware route

Few digital products, no CDN. EasyPanel volume at `/data/storage`.
**Consequences:** volume backup is mandatory. If storage grows, swap `lib/storage.ts` for S3/R2 without touching features.

## D-007 · Google Sheets via n8n, not Google APIs inside the app

Avoids a Google credential and OAuth inside the product. CSV/XLSX export covers the manual case.
**Consequences:** optional `N8N_WEBHOOK_URL` + secret; the app never talks to Google directly.

## D-008 · Playfair Display as the display face

The original brand guide used a licensed font that is not redistributable. Playfair keeps the high-contrast serif character. Swap to `next/font/local` if you have a licensed file.
**Consequences:** no paid font in the public repo.

## D-009 · HEX is the source of truth for color tokens

Brand guides often repeat RGB/CMYK that disagree with the HEX. Tokens in CSS and `src/lib/design-tokens.ts` use HEX.
**Consequences:** contrast tests fail `pnpm check` if a pair drops below WCAG AA.

## D-010 · 7-day hold, no minimum payout, configurable payday

`holdDays` and `payoutDay` live in `Setting`. Commissions become `AVAILABLE` after the hold; the admin pays them in batches.
**Consequences:** cash-flow control without a payment-split integration.

## D-011 · Self-purchase blocked by email; same-IP only flagged

Balance between fraud and false positives (families on the same Wi-Fi).
**Consequences:** an affiliate cannot buy with their own email. Matching IP is recorded as a signal, not an automatic block.

## D-012 · Single admin in the MVP; `Role` already supports many

No admin-management UI. Create extra admins with `pnpm admin:create`.
**Consequences:** phase 2 can add 2FA and multiple operators without a schema rewrite.

## D-013 · Current majors instead of the versions frozen in the original spec (2026-09-05)

The spec (`02-arquitetura`) froze Next 15 / Prisma 6 / Zod 3 / Vitest 3 / Node 22 when those were current. At slice 00 the current stack was already Next 16.3 / Prisma 7.10 / Zod 4.5 / Vitest 5 / Node 24.
**Decision:** a greenfield project should not ship one major behind.
**Exceptions:** TypeScript stays on 5.9 (`typescript-eslint` 8 supports `<6.1`; TS 7 is the new native compiler) and ESLint stays on 9.39 (10 breaks `typescript-eslint`'s scope manager).
**Consequences:** three Next 16 conventions apply everywhere: `middleware.ts` became `src/proxy.ts`; production builds use Turbopack; Prisma 7 needs a driver adapter (`@prisma/adapter-pg`) with the URL in `prisma.config.ts`, not in `schema.prisma`.

## D-014 · Three brand colors darkened to meet WCAG AA (2026-09-05)

Measured pairs: `success #2f7f7a` on the badge background is 4.08:1, `warning #b7791f` is 3.29:1 (both need 4.5:1), and `gold-600 #d1a84b` on white is 2.23:1 — below even the 3:1 large-text floor.
**Decision:** darken the two semantic colors to the AA minimum (`success #2c7773`, `warning #98641a`) and add `gold-700 #8e7233` for gold **as text** on a light background. Surfaces and `gold-500` on navy stay as designed (10.34:1).
**Consequences:** `src/lib/design-tokens.ts` mirrors CSS tokens; `design-tokens.test.ts` fails `pnpm check` if any pair drops below AA.

## D-015 · Light theme only; `dark:` variant neutralized (2026-09-05)

shadcn components ship `dark:` variants. Without declaring `@custom-variant dark`, Tailwind 4 wires them to `prefers-color-scheme` — the UI broke on phones in dark mode (destructive buttons at 60% opacity).
**Decision:** bind the variant to a `.dark` class that we never apply, and set `color-scheme: light`.
**Consequences:** the product is light-only, independent of the device. A future dark theme only needs to toggle `.dark` on `<html>`.

## D-016 · Prisma CLI isolated in the production image (2026-09-05)

pnpm's `node_modules` is a symlink tree into `.pnpm`. Copying only `prisma/` and `@prisma/` into the final image leaves the CLI without `@prisma/config`. `migrate deploy` also needs a config file, and ours is TypeScript — no transpiler in the slim image.
**Decision:** a `migrator` stage installs the CLI with npm (flat tree, ~40 MB) at `/app/migrator`, next to a JavaScript `prisma.config.mjs` used only there.
**Consequences:** two Prisma configs (root TS for development, `docker/` JS for the container). Schema or migration path changes must land in both.

## D-017 · Every email verification lands on `/verificar-email?status=ok` (2026-09-05)

Better Auth resends the verification link when someone signs in before confirming (`emailVerification.sendOnSignIn`). That path ignores the `callbackURL` from signup and falls back to `/`, so people confirm and land on the storefront with no idea their application is pending review.
**Decision:** in `sendVerificationEmail`, always rewrite the link's `callbackURL` to `/verificar-email?status=ok`, regardless of trigger (signup, sign-in, manual resend).
**Consequences:** the status screen handles both success (`?status=ok`) and errors (`?error=TOKEN_EXPIRED`) and offers resend in one place.

## D-018 · Full reload after login (2026-09-05)

After `signInEmail`, the session cookie changes and the destination is another route group (`/painel/*` or `/admin`). `router.push()` swapped the URL but left a blank page (RSC stream aborted or hydration never finished in e2e).
**Decision:** `/entrar` uses `window.location.assign(redirectTo)` instead of `router.push()`.
**Consequences:** no SPA transition, but a full server render of the new route with the session cookie already on the request — more reliable for auth flows.

## D-019 · Rate limits off in development (2026-09-05)

Limits live in memory (`src/lib/rate-limit.ts`) and in Better Auth. The dev server stays up for hours and repeated e2e runs would fill the buckets from loopback.
**Decision:** bypass rate limits when `NODE_ENV === "development"`. Integration tests (`NODE_ENV=test`) and production keep the limits.
**Consequences:** local abuse is not blocked; real protection is guaranteed by tests and production.

## D-020 · Affiliate status transitions: email after commit, cache via `updateTag` (2026-09-05)

Admin actions (approve, reject, suspend, reactivate, remove) change status, generate a code on first approval, revoke sessions, and must notify the affiliate. Email must not stall the mutation or roll it back if the provider fails.
**Decision:** the transition runs inside `db.$transaction` (state, audit, session revoke); the status email is sent **outside** the transaction, after commit. Next 16 changed `revalidateTag` to require a cache-life profile; we use `updateTag` for immediate invalidation, then `router.refresh()` in the UI.
**Consequences:** the affiliate is notified even if Resend queues the message; the UI reflects the new state without a full reload.

## D-021 · Slug history in its own table; covers as three WebPs (2026-09-05)

Changing the slug of an `ACTIVE` product breaks external links. Covers need three sizes with no EXIF.
**Decision:** `ProductSlugHistory` with a unique `slug` — direct lookup in the 301 redirect of `/p/[slug]`. Covers stored as `products/covers/{uuid}-{sm|md|lg}.webp` (4:3 via `sharp`); `Product.coverImagePath` keeps only `-md`, the others are derived by convention. Admin upload at `POST /api/admin/uploads/[kind]` (cover ≤ 8 MB source; digital ≤ 50 MB; magic bytes via `file-type`). Storefront invalidation with `revalidateTag("products", "max")` + `revalidatePath`.
**Consequences:** old slugs keep resolving; the absolute storage path never reaches the client — only IDs and relative paths.

## D-022 · `if_ref` JWT cookie + in-memory code cache (2026-09-05)

Attribution needs a signed cookie and a fast affiliate lookup on the hot path `/r/...`. Next's `unstable_cache` requires the incremental cache (breaks integration tests that call the Route Handler directly).
**Decision:** cookie `if_ref` = HS256 JWT (`jose`) `{ a, c, exp }` with `REF_COOKIE_SECRET`, flags `HttpOnly` + `SameSite=Lax` + `Secure` only in production. Code lookup with a 60 s in-process TTL Map (`getAffiliateByCodeCached`). `Click` insert is fire-and-forget after the uniqueness check (id pre-generated in the cookie). Bots: short list in `BOT_UA_FRAGMENTS`.
**Consequences:** checkout reads `readRef`; a tampered/expired cookie silently becomes `null`. The code cache is not shared across replicas (acceptable for a single-instance MVP).

## D-023 · Pagar.me Core API v5 + CSP enforce + fake tokens (2026-09-05)

Official docs: `POST /orders`, browser tokenization `POST /tokens?appId=pk`, events `order.paid` / `charge.paid` / `charge.refunded` / `charge.chargedback`. v5 has no webhook HMAC — security is dashboard-configured Basic Auth (`PAGARME_WEBHOOK_USER/PASSWORD`) plus a `getOrder` re-fetch before any state transition.
**Decision:** CSP moves from report-only to enforce (`connect-src https://api.pagar.me`). Without `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`, tokenization mints local `tok_fake_*`; last4 `0002` → `tok_decline_*` (e2e decline path).
**Consequences:** production needs `pk_test`/`sk_test` and webhook Basic Auth. The fake driver is mandatory in tests (`PAGARME_DRIVER=fake`).

## D-024 · Half-even rounding on commission: R$ 199.90 × 15% = 2998¢ (2026-09-10)

Banker's rounding is already in `src/lib/money.ts`. 2998.5 falls to the even 2998.
**Decision:** keep half-even; tests use 2998. A fixed amount above the order total is still `min(fixed, amount)`.
**Consequences:** money is always integer cents; percentages are basis points (`1500` = 15.00%). Never `Float`.

## D-025 · Exports with exceljs; CSV BOM + `;` (2026-09-10)

**Decision:** `exceljs` (native numeric types, active maintenance). CSV with UTF-8 BOM and `;` so Excel pt-BR opens accents and decimals correctly.
**Consequences:** exceljs on the admin export route; 10k row cap in `src/lib/export.ts`. Filename `affiliate-<resource>-<yyyymmdd>.{csv|xlsx}`.

## D-026 · Current download token in order metadata (2026-09-10)

`DownloadGrant` only stores `tokenHash`; `/pedido` needs `/download/<token>` without recreating the grant.
**Decision:** when creating/resending a grant, store the plaintext token in `Order.metadata.activeDownloadToken`; clear it on revoke. Read only in Server Components / actions; never logged.
**Consequences:** anyone with DB access (admin/DBA) can see the live token; acceptable for the MVP. Future: encrypted column or an authenticated route that never exposes the grant token.

## D-027 · Promo materials: original + thumb; download counts (2026-09-10)

**Decision:** `thumbPath` on the model; IMAGE keeps the original in `filePath` plus an 800×600 WebP thumb. `downloadCount` increments on authenticated download (aggregate, best-effort). Upload `kind=material` (IMAGE ≤ 10 MB, PDF ≤ 20 MB).
**Consequences:** affiliates download the original; listings use `/api/materials/[id]/thumb`.

## D-028 · Email payload + dashboard indexes (2026-09-10)

Retries and admin resend need the template props; production HTML is PII.
**Decision:** `EmailLog.payload` (JSON) keeps `{ props, replyTo? }` while `QUEUED`/`FAILED`; on `SENT` with a non-`log` driver, clear with `Prisma.DbNull`. Cron `/api/cron/retry-emails` with 10m/1h/6h backoff (max 3). Indexes: `Click(createdAt)`, `Order(status,paidAt)`, `Order(affiliateId,status,paidAt)`, `Commission(createdAt)`.
**Consequences:** payload stays in the DB until a terminal SENT/FAILED; do not log it. Volume seed in `scripts/seed-volume.ts` for `EXPLAIN`.

## D-029 · CSP with nonce; `style-src` keeps `unsafe-inline` (2026-09-10)

The spec asked for a nonce instead of `unsafe-inline`/`unsafe-eval`.
**Decision:** `script-src` uses a per-request nonce + `'strict-dynamic'` (production without `unsafe-eval`). `style-src` keeps `'unsafe-inline'` because Radix/shadcn and the Next runtime inject inline styles. The root layout calls `connection()` so the nonce exists on every page.
**Consequences:** component inline CSS still works; third-party scripts only load if a nonced script loads them. Pagar.me tokenization is `fetch` to `api.pagar.me` (`connect-src`).

## D-030 · Operational scripts stay off the slim image (2026-09-10)

`create-admin` and `rotate-encryption-key` need Prisma + `tsx`.
**Decision:** TypeScript in `scripts/`, run with `pnpm admin:create` / `pnpm keys:rotate` from a machine that has the repo and the target `DATABASE_URL`. The Docker image stays slim (standalone + migrator).
**Consequences:** the EasyPanel console does not run these scripts; the runbook describes the workstation path.

---

## Intentionally deferred (phase 2)

| Item | Why later |
| --- | --- |
| Automatic Pagar.me split | Manual payouts are enough at low volume; `gatewayRecipientId` is reserved |
| S3/R2 storage | Local volume is enough for a handful of PDFs |
| TOTP 2FA for admin | Single operator in the MVP |
| CAPTCHA on signup/checkout | Add if abuse shows up |
| Nonce for CSS (`style-src`) | Blocked by Next/Radix inline styles |
| Multi-admin UI | `Role` already supports it |
| i18n beyond pt-BR | Product copy is Brazilian Portuguese |
| Subscriptions / multi-level affiliates | Out of MVP scope |
