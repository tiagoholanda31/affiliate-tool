# Fatia 07 · Pagamentos de comissão (lotes), extrato e exportações

## Objetivo

Admin gera lotes de pagamento por afiliado a partir das comissões disponíveis, paga via Pix manualmente e registra
comprovante; afiliado recebe extrato. Exportações CSV/XLSX em Vendas, Comissões e Pagamentos.

## Pré-requisito

Fatia 06 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seções 5 saldos, 6 Payout, 9 payoutDay)
- `docs/spec/03-modelo-de-dados.md` (`Payout`, `Commission.payoutId`, `CommissionAdjustment.payoutId`)
- `docs/spec/05-design-system-ux.md` (Padrões 3, 9, 11; telas Admin `/pagamentos`, Afiliado `/painel/comissoes`)
- `docs/spec/07-emails-notificacoes-integracoes.md` (`payout-paid`, emissor n8n `payout.paid`)
- `docs/spec/04-seguranca.md` (Dados sensíveis — revelar Pix; uploads)

## Escopo

**Dentro:** `features/payouts/service.ts` (`buildPayoutDraft`, `markPayoutPaid`, `discardDraft`, `createManualAdjustment`), telas admin, upload de comprovante (imagem/PDF ≤ 5 MB, storage `proofs/`, servido por rota admin), extrato do afiliado com lotes e comprovante (download pelo afiliado permitido), exportações, aba Pagamentos no detalhe do afiliado, e-mail e evento n8n.
**Fora:** integração bancária/split automático.

## Tarefas

1. Model + migration.
2. `buildPayoutDraft(affiliateId, { commissionIds?, referenceMonth }, tx)`: seleciona `AVAILABLE` (todas ou selecionadas) + ajustes abertos, valida `total > 0`, cria `DRAFT` vinculando; comissões passam a "reservadas" (continuam `AVAILABLE` mas com `payoutId` — excluir das próximas seleções e do saldo disponível).
3. `markPayoutPaid(payoutId, { paidAt, proofReference?, proofPath?, notes }, tx)`: exige ≥ 1 comprovação, `paidAt ≤ hoje`; comissões → `PAID/paidAt`; audit; e-mail pós-commit; n8n. `discardDraft` limpa vínculos. `createManualAdjustment(affiliateId, amountCents, reason)` (±).
4. `/admin/pagamentos`: cards "A pagar este mês" (soma disponível total, nº afiliados), lista de afiliados com disponível > 0 (nome, código, disponível, ajustes, último pagamento, botão "Gerar lote"); abas Rascunhos / Pagos (tabela com filtros e exportação).
5. `/admin/pagamentos/[id]`: resumo (afiliado, total, n comissões, ajustes), **Pix mascarada + Revelar** (audit) + botões copiar chave/valor; tabela de comissões incluídas (remover item em DRAFT); formulário "Marcar como pago" (data, referência E2E/ID, comprovante, observação) com resumo do que acontecerá; botão "Descartar rascunho".
6. Aba Pagamentos no detalhe do afiliado; ação "Criar ajuste" com motivo.
7. `/painel/comissoes`: saldos (pendente, disponível, pago total), próximo pagamento previsto, lista de lotes (mês ref., data, total, comprovante) com detalhe expandindo comissões, lista de comissões com filtro.
8. Exportações: `lib/export.ts` (CSV UTF-8 com BOM; XLSX via `exceljs` ou `xlsx`) para Vendas, Comissões, Pagamentos — respeitando filtro atual, dados mascarados iguais à tela, nome `affiliate-<recurso>-<yyyymmdd>.csv`. Limite 10k linhas (stream).
9. Sino admin: adicionar "comissões disponíveis para pagar" quando `hoje ≥ payoutDay`.

## Critérios de aceite

- Gerar lote reserva as comissões: saldo disponível do afiliado cai imediatamente; descartar devolve.
- Marcar pago sem comprovante nem referência é impossível; com sucesso, comissões `PAID`, afiliado recebe `payout-paid` com extrato, comprovante acessível ao afiliado dono e ao admin, a ninguém mais.
- Ajuste negativo aberto reduz o total do próximo lote e aparece discriminado no extrato.
- Lote pago é imutável na UI e na action.
- CSV abre no Excel pt-BR com acentos e decimais corretos; XLSX com tipos numéricos (não texto).

## Testes

- Unit: `buildPayoutDraft` (seleção, ajustes, total zero), `markPayoutPaid` (validações), imutabilidade.
- Integration: fluxo draft→paid com audit/e-mail; posse do comprovante; exportação com filtro.
- E2E: admin gera lote → revela Pix (audit) → marca pago → afiliado vê lote e comprovante.

## Handoff

Registrar formato dos arquivos exportados e a decisão CSV/XLSX lib.
