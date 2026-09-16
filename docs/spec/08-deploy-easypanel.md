# 08 · Deploy — VPS + EasyPanel

Alvo: um VPS com EasyPanel (Traefik, Postgres, n8n opcional). Objetivo: rodar este app + Postgres
com reserva de RAM para outros serviços. Os números abaixo cabem em uma KVM 4 (4 vCPU / 16 GB).

## Orçamento de recursos

| serviço                    | limite RAM           | CPU | observação                                                   |
| -------------------------- | -------------------- | --- | ------------------------------------------------------------ |
| `affiliate-tool` (Next) | 512 MB (reserva 256) | 1.0 | `NODE_OPTIONS=--max-old-space-size=384`                      |
| `affiliate-db` (Postgres 16) | 512 MB               | 0.5 | `shared_buffers=128MB`, `work_mem=8MB`, `max_connections=30` |
| build (temporário)         | pico ~2 GB           | —   | acontece no próprio servidor; ok com 16 GB                   |

## Dockerfile (multi-stage, standalone, non-root)

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
RUN pnpm prisma generate && pnpm build

FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=app:app /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=app:app /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=app:app docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && mkdir -p /data/storage && chown -R app:app /data
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["./entrypoint.sh"]
```

`docker/entrypoint.sh`: `set -e; node node_modules/prisma/build/index.js migrate deploy; exec node server.js`.
`next.config.ts`: `output: "standalone"`, `images.remotePatterns` vazio (imagens locais), `experimental.serverActions.bodySizeLimit: "60mb"` (upload PDF) — ou upload via Route Handler com stream (preferido para > 10 MB).
`.dockerignore`: `node_modules .next .git tests docs *.md .env*`.

## Passo a passo no EasyPanel

1. **Projeto** `affiliate-tool` → **Service › Postgres** `db`: imagem `postgres:16-alpine`, senha forte gerada, volume padrão. Em _Advanced › Resources_ limite 512 MB. Anote a URL interna `postgres://…@affiliate_db:5432/affiliate`.
2. **Service › App** `web`: _Source_ = GitHub (repo privado) branch `main`, _Build_ = Dockerfile (`./Dockerfile`). _Deploy on push_ ativado.
3. **Environment** (copiar de `.env.example`, valores reais):
   `DATABASE_URL`, `APP_URL=https://affiliates.example.com`, `BETTER_AUTH_URL` (igual), `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `ENCRYPTION_KEY` (`openssl rand -base64 32`), `REF_COOKIE_SECRET`, `CRON_SECRET`, `PAGARME_SECRET_KEY`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY`, `PAGARME_WEBHOOK_USER`, `PAGARME_WEBHOOK_PASSWORD`, `PAGARME_DRIVER=real`, `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM`, `ADMIN_EMAIL`, `STORAGE_DIR=/data/storage`, `N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`.
4. **Mounts**: volume `affiliate-storage` → `/data/storage` (arquivos de produtos, materiais, comprovantes). Sem isso, uploads somem no redeploy.
5. **Domains**: `affiliates.example.com` → porta 3000, HTTPS (Let's Encrypt automático via Traefik). Ativar _Compress_.
6. **Resources**: memória 512 MB, CPU 1.
7. **Deploy**. Acompanhar logs: migrations → "Ready". Testar `/api/health`.
8. **Seed inicial em produção**: uma vez, via _Console_ do serviço: `SEED_FORCE=1 node node_modules/prisma/build/index.js db seed`? — preferir script dedicado `node scripts/create-admin.js` (fatia 11) que cria só admin + Setting, sem dados de exemplo.

## DNS (no provedor do operador)

- `afiliados` **A** → IP da VPS (se Cloudflare: _DNS only_ inicialmente; proxied depois de validar TLS — se proxied, ajustar `getClientIp` para `CF-Connecting-IP`).
- Resend: `mail` subdomínio — registros **TXT SPF**, **CNAME/TXT DKIM** fornecidos no painel Resend, **TXT DMARC** `_dmarc.mail` `v=DMARC1; p=none; rua=mailto:…`.

## Pagar.me (produção)

Dashboard → Configurações → Webhooks → URL `https://affiliates.example.com/api/webhooks/pagarme`, autenticação **Basic** com `PAGARME_WEBHOOK_USER/PASSWORD`, eventos listados em `06-pagamentos`. Testar com pedido Pix de R$ 1,00 e estorno.

## Crons (n8n na mesma VPS)

Workflow "Affiliate Tool Crons": 4 Schedule Triggers → HTTP Request `POST https://affiliates.example.com/api/cron/<nome>` com header `Authorization: Bearer <CRON_SECRET>`. Use a URL pública (Traefik) — evita depender de rede interna Docker. Erros → nó de e-mail/WhatsApp do operador.

## Backups

- Postgres: EasyPanel _Backups_ (S3-compatível — pode ser bucket gratuito do Cloudflare R2 10 GB) diário 02:00, retenção 14 dias. Alternativa: workflow n8n `docker exec affiliate_db pg_dump …` para `/data/backups` + upload.
- Volume `affiliate-storage`: incluir no mesmo backup (tar) semanal; arquivos mudam pouco.
- **Teste de restore** documentado em PROGRESS na fatia 11 (subir `db-restore` temporário, `pg_restore`, conferir contagem de pedidos).

## Observabilidade mínima

- `/api/health` (db ping + versão do build via `BUILD_SHA` env). Monitor externo gratuito (UptimeRobot/Better Stack free) a cada 5 min → e-mail/WhatsApp.
- Logs JSON no stdout (EasyPanel Logs). Página `/admin/sistema` com webhooks, jobs e e-mails.
- Alertas por e-mail via `admin-alert` já cobrem erros de negócio.

## Rotação de segredos

- `ENCRYPTION_KEY`: script `scripts/rotate-encryption-key.ts` (`OLD_KEY`, `NEW_KEY`) re-encripta `Affiliate.pixKeyEncrypted` e `Order.customerDocEnc` em lotes. Rodar com app em manutenção.
- `BETTER_AUTH_SECRET`: trocar invalida sessões (aceitável). Chaves Pagar.me: trocar env + redeploy.

## Rollback

EasyPanel mantém imagens anteriores: _Deployments › Redeploy_ da anterior. Migrations são forward-only; para reverter uma fatia com migration destrutiva, restaurar backup. Regra: migrations aditivas primeiro, remoção de coluna só uma fatia depois.

## Otimizações aplicadas (não remover)

`output: standalone` · imagem alpine (~180 MB) · `sharp` em runtime para `next/image` · sem ISR pesado · `max-old-space-size=384` · Postgres com `shared_buffers` baixo · logs sem PII · compressão via Traefik · fontes self-hosted por `next/font`.
