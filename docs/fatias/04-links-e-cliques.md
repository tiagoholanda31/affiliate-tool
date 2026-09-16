# Fatia 04 · Links de afiliado e rastreamento de cliques

## Objetivo

Afiliado aprovado copia/compartilha seus links (geral e por produto) com QR; cada acesso registra clique
(total/único, anti-bot), seta cookie de atribuição assinado e redireciona. Painel mostra cliques.

## Pré-requisito

Fatia 03 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 3 Link e clique; seção 9 `attributionDays`)
- `docs/spec/03-modelo-de-dados.md` (`Click`)
- `docs/spec/04-seguranca.md` (Web — cookie assinado; Antifraude)
- `docs/spec/05-design-system-ux.md` (Padrão 4; telas Afiliado `/painel/links`, início parcial)

## Escopo

**Dentro:** rota `/r/[code]/[[...slug]]`, `features/tracking/service.ts`, cookie `if_ref` (JWT HS256 com `REF_COOKIE_SECRET`), página `/painel/links` com `ShareLinkCard` (copiar, QR, Web Share, WhatsApp), KPIs de cliques no `/painel` (hoje/7d/30d, únicos), gráfico simples de cliques por dia (Recharts, client, lazy), retenção de cliques (job apaga > 13 meses).
**Fora:** conversão/vendas (05–06).

## Tarefas

1. `Click` model + migration; índices do `03`.
2. `POST/GET /r/[code]/[[...slug]]` (Route Handler, Node runtime): resolve afiliado por `code` (cache 60 s), aplica regras de status, `ipHash = sha256(ip + saltDoDia)` (salt derivado de `REF_COOKIE_SECRET` + data), UA hash, bot list, `isUnique`, grava clique (não bloqueante: `void` com catch/log), seta cookie, 302. Slug inválido → vitrine com toast "Produto não encontrado".
3. `lib/attribution.ts`: `signRef({ a, c })`, `readRef(cookies)` (verifica assinatura/exp; retorna `null` se inválido) — usado na fatia 05.
4. `/painel/links`: card do link geral + lista de produtos ativos com link individual; `ShareLinkCard` (input readonly + copiar + QR em modal para download PNG + botão WhatsApp `wa.me/?text=` + Web Share). Texto sugerido curto por produto (placeholder para materiais TEXT da fatia 09).
5. `/painel` início: `KpiCard` cliques hoje/7d/30d e únicos 30d; gráfico 30 dias; lista "produtos mais clicados". Cache 60 s por afiliado.
6. Admin: coluna "cliques 30d" na lista de afiliados e mini-KPI no detalhe (aba Dados).
7. `/api/cron/purge-clicks` (retenção 13 meses).

## Critérios de aceite

- Acesso a `/r/<code>/<slug>` redireciona para `/p/<slug>` em < 100 ms p95 local, com cookie `HttpOnly Secure SameSite=Lax` e expiração = `attributionDays`.
- Segundo acesso do mesmo IP em 24 h conta total mas não único; UA de bot (`curl`, `Googlebot`…) grava `isBot` e não aparece nos KPIs.
- Código de afiliado `SUSPENDED` redireciona sem cookie e sem clique; código inexistente redireciona à vitrine.
- Cookie adulterado é ignorado (`readRef` → null) sem erro visível.
- Copiar link funciona em iOS Safari (fallback `execCommand`), QR baixa como PNG nomeado `link-<code>-<slug>.png`.

## Testes

- Unit: `signRef/readRef` (assinatura inválida, expirado), `isUnique`, bot detection, salt diário.
- Integration: rota `/r` para cada status de afiliado; clique gravado; sem duplicar em requisições concorrentes (tolerância: total conta, único não).
- E2E: afiliado copia link → visita anônima → cookie presente → KPI de cliques atualiza.

## Handoff

Registrar formato final do cookie e lista de bots; medir tamanho do bundle da página de links (Recharts fora da rota pública).
