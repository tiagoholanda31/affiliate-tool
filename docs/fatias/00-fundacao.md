# Fatia 00 · Fundação

## Objetivo

Repositório pronto para as próximas fatias: app Next.js 15 rodando, banco migrado, design tokens aplicados,
shell de layout para as três áreas, tooling e checks verdes, Docker buildando. Nenhuma regra de negócio.

## Pré-requisito

Nenhum. Node 22, pnpm 10 e Docker instalados na máquina.

## Contexto necessário

- `CLAUDE.md`
- `docs/spec/02-arquitetura.md`
- `docs/spec/05-design-system-ux.md` (seções Tokens, Tipografia, Layout, Componentes)
- `docs/spec/08-deploy-easypanel.md` (seção Dockerfile)
- `docs/spec/03-modelo-de-dados.md` (apenas `Setting`, `AuditLog`, `JobRun`, `EmailLog`)

## Escopo

**Dentro:** scaffold, configs, tokens, fontes, shell visual, componentes base, `lib/` utilitários sem dependência de domínio, migration inicial mínima, seed vazio, Docker, health.
**Fora:** autenticação (fatia 01), qualquer tabela de domínio, e-mails reais, Pagar.me.

## Tarefas

1. `pnpm create next-app@latest` (TS, App Router, Tailwind 4, `src/`, ESLint, sem Turbopack em prod build se instável). Estrutura de pastas do `02-arquitetura`.
2. Tooling: `tsconfig` strict + `noUncheckedIndexedAccess`; ESLint flat com `@typescript-eslint` strict, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`; Prettier + `prettier-plugin-tailwindcss`; scripts do `CLAUDE.md` (`check`, `db:*`, `test*`); `.editorconfig`; `.nvmrc`; `.gitignore` (inclui `.env*`, `storage/`, `!.env.example`).
3. Prisma 6 + Postgres via `docker-compose.yml` (`db` porta 5432, `db_test` porta 5433). Schema com `Setting`, `AuditLog`, `JobRun`, `EmailLog` (User vem na 01). Migration `init`. `prisma/seed.ts` cria `Setting` padrão.
4. `src/lib/env.ts` com todas as variáveis do `02` (as ainda não usadas como `optional()`); `.env.example` completo e comentado.
5. `src/lib/`: `db.ts`, `logger.ts`, `money.ts`, `dates.ts`, `crypto.ts`, `errors.ts`, `http.ts`, `rate-limit.ts`, `storage.ts`, `i18n/pt-BR.ts` (labels de enums futuros podem ficar vazios). Todos com testes unitários.
6. Design system: `globals.css` com `@theme`; `next/font` Poppins + Playfair; shadcn init com mapeamento de tokens; instalar `button card input label badge dialog dropdown-menu sheet table tabs toast(sonner) skeleton tooltip separator avatar select textarea checkbox switch`.
7. Componentes compartilhados: `AppShell` (variante `affiliate` com bottom-nav mobile + sidebar; `admin` com sidebar 260 px; `public` header/footer), `PageHeader`, `KpiCard`, `StatusBadge` (genérico por `tone`), `MoneyText`, `DateText`, `EmptyState`, `ErrorState`, `ConfirmDialog` (modo type-to-confirm), `ReasonDialog`, `CopyButton`, `MaskedInput`. Página `/dev/ui` (só em dev) exibindo todos — serve de "storybook" leve.
8. Rotas placeholder por route group com `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`; `/` vitrine vazia com marca; `/api/health`.
9. `next.config.ts`: `output: standalone`, headers de segurança (CSP em modo report-only nesta fatia), `poweredByHeader: false`.
10. Vitest (ambiente `node` para lib, `jsdom` para componentes) + Testing Library; Playwright configurado com 1 teste smoke (`/` renderiza, `/api/health` 200).
11. Dockerfile + `docker/entrypoint.sh` + `.dockerignore` conforme `08`; `docker build` deve funcionar localmente.
12. `README.md` curto: como rodar, comandos, link para `docs/`.

## Critérios de aceite

- `pnpm dev` abre `/` com header navy, logo placeholder dourado (texto "Affiliate Tool" em Playfair até o SVG chegar), fundo `mist-100`.
- `/dev/ui` mostra todos os componentes base em estados normal/hover/focus/disabled; contraste AA nos pares definidos (verificar com ferramenta e anotar no PROGRESS).
- `pnpm check` verde; `pnpm test:e2e` smoke verde.
- `docker build -t affiliate-tool .` conclui e `docker run` responde `/api/health` com `{ ok: true, db: true }`.
- Nenhum `process.env` fora de `env.ts` (grep no handoff).

## Testes

- Unit: `money` (formatação/half-even), `dates` (timezone SP, `nextPayoutDate`), `crypto` (encrypt/decrypt roundtrip, mask por tipo Pix, hashToken), `rate-limit`, `errors`.
- Component: `StatusBadge`, `ConfirmDialog` (type-to-confirm bloqueia botão até texto correto), `MaskedInput` (phone/cpf/cnpj/money).
- E2E smoke.

## Handoff

Registrar versões exatas instaladas; qualquer ajuste de config do shadcn/Tailwind 4 que tenha exigido workaround; confirmar que `.env.example` está completo.
