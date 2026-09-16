# Imagem de produção — multi-stage, standalone, non-root (docs/spec/08).
# Roda no EasyPanel com 512 MB de RAM e 1 vCPU.

FROM node:24-alpine AS base
RUN corepack enable && apk add --no-cache libc6-compat
WORKDIR /app

# ── Dependências ─────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# `--ignore-scripts` pula o postinstall (prisma generate); ele roda no build,
# onde o schema e a config já estão no lugar.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# As `NEXT_PUBLIC_*` são embutidas no bundle do navegador **no build**, não em
# runtime: precisam chegar aqui como build args, senão o app publicado aponta
# para localhost. `APP_URL` faz o mesmo pelos links absolutos das páginas
# estáticas. No EasyPanel, declare estes como Build Arguments do serviço.
ARG APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_PAGARME_PUBLIC_KEY=""
ARG BUILD_SHA=""
ENV APP_URL=$APP_URL \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_PAGARME_PUBLIC_KEY=$NEXT_PUBLIC_PAGARME_PUBLIC_KEY \
    BUILD_SHA=$BUILD_SHA

# Sem SKIP_ENV_VALIDATION o build falharia: os segredos só existem em runtime.
ENV NEXT_TELEMETRY_DISABLED=1 SKIP_ENV_VALIDATION=1
RUN pnpm prisma generate && pnpm build

# ── CLI de migrations ────────────────────────────────────────────────────────
# O `node_modules` do pnpm é uma árvore de symlinks para `.pnpm`; copiar só as
# pastas `prisma`/`@prisma` para a imagem final deixa o CLI sem as dependências.
# Instalar aqui com npm dá uma árvore plana e autocontida (~40 MB) usada só pelo
# `migrate deploy` do entrypoint.
FROM node:24-alpine AS migrator
WORKDIR /migrator
RUN npm install --no-save --omit=dev prisma@7.10.0

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget \
  && addgroup -S app && adduser -S app -G app
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    STORAGE_DIR=/data/storage \
    NODE_OPTIONS=--max-old-space-size=384

# `output: standalone` já traz só as dependências que o servidor usa.
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public

# Schema e migrations + o CLI isolado, para o `migrate deploy` do entrypoint.
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=migrator --chown=app:app /migrator/node_modules ./migrator/node_modules
COPY --chown=app:app docker/prisma.config.mjs ./migrator/prisma.config.mjs

COPY --chown=app:app docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh \
  && mkdir -p /data/storage/products /data/storage/materials /data/storage/proofs \
  && chown -R app:app /data

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["./entrypoint.sh"]
