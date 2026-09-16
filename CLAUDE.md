# Affiliate Tool — CLAUDE.md

Plataforma de afiliados do Affiliate Tool (affiliates.example.com).
Afiliados divulgam serviços e livros digitais com links rastreáveis; compradores pagam via
checkout Pagar.me (Pix/cartão); comissões são calculadas pelo sistema e pagas manualmente pelo admin.

## Como este projeto é desenvolvido

O trabalho é dividido em **fatias verticais** numeradas em `docs/fatias/`. Uma sessão do Claude Code
executa **uma fatia inteira** e termina com handoff. Nunca inicie a próxima fatia na mesma sessão.

Fluxo obrigatório de toda sessão:

1. Leia `docs/PROGRESS.md` (estado atual, decisões, dívidas).
2. Leia a fatia pedida em `docs/fatias/NN-*.md` e **somente** os documentos listados em "Contexto necessário".
3. Confirme que a fatia anterior está `DONE` no PROGRESS. Se não estiver, pare e avise.
4. Planeje em poucas linhas, implemente, teste, rode os checks, atualize `docs/PROGRESS.md`, commite.
5. Encerre com `/handoff`.

Use `/fatia N` para começar e `/handoff` para encerrar. Não leia a spec inteira "para contexto":
cada fatia diz exatamente o que carregar. Se precisar de algo fora disso, procure com grep antes de ler arquivos inteiros.

## Stack (não trocar sem registrar em docs/DECISOES.md)

- Next.js 15 (App Router, React 19, Server Components por padrão, Server Actions) · TypeScript strict
- PostgreSQL 16 · Prisma 6 (migrations versionadas, nunca `db push`)
- Better Auth (e-mail/senha, verificação de e-mail, sessões em banco) · roles: `ADMIN` | `AFFILIATE`
- Tailwind CSS 4 · shadcn/ui · lucide-react · Recharts · TanStack Table · React Hook Form + Zod
- Pagar.me Core API v5 (Pix + cartão via tokenização no browser) · Resend (e-mail) · React Email
- Vitest + Testing Library (unit/integration) · Playwright (e2e dos fluxos críticos)
- pnpm · ESLint (flat) · Prettier · Docker multi-stage · EasyPanel na VPS

## Comandos

```
pnpm dev                 # http://localhost:3000
pnpm build && pnpm start
pnpm typecheck           # tsc --noEmit
pnpm lint                # eslint
pnpm test                # vitest run
pnpm test:e2e            # playwright (precisa do app rodando)
pnpm db:migrate          # prisma migrate dev
pnpm db:seed             # admin + settings + produtos de exemplo
pnpm db:studio
pnpm check               # typecheck + lint + test  ← deve passar antes de qualquer commit
docker compose up -d db  # postgres local
```

## Estrutura

```
src/app/                 rotas (route groups: (public) (auth) (affiliate) (admin) api/)
src/features/<dominio>/  actions.ts · queries.ts · schemas.ts · service.ts · components/
src/components/ui/       shadcn (não editar à mão além de tokens)
src/components/          componentes compartilhados (layout, data-display, feedback)
src/lib/                 auth · db · env · money · dates · crypto · mail · storage · rate-limit · logger
src/server/              integrações externas (pagarme/, n8n/) e jobs
prisma/                  schema.prisma · migrations/ · seed.ts
emails/                  templates React Email
tests/                   e2e/ · fixtures/ · helpers/
docs/                    spec/ · fatias/ · PROGRESS.md · DECISOES.md
```

Regra: código de domínio vive em `src/features/<dominio>/service.ts` (puro, testável).
Server Actions e Route Handlers são camadas finas: validam (Zod) → autorizam → chamam service → retornam.

## Regras de código (não negociáveis)

- **Dinheiro em centavos (Int)**. Percentuais em basis points (1500 = 15,00%). Nunca `Float` para valores.
- **Datas em UTC no banco**; exibição em `America/Sao_Paulo` via `src/lib/dates.ts`. Nunca `new Date()` solto na UI.
- **Toda entrada externa passa por Zod** (forms, search params, webhooks, env). Tipos derivam dos schemas.
- **Toda Server Action usa o wrapper `authedAction`/`adminAction`** de `src/lib/safe-action.ts` (auth + role + zod + audit).
- **Sem `any`**, sem `@ts-ignore`, sem `eslint-disable` sem justificativa em comentário.
- **Erros esperados** retornam `{ ok: false, error }` para a UI; erros inesperados vão para o logger com contexto e viram mensagem genérica.
- **Segredos só via `src/lib/env.ts`**. Nunca leia `process.env` fora dele. Nunca leia `.env` real (use `.env.example`).
- **Nunca exponha caminhos de arquivo, IDs internos do gateway, chave Pix completa ou CPF completo** no client.
- **Mutations invalidam cache** (`revalidatePath`/`revalidateTag`) e registram `AuditLog` quando são ações de admin ou mudam dinheiro/status.
- Componentes: Server Component por padrão; `"use client"` só na folha que precisa de interatividade.
- UI em **português do Brasil**, formatação `pt-BR` (moeda, datas, números). Textos em `src/lib/i18n/pt-BR.ts` quando reutilizados.
- Acessibilidade mínima: labels reais, foco visível, contraste AA, estado nunca só por cor.

## Definition of Done de uma fatia

- Todos os itens de "Tarefas" e "Critérios de aceite" da fatia atendidos
- `pnpm check` verde; e2e da fatia (quando exigido) verde
- Migrations criadas e nomeadas (`YYYYMMDDHHMM_descricao`), seed atualizado se necessário
- Sem TODO sem issue/dívida registrada em PROGRESS
- `docs/PROGRESS.md` atualizado (status, arquivos-chave, decisões, dívidas, próximos passos)
- Commits pequenos com Conventional Commits: `feat(afiliados): ...`, `fix(checkout): ...`, `chore(fatia-03): handoff`

## O que nunca fazer

- Não iniciar outra fatia, não "aproveitar" para refatorar fora do escopo
- Não rodar `prisma migrate reset`, `db push`, `git push --force`, `rm -rf` fora de `node_modules/.next`
- Não instalar dependências novas sem anotar em PROGRESS o motivo (uma linha basta)
- Não chamar a API real do Pagar.me em testes: use o cliente fake em `src/server/pagarme/fake.ts`
- Não criar arquivos de documentação além dos previstos (PROGRESS e DECISOES são os únicos vivos)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
