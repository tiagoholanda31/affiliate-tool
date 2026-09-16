# Fatia 06 · Comissões, carência, estornos e vendas manuais

## Objetivo

Toda venda paga com afiliado gera comissão com snapshot; carência configurável libera para pagamento; estornos
revertem (ou geram ajuste se já pago). Admin lança vendas manuais. Afiliado vê vendas e saldos.

## Pré-requisito

Fatia 05 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seções 4 origem MANUAL, 5 Comissão, 9 holdDays, 10 e-mails de venda)
- `docs/spec/03-modelo-de-dados.md` (`Commission`, `CommissionAdjustment`, `Order` campos manuais)
- `docs/spec/05-design-system-ux.md` (Padrões 3, 9, 10, 11; telas `/painel/vendas`, `/painel/comissoes` parcial, Admin `/vendas` lançar manual, `/comissoes`)
- `docs/spec/07-emails-notificacoes-integracoes.md` (`sale-affiliate`, `sale-admin`, `order-refunded-*`, `commissions-available-digest`)

## Escopo

**Dentro:** `features/commissions/service.ts` (`calculateCommission`, `createCommissionForOrder`, `reverseCommission`, `releaseDueCommissions`, `getBalances`), ligação em `onOrderPaid/onOrderReversed`, venda manual (form admin), `/api/cron/release-commissions`, telas afiliado (vendas, saldos no início e em `/comissoes` sem lotes ainda), admin `/admin/comissoes` (lista + filtros), abas Vendas/Comissões no detalhe do afiliado, KPIs de conversão, e-mails.
**Fora:** lotes de pagamento e extrato de lotes (07), download (08).

## Tarefas

1. Models + migration. Snapshot de taxa no `Commission`.
2. `calculateCommission` (half-even, FIXED ≤ base, nunca negativa). `createCommissionForOrder(order, tx)` idempotente (unique `orderId`). `availableAt = paidAt + holdDays` lido do `Setting` no momento.
3. `reverseCommission(order, reason, tx)`: `PENDING/AVAILABLE → REVERSED`; `PAID → CommissionAdjustment` negativo (`orderId` referenciado).
4. `getBalances(affiliateId, tx)` → `{ pendingCents, availableCents, paidCents, openAdjustmentsCents, nextPayoutDate }` via `groupBy`. Usado por painel e admin.
5. Venda manual: `/admin/vendas/nova` — produto (select com preço sugerido), valor (editável, ≥ R$ 1), data do pagamento (≤ hoje), comprador (nome, e-mail, celular opcional), afiliado (busca por nome/código/e-mail, opcional), observações. Cria `Order MANUAL PAID` e dispara `onOrderPaid` (comissão + e-mails; sem entrega digital automática — admin decide, checkbox "enviar link de download" só na 08). Resumo antes de confirmar: "Comissão de R$ X para @fulano, liberada em dd/mm".
6. Admin `/admin/comissoes`: tabela (afiliado, pedido, base, taxa, valor, status, libera em/pago em), filtros (status, afiliado, período), total do filtro no rodapé. Detalhe do afiliado: abas Vendas e Comissões preenchidas.
7. `/painel/vendas`: lista com produto, data, valor, comissão, status (tooltip "libera em"); filtro por período/status. `/painel` início: KPIs vendas 30d, conversão (vendas/cliques únicos), pendente, disponível (destaque dourado), próximo pagamento previsto. `/painel/comissoes` v1: saldos + lista de comissões (lotes na 07).
8. `/api/cron/release-commissions` (release + digest por afiliado). Alterar `holdDays` em `Setting` (UI na 10; por ora via seed/Studio) não afeta comissões existentes.
9. E-mails: `sale-affiliate`, `sale-admin`, `order-refunded-*` (comprador/afiliado/admin), `commissions-available-digest`.
10. Emissor n8n `emit("order.paid" | "order.refunded" | "order.manual_created" | "commission.available")`.

## Critérios de aceite

- Venda de R$ 199,90 com 15% → comissão R$ 29,99 (2999 centavos, arredondamento correto); venda R$ 10,00 com FIXED R$ 15,00 → R$ 10,00.
- Reprocessar `order.paid` não cria segunda comissão.
- Estorno de comissão `PAID` cria ajuste negativo visível no saldo do afiliado e no admin.
- Venda manual sem afiliado não gera comissão; com afiliado gera e envia e-mail; data futura é rejeitada.
- Comissão criada com `holdDays=7` fica `PENDING` até `paidAt+7d` e o cron a libera; mudar `holdDays` depois não muda a `availableAt` dela.
- Afiliado só vê suas próprias vendas (teste de posse com dois afiliados).

## Testes

- Unit: `calculateCommission` (tabela de casos incl. arredondamento), `reverseCommission` por status, `getBalances`, `nextPayoutDate`.
- Integration: `onOrderPaid` idempotente; venda manual (validações, audit); cron release; posse de dados.
- E2E: checkout fake pago com cookie de afiliado → afiliado vê venda e saldo pendente.

## Handoff

Confirmar contrato de `getBalances` (usado na 07 e 10) e registrar quaisquer índices adicionados.
