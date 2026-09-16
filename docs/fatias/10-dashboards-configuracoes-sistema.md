# Fatia 10 · Dashboards, configurações e página Sistema

## Objetivo

Visão geral do admin com KPIs e funil, dashboard do afiliado finalizado, página de configurações (regras + termos),
página Sistema (webhooks, jobs, e-mails, auditoria), busca global ⌘K e sino de pendências completo.

## Pré-requisito

Fatia 09 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 9 Setting; seção 5 saldos)
- `docs/spec/05-design-system-ux.md` (Layout admin; Padrões 1, 9, 11, 12, 14; telas Admin visão geral, `/configuracoes`, `/sistema`; Afiliado início)
- `docs/spec/04-seguranca.md` (Antifraude — alertas; Operação)
- `docs/spec/02-arquitetura.md` (Cache; Jobs)

## Escopo

**Dentro:** `features/dashboard/queries.ts` (agregações com `groupBy`, cache 60 s), gráficos Recharts (lazy), funil cliques→pedidos→pagos, ranking de afiliados, alertas antifraude (cliques/dia > 500, razão vendas/cliques anômala, `suspicious`), `/admin/configuracoes` (todos os campos de `Setting` com validação de limites, termos em markdown com preview e **nova versão** obrigatória ao alterar texto; banner de re-aceite para afiliados), `/admin/sistema` (WebhookEvents com reprocessar, JobRuns, EmailLogs com reenviar, AuditLog com filtros), ⌘K (afiliados, produtos, pedidos por código/e-mail), sino consolidado, índices de banco revisados com `EXPLAIN` nas queries pesadas.
**Fora:** BI externo.

## Tarefas

1. Admin `/admin`: KPIs do mês (vendas, receita, comissões geradas, a pagar), comparação com mês anterior, gráfico receita×comissões 90 d, funil, top 5 afiliados, top 5 produtos, pendências (afiliados a aprovar, lotes a pagar, webhooks falhos, jobs com erro), alertas antifraude com link para o afiliado.
2. Afiliado `/painel`: revisar KPIs/gráfico existentes, adicionar "Como ganhar mais" (dicas + link para materiais) e banner de re-aceite de termos quando `termsVersion` do afiliado ≠ atual (não bloqueante; aceitar grava nova versão/IP/data).
3. `/admin/configuracoes`: form com limites do `01`; alterar texto dos termos exige informar nova versão (`v2`, `v3`…); audit before/after; `revalidateTag("settings")`.
4. `/admin/sistema`: 4 abas com tabelas filtráveis; "Reprocessar webhook" re-executa handler por `eventId` (idempotente); "Reenviar e-mail" reseta tentativas; JobRuns com duração; AuditLog com busca por entidade/ator/ação e diff before/after legível.
5. ⌘K com `cmdk` (shadcn Command): busca server action com debounce, resultados agrupados.
6. Revisão de índices: rodar `EXPLAIN ANALYZE` nas 10 queries mais pesadas com dados sintéticos (script `scripts/seed-volume.ts`: 200 afiliados, 20k cliques, 3k pedidos) e criar índices faltantes por migration.
7. `/api/cron/*` todos registram `JobRun`; página Sistema mostra "última execução há X" e alerta se > 2× o intervalo esperado.

## Critérios de aceite

- Visão geral do admin carrega em < 1 s p95 com o seed de volume (medir e anotar).
- Alterar `holdDays` para 10 reflete na próxima comissão criada, não nas existentes; valor 91 é rejeitado.
- Alterar termos sem mudar versão é bloqueado; afiliados veem banner e, ao aceitar, `termsVersion` atualiza com audit.
- Reprocessar webhook `paid` já processado não duplica comissão/grant.
- ⌘K encontra pedido por `IF-XXXXXX` e por e-mail parcial; afiliado por `@handle`.
- Página Sistema mostra jobs atrasados em destaque.

## Testes

- Unit: agregações do dashboard com fixtures (funil, comparação mês), regras de `Setting`, versão de termos.
- Integration: `updateSettings` (limites, audit), reprocessar webhook idempotente, busca ⌘K por role.
- E2E: admin altera termos → afiliado vê banner → aceita → banner some.

## Handoff

Registrar índices criados e tempos medidos; listar qualquer query que ainda passe de 300 ms.
