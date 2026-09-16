# PROGRESS — estado vivo do projeto

> Atualizado ao fim de **toda** sessão (`/handoff`). Este é o primeiro arquivo que uma nova sessão lê.

## Fatias

| #   | Fatia                                                           | Status | Sessão/Data | Obs                         |
| --- | --------------------------------------------------------------- | ------ | ----------- | --------------------------- |
| 00  | Fundação: scaffold, tooling, Docker, design tokens, shell       | DONE   | 2026-09-05  | versões atualizadas (D-013) |
| 01  | Auth + cadastro de afiliado + telas de status                   | DONE   | 2026-09-05  | ver D-017, D-018, D-019     |
| 02  | Admin: gestão de afiliados (aprovar/reprovar/suspender/remover) | DONE   | 2026-09-05  | ver D-020                   |
| 03  | Admin: produtos, serviços e arquivos digitais                   | DONE   | 2026-09-05  | ver D-021                   |
| 04  | Links de afiliado e rastreamento de cliques                     | DONE   | 2026-09-05  | ver D-022                   |
| 05  | Checkout Pagar.me (Pix + cartão) e webhooks                     | DONE   | 2026-09-05  | ver D-023                   |
| 06  | Comissões, carência, estornos e vendas manuais                  | DONE   | 2026-09-10  | ver D-024                   |
| 07  | Pagamentos de comissão (lotes), extrato e exportações           | DONE   | 2026-09-10  | ver D-025                   |
| 08  | Entrega digital (grants, download, reenvio)                     | DONE   | 2026-09-10  | ver D-026                   |
| 09  | Materiais de divulgação                                         | DONE   | 2026-09-10  | ver D-027                   |
| 10  | Dashboards, configurações e página Sistema                      | DONE   | 2026-09-10  | ver D-028                   |
| 11  | Hardening, a11y, e2e completo, deploy e go-live                 | PARTIAL | 2026-09-11  | código ok; go-live bloqueado (pendências externas) |

Legenda: `TODO` · `IN_PROGRESS` · `PARTIAL` (com motivo) · `BLOCKED` (com motivo) · `DONE`

## Estado atual

A fatia 11 está **PARTIAL**: o código de hardening, a11y, e2e e operação está no
repo; o go-live (DNS, Pagar.me, Resend, smoke R$ 1, backup+restore,
uptime) espera as pendências externas abaixo.

**Segurança:** CSP enforce com nonce por request (`src/proxy.ts` + `src/lib/csp.ts`);
produção sem `unsafe-eval` em scripts; `style-src 'unsafe-inline'` (D-029).
HSTS preload-ready; Permissions-Policy ampliada; `serverActions.allowedOrigins`.
`/dev/*` → 404 em produção (proxy + `notFound()`). Health `{ ok, db, version }`.
Testes de abuso em `tests/integration/abuse.test.ts`. `pnpm audit --prod` (2026-09-10):
2 high e 2 moderate, todos transitivos — `mysql2` e `deepmerge-ts` via Prisma CLI
(o app usa só Postgres; mysql2 não é chamado em runtime), `uuid` via `exceljs`
(exportação admin, não input de usuário). Sem upgrade seguro nesta fatia; reavaliar
ao subir Prisma/exceljs.

**A11y:** `@axe-core/playwright` nas rotas públicas e autenticadas; labels nos
filtros; `aria-live` no Pix e toasts; teclado no checkout.

**Perf:** `@next/bundle-analyzer` (`pnpm analyze`); `loading.tsx` por segmento;
Recharts já lazy (admin + painel), fora das rotas públicas. Lighthouse mobile
das URLs públicas: **pendente no go-live** (não há domínio de produção ainda).

**E2E:** `tests/e2e/fluxo-completo.spec.ts` (cadastro→lote→extrato, cartão
recusado, estorno, download com limite) + `a11y.spec.ts`. Desktop **25/25**
verde em 2026-09-11 (`pnpm test:e2e -- --project=desktop`). Playwright com
1 worker (Turbopack no Windows perde `build-manifest` em compiles paralelos).
Tokenização fake quando `PAGARME_DRIVER=fake`, mesmo com chave pública no `.env`.

**Scripts:** `pnpm admin:create`, `pnpm keys:rotate`; `seed-volume` recusado em
produção. Runbook em `docs/RUNBOOK.md`.

**Não feito nesta sessão (bloqueado fora do código):** deploy EasyPanel, DNS,
webhook de produção, Pix R$ 1,00 + estorno, backup diário + restore testado,
monitor de uptime, n8n em produção.

## Arquivos-chave da última fatia

- `src/proxy.ts` · `src/lib/csp.ts` · `next.config.ts`
- `src/app/api/health/route.ts`
- `src/lib/crypto.ts` (`encryptWithKey` / `decryptWithKey`)
- `scripts/create-admin.ts` · `scripts/rotate-encryption-key.ts` · `scripts/analyze.mjs`
- `tests/integration/abuse.test.ts`
- `tests/e2e/{fluxo-completo,a11y,smoke}.spec.ts`
- `src/app/**/loading.tsx` · `src/components/feedback/page-skeleton.tsx`
- `docs/RUNBOOK.md`
- `src/features/tracking/affiliate-url.ts` · `src/lib/upload-limits.ts`
- `tests/helpers/e2e-auth.ts`

## Limites de Setting (UI)

| chave | limites |
| ----- | ------- |
| holdDays | 0–90 (só comissões futuras) |
| payoutDay | 1–28 |
| attributionDays | 1–90 |
| pixExpirationMinutes | 10–120 |
| downloadGrantDays | 1–30 |
| downloadMaxCount | 1–20 |
| termsVersion | `vN`; obrigatória nova se markdown mudar |

## Job intervals (alerta se > 2×)

| job | intervalo |
| --- | --------- |
| release-commissions | 24 h |
| reconcile-orders | 15 min |
| anonymize-removed | 24 h |
| retry-emails | 10 min |
| purge-clicks | 24 h |

## Decisões desta fatia

Registradas em `docs/DECISOES.md`:

- **D-029** — CSP com nonce; `style-src` permanece `unsafe-inline`.
- **D-030** — scripts `create-admin` / `rotate-encryption-key` na workstation, não na imagem slim.

Client Components não podem importar módulos que puxam `db`, `sharp` ou `node:*`
(Turbopack no Windows entrega HTML vazio / ENOENT no manifest). URLs de afiliado
ficam em `affiliate-url.ts`; limites de upload em `upload-limits.ts`.

## Dívidas técnicas

| item                                                                       | origem                       | resolver em                                 |
| -------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| Cobertura mínima do Vitest em 80%, não nos 90% da spec                     | fatia 00, `vitest.config.ts` | fase 2                                      |
| `docs/spec/02` e `03` ainda descrevem Next 15 / Prisma 6 / `middleware.ts` | D-013                        | fase 2 — alinhar a spec                     |
| Dois arquivos de config do Prisma (raiz em TS, `docker/` em JS)            | D-016                        | mantê-los em sincronia ao mexer em caminhos |
| Logo é placeholder tipográfico em `src/components/layout/brand.tsx`        | pendência externa            | quando a designer entregar o SVG            |
| Crop 4:3 opcional no client (hoje só cover server-side)                    | fatia 03                     | opcional; sharp já força 4:3                |
| Aba Pagamentos no detalhe do afiliado não sincroniza `?tab=` na URL        | fatia 07                     | opcional; Tabs usam defaultValue            |
| Token em metadata é plaintext (só servidor + HTML do comprador autenticado)| D-026                        | aceitável; não logar nem exportar           |
| Medir p95 `/admin` com `scripts/seed-volume.ts` e anotar                   | fatia 10                     | go-live / manual                            |
| Lighthouse mobile ≥ 90 perf / ≥ 95 a11y em `/`, `/p/[slug]`, `/pedido`     | fatia 11                     | go-live (precisa de URL pública)            |
| Deploy EasyPanel + DNS + webhook prod + Pix R$ 1 + backup/restore + uptime | fatia 11                     | quando pendências externas fecharem         |
| 2FA TOTP no admin                                                          | spec 04                      | fase 2                                      |
| Split automático Pagar.me                                                  | D-002                        | fase 2                                      |
| CAPTCHA se houver abuso no cadastro/checkout                               | spec 04                      | fase 2                                      |
| Storage S3/R2 em vez de volume local                                       | D-006                        | fase 2                                      |
| `style-src` sem `unsafe-inline` (nonce em CSS)                             | D-029                        | fase 2 se o Next permitir                   |
| Playwright `workers: 1` no Windows (Turbopack ENOENT)                      | fatia 11                     | reavaliar workers>1 quando o Turbo estabilizar |
| Cache `unstable_cache` de materiais (e2e recarrega a galeria)              | fatia 09                     | conferir `revalidateTag('materials')` no Next 16 |

## Dependências adicionadas

- `exceljs@4.4.0` — XLSX tipado (números, não texto) nas exportações admin (D-025).
- `cmdk@1.1.1` — Command palette ⌘K (fatia 10).
- `@axe-core/playwright` — axe nas rotas e2e (fatia 11).
- `@next/bundle-analyzer` — `pnpm analyze` (fatia 11).

## Limites de upload

| tipo         | mimes aceitos                       | tamanho máx. | destino                        |
| ------------ | ----------------------------------- | ------------ | ------------------------------ |
| Capa         | JPEG, PNG, WebP → saída sempre WebP | 8 MB origem  | `STORAGE_DIR/products/covers/` |
| Digital      | PDF, EPUB (magic bytes)             | 50 MB        | `STORAGE_DIR/products/`        |
| Material     | IMAGE JPEG/PNG/WebP + PDF           | 10 / 20 MB   | `STORAGE_DIR/materials/` (+ thumb) |
| Comprovante  | PDF, JPEG, PNG, WebP                | 5 MB         | `STORAGE_DIR/proofs/`          |

Em dev, `STORAGE_DIR` padrão é `./storage` (ver `.env.example`).

## Formato das exportações (fatia 07)

- Nome: `affiliate-<vendas|comissoes|pagamentos>-<yyyymmdd>.{csv|xlsx}`
- CSV: UTF-8 com BOM, separador `;`, decimais pt-BR (`1.234,56`)
- XLSX: `exceljs`, colunas monetárias numéricas com `numFmt #.##0,00`
- Limite: 10_000 linhas; rota `/api/admin/export/[resource]`

## Próxima fatia

Nenhuma. Código da 11 entregue; **go-live** é retomar esta fatia quando as
pendências externas fecharem (seguir `docs/RUNBOOK.md` + `docs/spec/08-deploy-easypanel.md`).

Checklist de go-live (operador):

- [ ] DNS do app A → VPS; TLS no Traefik
- [ ] Resend + SPF/DKIM/DMARC no subdomínio de e-mail
- [ ] Pagar.me produção + webhook Basic Auth
- [ ] `pnpm admin:create` e troca da senha inicial
- [ ] Produto R$ 1,00 → Pix pago → estorno; remover o produto
- [ ] Backup diário + restore testado (contagem de `Order`)
- [ ] Monitor `/api/health` a cada 5 min
- [ ] Termos oficiais em `/admin/configuracoes`
- [ ] Logo da marca em `brand.tsx`

## Pendências externas (fora do código)

- [ ] Conta Pagar.me de teste (`sk_test`/`pk_test`)
- [ ] Conta Resend + verificação do subdomínio de e-mail
- [ ] DNS do app → IP da VPS
- [ ] Texto dos Termos do Programa e Política de Privacidade
- [ ] Logo em SVG/PNG alta resolução
- [ ] Lista inicial de produtos/serviços com preços e comissões
- [ ] Conta Pagar.me de produção
