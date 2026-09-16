# Security

Report vulnerabilities privately. Do not open a public issue with exploit details.

## What this project already does

- All env access goes through `src/lib/env.ts` (Zod). `.env` is gitignored.
- Passwords hashed by Better Auth; sessions in Postgres; `role` is not user-writable.
- Pix keys and buyer tax ids encrypted at rest (AES-256-GCM).
- Attribution cookie is an HttpOnly JWT; tampering yields no attribution.
- Uploads checked by size, MIME, and magic bytes; stored under UUID names.
- Digital files served only with a valid `DownloadGrant`.
- Admin and money/status mutations write `AuditLog`.
- CSP with a per-request nonce in production; `/dev/*` is 404 there.
- Pagar.me webhooks: Basic Auth plus a gateway re-fetch before any transition.

## What you must do when you deploy

1. Replace every secret in `.env.example` (`openssl rand -base64 32`).
2. Use `PAGARME_DRIVER=real` only with test or live keys you own.
3. Put Resend (or SMTP) on a **subdomain** so a burst does not burn the root domain's reputation.
4. Back up Postgres **and** the storage volume.
5. Keep `CRON_SECRET` on the scheduler and nowhere else.

The original production instance's credentials, customer files, and brand assets are **not** in this repository.
