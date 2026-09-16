# Fatia 05 · Checkout Pagar.me (Pix + cartão) e webhooks

## Objetivo

Comprador paga um produto na `/p/[slug]` via Pix ou cartão; pedido é criado com atribuição pelo cookie; webhooks e
reconciliação levam o pedido a `PAID/FAILED/EXPIRED/REFUNDED/CHARGEDBACK`. Página `/pedido/[code]` acompanha o status.
Nesta fatia **não** há comissão nem entrega (hooks preparados para 06 e 08).

## Pré-requisito

Fatia 04 `DONE`. Chaves de teste Pagar.me em `.env` (ou `PAGARME_DRIVER=fake`).

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/06-pagamentos-pagarme.md` (inteiro)
- `docs/spec/01-dominio-e-regras.md` (seção 4 Pedido; seção 3 auto-atribuição)
- `docs/spec/03-modelo-de-dados.md` (`Order`, `WebhookEvent`, `JobRun`)
- `docs/spec/05-design-system-ux.md` (Padrões 6, 7, 8; telas `/p/[slug]`, `/pedido/[code]`)
- `docs/spec/07-emails-notificacoes-integracoes.md` (templates `order-created-pix`, `order-paid`, `order-failed`, `admin-alert`)
- Documentação Pagar.me v5 via WebFetch: orders, tokens, webhooks (confirmar nomes de campos)

## Escopo

**Dentro:** `server/pagarme/*` (real + fake), `features/checkout` (form, actions), `features/orders` (service com máquina de estados e `applyGatewayStatus`), webhook, status polling, reconciliação/expiração, e-mails do comprador, admin `/admin/vendas` (lista + detalhe com timeline e botão estornar), ponto de extensão `onOrderPaid(order)`/`onOrderReversed(order)` (no-op por enquanto).
**Fora:** comissão (06), venda manual (06), download (08).

## Tarefas

1. Models + migration. `publicCode` gerador; `accessToken` (32 bytes, hash no banco) devolvido só no redirect e no e-mail.
2. `server/pagarme/` conforme `06`. `fake.ts` com painel `/dev/pagarme` (dev) para forçar `paid/failed/refunded` em um pedido.
3. `features/checkout/components/CheckoutForm` (client): seções Dados (nome, e-mail, celular, CPF/CNPJ com máscara) → Pagamento (tabs Pix | Cartão, conforme produto). Cartão: `CardForm` com tokenização direta na Pagar.me, Luhn, bandeira, parcelas com valor/parcela. Honeypot + tempo mínimo + rate limit.
4. Action `createCheckoutOrder`: validação, recálculo de preço, atribuição via `readRef`, auto-compra, `Order PENDING`, chamada ao gateway, persistência, redirect. Erros de gateway traduzidos.
5. `/pedido/[code]?t=`: verifica token; estados: Pix aguardando (QR, copia-e-cola, contador, passo a passo, polling `GET /api/orders/[code]/status`), Analisando, Pago (recibo + `deliveryNote` para serviço; slot para download na 08), Falhou (CTA tentar de novo), Expirado (CTA gerar novo Pix → novo pedido), Estornado.
6. `POST /api/webhooks/pagarme` conforme `06` (Basic Auth, idempotência, re-consulta, transação com lock, efeitos pós-commit, `WebhookEvent`).
7. `orders/service.ts`: `transitionOrder`, `applyGatewayStatus`, `expirePendingPix`, `reconcile`. `/api/cron/reconcile-orders`.
8. Admin `/admin/vendas`: tabela (código, data, produto, comprador mascarado, afiliado, método, valor, status), filtros (status, período, produto, afiliado, origem), detalhe com timeline (criado → pago → …), dados do gateway resumidos, `WebhookEvent`s relacionados, botão "Estornar" (confirm) → `cancelCharge`.
9. E-mails do comprador (`order-created-pix`, `order-paid`, `order-failed`) e `admin-alert` para webhook falho.
10. CSP: liberar `connect-src https://api.pagar.me`; passar CSP de report-only para enforce nesta fatia.

## Critérios de aceite

- Pix: QR aparece em < 3 s após submit; ao forçar "pago" no fake (ou pagar no sandbox), a tela muda para "Pagamento confirmado" sem reload em ≤ 5 s; e-mail `order-paid` enviado uma vez.
- Cartão: número nunca chega ao servidor (verificar logs/rede); recusa mostra mensagem pt-BR e permite nova tentativa; aprovado vai direto a "confirmado".
- Preço adulterado no client não altera `amountCents` (teste de integração enviando payload manipulado).
- Webhook sem Basic Auth → 401; evento repetido 3× → um só efeito; pedido desconhecido → `FAILED` + alerta.
- Cookie de afiliado presente → `Order.affiliateId/clickId` preenchidos; e-mail do comprador igual ao do afiliado → sem afiliado + `selfPurchaseBlocked`.
- Pix não pago em 35 min → `EXPIRED` pelo cron; `PAID` nas últimas 48 h estornado no gateway → `REFUNDED` pela reconciliação.
- Detalhe do pedido no admin mostra timeline correta e permite estornar.

## Testes

- Unit: `mapGatewayStatus`, `mapCardDecline`, matriz `applyGatewayStatus`, `publicCode`, auto-compra.
- Integration: `createCheckoutOrder` (atribuição, preço server-side, produto inativo bloqueado); webhook (auth, duplicado, desconhecido, paid→PAID, refunded→REFUNDED, transição inválida ignorada); reconciliação.
- E2E (fake): Pix → pago → confirmado; cartão recusado → mensagem; cartão aprovado.

## Handoff

Registrar divergências encontradas entre esta spec e a doc atual Pagar.me (nomes de campos/eventos) e o que foi ajustado; listar `onOrderPaid/onOrderReversed` como pontos de extensão para 06/08.
