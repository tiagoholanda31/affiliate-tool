# 06 · Pagamentos — Pagar.me Core API v5

> Antes de implementar, o agente DEVE confirmar campos e eventos na documentação atual em `docs.pagar.me`
> (permitido no `WebFetch`). Este documento fixa a **arquitetura**; nomes exatos de campos seguem a doc.

## Contas e chaves

- Desenvolvimento: conta do desenvolvedor em **modo teste** (`sk_test_…` / `pk_test_…`).
- Produção: conta Pagar.me do operador. Troca = alterar `PAGARME_SECRET_KEY`, `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` e cadastrar o webhook no dashboard da nova conta com o mesmo `PAGARME_WEBHOOK_USER/PASSWORD`. Nada no código referencia ID de conta.
- Autenticação da API: Basic Auth com `secret_key:` (senha vazia), base64. Base URL `https://api.pagar.me/core/v5`.

## Cliente (`src/server/pagarme/`)

```
client.ts     fetch tipado (timeout 15 s, retry 2× em 5xx/429 com jitter, log mascarado), erros → PagarmeError{ code, message, raw }
types.ts      Zod schemas das respostas usadas (Order, Charge, LastTransaction Pix/Card)
orders.ts     createPixOrder(input) · createCardOrder(input) · getOrder(id) · cancelCharge(id)
map.ts        mapGatewayStatus(order) → OrderStatus interno · mapCardDecline(code) → mensagem pt-BR
fake.ts       implementação em memória com o mesmo contrato (PAGARME_DRIVER=fake) para testes/e2e; permite forçar "pago", "recusado", "estornado"
index.ts      getPagarme() escolhe driver por env
```

Contrato único `PagarmeGateway` (interface) para os dois drivers.

## Fluxo Pix

1. Client envia `{ productId, method: "pix", customer: { name, email, phone, document } }` → action `createCheckoutOrder`.
2. Servidor: valida, recalcula preço, resolve afiliado pelo cookie `if_ref` (JWT), bloqueia auto-compra, cria `Order PENDING` (transação), chama `createPixOrder` com `items[{ amount, description, quantity:1, code: productId }]`, `customer{ name, email, document, type: individual|company, phones }`, `payments[{ payment_method: "pix", pix: { expires_in: pixExpirationMinutes*60 } }]`, `metadata{ orderId, publicCode, affiliateId? }`, `code: publicCode`.
3. Persiste `gatewayOrderId`, `gatewayChargeId`, `pixQrCode` (copia-e-cola), `pixQrCodeUrl`, `pixExpiresAt` do `last_transaction`.
4. Redireciona para `/pedido/<publicCode>?t=<token>` com QR, contador e polling (`GET /api/orders/<code>/status?t=` → `{ status }`, rate-limited).
5. Webhook `order.paid` (ou `charge.paid`) → `handlePaid`.

## Fluxo cartão

1. Browser tokeniza: `POST https://api.pagar.me/core/v5/tokens?appId=<pk>` com `{ type: "card", card: { number, holder_name, exp_month, exp_year, cvv } }` → `token.id` (uso único, ~1 min). Nunca envie número ao nosso servidor. Implementar em `CardForm` client component com formatação/validação Luhn local.
2. Client envia `{ productId, method: "card", card_token, installments, customer, billing_address? }`.
3. Servidor cria `Order PENDING` → `createCardOrder` com `payments[{ payment_method: "credit_card", credit_card: { installments, statement_descriptor: "AFFILIATE", card_token, card: { billing_address } } }]`.
4. Resposta síncrona: `paid` → `handlePaid` imediatamente (sem esperar webhook); `failed` → `FAILED` + mensagem traduzida; `pending`/`processing` (antifraude) → mantém `PENDING`, UI mostra "Analisando pagamento", webhook decide.

## Webhook `POST /api/webhooks/pagarme`

1. Verifica Basic Auth (`timingSafeEqual`). 401 se inválido, sem detalhes.
2. Parse Zod do envelope `{ id, type, data }`. Grava `WebhookEvent RECEIVED` (`eventId = id`); se já existe → 200 `duplicate`.
3. Eventos tratados: `order.paid`, `order.payment_failed`, `order.canceled`, `charge.paid`, `charge.payment_failed`, `charge.refunded`, `charge.chargedback`, `charge.pending`. Outros → `IGNORED`.
4. Localiza `Order` por `gatewayOrderId` (ou `metadata.orderId`). Não achou → `FAILED` + e-mail admin.
5. **Re-consulta** `getOrder(gatewayOrderId)`; usa o status retornado pela API (não o payload).
6. Transição em transação com lock da linha do pedido: `orders/service.ts::applyGatewayStatus(order, gatewayOrder)`; efeitos colaterais **após** commit: criar comissão, grant de download, e-mails, evento n8n.
7. `PROCESSED` + 200. Qualquer erro → `FAILED` (payload preservado) + 500 (Pagar.me reenviará) — mas só re-tenta se seguro: idempotência protege.

## Transições (`applyGatewayStatus`)

| gateway              | interno                  | efeitos                                                                                                                 |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| paid                 | PAID (`paidAt`)          | `createCommission` se afiliado · `createDownloadGrant` se DIGITAL · e-mails comprador/afiliado/admin · n8n `order.paid` |
| failed               | FAILED (`failureReason`) | e-mail comprador com link para tentar de novo                                                                           |
| canceled             | CANCELED                 | —                                                                                                                       |
| pending / processing | PENDING                  | —                                                                                                                       |
| refunded (charge)    | REFUNDED (`refundedAt`)  | `reverseCommission` · revoga grants · e-mails · n8n `order.refunded`                                                    |
| chargedback          | CHARGEDBACK              | idem + flag `suspicious`                                                                                                |

Transição inválida (ex. REFUNDED → PAID) lança `AppError INVALID_TRANSITION`, loga e é ignorada (não derruba webhook).

## Reconciliação (`/api/cron/reconcile-orders`)

- `PENDING` criados há > 10 min: consulta gateway; se `paid` → aplica; se Pix expirado → `EXPIRED`; se `failed` → `FAILED`.
- `PAID` nas últimas 48 h: consulta; se `refunded`/`chargedback` → aplica.
- Registra `JobRun` com contagens; divergência corrigida gera e-mail admin (informativo).

## Estorno iniciado pelo admin (MVP mínimo)

- Botão "Estornar" no pedido `PAID` → confirma → `cancelCharge(chargeId)` → estado final chega por webhook/reconciliação. Exibe "Estorno solicitado" enquanto aguarda.

## Erros de cartão (mapa mínimo em `map.ts`)

Recusa genérica, saldo/limite, cartão expirado, CVV inválido, bloqueado, antifraude → frases curtas pt-BR + sugestão ("Tente Pix"). Código original vai para `metadata.gatewayDeclineCode` (não exibir).

## Testes obrigatórios

- Unit: `mapGatewayStatus`, `mapCardDecline`, `applyGatewayStatus` para toda a matriz de transições (válidas e inválidas).
- Integration: webhook com auth inválida (401), duplicado (200 duplicate), pedido desconhecido (FAILED), `paid` cria comissão e grant exatamente uma vez mesmo com 3 entregas do mesmo evento.
- E2E (driver fake): Pix criado → "pago" forçado → tela troca sem reload → e-mail (driver log) contém link de download válido.
