# 01 · Domínio e Regras de Negócio

Este documento é a fonte de verdade das regras. Toda regra aqui tem teste unitário em `src/features/*/service.test.ts`.

## 1. Afiliado

### Ciclo de vida

```
PENDING ──approve──► APPROVED ──suspend──► SUSPENDED ──reactivate──► APPROVED
   │                    │                      │
   └──reject──► REJECTED│                      │
                        └────────remove────────┴──► REMOVED (soft delete)
```

- `PENDING`: pode logar, vê tela "Cadastro em análise". Não gera links, não vê produtos.
- `APPROVED`: acesso completo à área do afiliado.
- `REJECTED`: pode logar, vê motivo, pode **reenviar** cadastro corrigido (volta a `PENDING`, `reviewCount++`).
- `SUSPENDED`: pode logar, vê motivo e extrato (somente leitura). Links continuam funcionando mas **não geram** cliques nem atribuição nova. Comissões já existentes seguem o fluxo normal e podem ser pagas.
- `REMOVED`: não loga. Dados pessoais anonimizados após 30 dias por job (nome→"Afiliado removido", e-mail→hash, Pix apagada); pedidos e comissões permanecem para histórico contábil com `affiliateId` preservado.
- Toda transição exige `reason` (mín. 10 caracteres) exceto `approve`. Gera `AuditLog` e e-mail ao afiliado.

### Cadastro

Campos: `name`, `email` (único, verificado), `password` (≥ 10 chars, checagem contra lista de senhas comuns),
`phone` (E.164, validação BR), `socialNetwork` (enum) + `socialHandle` (sem `@`, 2–60 chars),
`pixKeyType` (CPF | CNPJ | EMAIL | PHONE | RANDOM) + `pixKey` (validada por tipo; CPF/CNPJ com dígitos verificadores),
`termsAccepted` (obrigatório; grava `termsVersion`, `termsAcceptedAt`, `termsIp`).
Após cadastro: e-mail de verificação → ao verificar, status permanece `PENDING` e admin é notificado.

### Código do afiliado

Gerado na aprovação: 7 caracteres `[a-z0-9]` sem vogais ambíguas (`0,o,1,l,i`), único. Imutável. Editável pelo admin apenas uma vez para vaidade (`grazi`), min 4, max 20, único, `[a-z0-9-]`.

## 2. Produto

- `type`: `SERVICE` | `DIGITAL`
- `status`: `DRAFT` (não listado, checkout bloqueado) · `ACTIVE` · `ARCHIVED` (checkout bloqueado, links mostram "indisponível", histórico preservado)
- `priceCents` ≥ 100 (R$ 1,00). `compareAtPriceCents` opcional ("de/por").
- Comissão: `commissionType` (`PERCENT` em basis points 0–10000 | `FIXED` em centavos ≤ preço) · **snapshot** copiado para a comissão no momento da venda; alterar o produto não altera comissões passadas.
- Pagamento: `allowPix`, `allowCard`, `maxInstallments` (1–12), `installmentsInterestFree` (bool; se falso, juros do gateway repassados — MVP: sempre sem juros até `maxInstallments`).
- `DIGITAL` exige `DigitalFile` (PDF/EPUB, ≤ 50 MB, mimetype verificado por assinatura, não só extensão) para ficar `ACTIVE`.
- `SERVICE` pode ter `deliveryNote` (texto exibido pós-compra: "Entraremos em contato em até 1 dia útil pelo WhatsApp").
- Exclusão: se tem pedidos → só `ARCHIVED`. Sem pedidos → hard delete permitido (com confirmação "digite o nome").

## 3. Link e clique

- Link por produto: `https://affiliates.example.com/r/<code>/<productSlug>`
- Link geral (vitrine): `https://affiliates.example.com/r/<code>`
- Ao acessar `/r/...`:
  1. Valida `code` (existe, `APPROVED`). Se `SUSPENDED`/`REMOVED`/inválido → redireciona ao destino **sem** cookie nem clique.
  2. Grava `Click` (affiliateId, productId?, ipHash = sha256(ip + salt diário), uaHash, referer, `isUnique` = não existe clique do mesmo ipHash+affiliate nas últimas 24h).
  3. Filtra bots por UA conhecido (lista curta) → grava com `isBot=true`, não conta.
  4. Seta cookie `if_ref` = JWT assinado `{a: affiliateId, c: clickId, exp}` · `HttpOnly`, `Secure`, `SameSite=Lax`, 30 dias (configurável `attributionDays`).
  5. Redireciona 302 para `/p/<slug>` ou `/` (vitrine).
- **Último clique vence**: novo `/r/` de outro afiliado sobrescreve o cookie.
- Auto-atribuição proibida: se o e-mail do comprador for igual ao do afiliado → pedido registrado **sem** afiliado, com `metadata.selfPurchaseBlocked=true`.

## 4. Pedido (Order)

### Origem

- `CHECKOUT`: criado pelo comprador. Passa pelo Pagar.me.
- `MANUAL`: criado pelo admin. Já nasce `PAID` com `paidAt` informado (não pode ser futuro), `paymentMethod=MANUAL`, `amountCents` livre (pode diferir do preço do produto — negociação), afiliado opcional escolhido em busca.

### Ciclo de vida (CHECKOUT)

```
PENDING ──webhook paid──► PAID ──refund──► REFUNDED
   │                        └──chargeback──► CHARGEDBACK
   ├──payment_failed──► FAILED
   └──pix expirou / job──► EXPIRED
```

- Criação: valida produto `ACTIVE`, recalcula `amountCents` **no servidor** a partir do produto (nunca confia no client), resolve atribuição pelo cookie, cria Order `PENDING`, chama Pagar.me, salva `gatewayOrderId`/`gatewayChargeId` e dados do Pix (qr_code, qr_code_url, expires_at).
- Pix expira em 30 minutos. Job marca `EXPIRED` os `PENDING` Pix com `pixExpiresAt < now - 5min`.
- Cartão recusado → `FAILED` com `failureReason` amigável (mapa de códigos → mensagens pt-BR).
- `publicCode` legível: `IF-` + 6 chars `[A-Z0-9]`, usado no e-mail e na página `/pedido/<publicCode>?t=<token>`.
- Idempotência: webhooks gravados em `WebhookEvent` por `eventId`; reprocessar não duplica efeitos.
- Reconciliação: job a cada 15 min consulta no Pagar.me os `PENDING` com > 10 min e os `PAID` das últimas 48h, corrige divergências e loga.

## 5. Comissão

- Criada quando Order vira `PAID` (checkout ou manual) **e** tem `affiliateId`.
- Cálculo (`calculateCommission(amountCents, snapshot)`): `PERCENT` → `round(amount * bp / 10000)` com arredondamento half-even; `FIXED` → `min(fixed, amount)`. Nunca negativa.
- `PENDING` → job diário (ou webhook cron) vira `AVAILABLE` quando `now >= availableAt = paidAt + holdDays` (padrão 7, `Setting.holdDays`, 0–90). Mudança de `holdDays` afeta só comissões futuras.
- `REVERSED` quando Order vira `REFUNDED`/`CHARGEDBACK`:
  - se `PENDING`/`AVAILABLE` → `REVERSED`, sai dos saldos
  - se `PAID` → cria `CommissionAdjustment` negativo no afiliado (saldo devedor exibido; abatido automaticamente do próximo lote)
- Sem valor mínimo de pagamento.

### Saldos do afiliado (sempre derivados, nunca armazenados)

- **Pendente**: soma `PENDING`
- **Disponível**: soma `AVAILABLE` − ajustes negativos abertos
- **Pago**: soma `PAID` (total histórico)
- **Próximo pagamento previsto**: próximo dia `Setting.payoutDay` (padrão 10) ≥ hoje; se cair em fim de semana, exibe a data mesmo (pagamento é manual, admin decide).

## 6. Lote de pagamento (Payout)

- Admin abre "Pagamentos" → lista afiliados com `Disponível > 0`, ordenados por valor.
- "Gerar lote" para um afiliado: cria `Payout DRAFT` com todas as comissões `AVAILABLE` daquele afiliado (ou seleção), `totalCents` = soma − ajustes abertos.
- Tela do lote mostra: chave Pix (revelar sob clique, mascarada por padrão, registra `AuditLog` da revelação), valor, botão "Copiar chave", "Copiar valor".
- "Marcar como pago": exige `paidAt` (≤ hoje) e ao menos um de `proofReference` (ID/E2E da transação Pix) ou `proofFile` (comprovante). Comissões → `PAID`, e-mail ao afiliado com extrato do lote.
- Lote `DRAFT` pode ser desfeito (comissões voltam a `AVAILABLE`). Lote `PAID` é imutável; erro → admin cria ajuste manual (`CommissionAdjustment` positivo/negativo com motivo).

## 7. Entrega digital

- Ao `PAID` de produto `DIGITAL`: cria `DownloadGrant` (`token` aleatório 32 bytes, armazenado como hash; `expiresAt = +7 dias`; `maxDownloads = 5`) e envia e-mail com link `/download/<token>`.
- Rota de download: valida hash, expiração, contador, `revokedAt`; serve o arquivo por stream com `Content-Disposition: attachment`, nome amigável, sem revelar caminho. Incrementa contador.
- Página `/pedido/<publicCode>?t=<orderToken>`: mostra status e botão "Reenviar link de download" (gera novo grant, revoga o anterior, limitado a 3 reenvios/dia) — o `orderToken` vai no e-mail de confirmação.
- Order `REFUNDED`/`CHARGEDBACK` → todos os grants `revokedAt = now`.

## 8. Materiais de divulgação

- Tipos: `IMAGE` (jpg/png/webp ≤ 10 MB), `PDF` (≤ 20 MB), `TEXT` (copy pronta com placeholder `{{link}}` substituído pelo link do afiliado ao copiar), `LINK` (URL externa, ex. vídeo no YouTube).
- Opcionalmente vinculado a um produto (aparece na página do produto para o afiliado) ou geral.
- Só afiliados `APPROVED` acessam. Download por rota autenticada (não pública).

## 9. Configurações (Setting, linha única)

| chave                        | padrão           | limites                                                                                     |
| ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------- |
| holdDays                     | 7                | 0–90                                                                                        |
| payoutDay                    | 10               | 1–28                                                                                        |
| attributionDays              | 30               | 1–90                                                                                        |
| pixExpirationMinutes         | 30               | 10–120                                                                                      |
| downloadGrantDays            | 7                | 1–30                                                                                        |
| downloadMaxCount             | 5                | 1–20                                                                                        |
| termsVersion / termsMarkdown | v1 / placeholder | edição exige nova versão; afiliados existentes veem banner para re-aceitar (não bloqueante) |
| adminNotifyEmail             | (env)            | e-mail válido                                                                               |
| supportWhatsapp              | +5511912345678   | E.164                                                                                       |

Toda alteração gera `AuditLog` com before/after.

## 10. Notificações (evento → destinatário)

| Evento                                                 | Afiliado                                      | Admin                  |
| ------------------------------------------------------ | --------------------------------------------- | ---------------------- |
| Cadastro criado (e-mail verificado)                    | —                                             | Novo cadastro pendente |
| Aprovado / Reprovado / Suspenso / Reativado / Removido | Sim (com motivo)                              | —                      |
| Venda paga atribuída                                   | Sim (produto, valor, comissão, data prevista) | Sim (resumo)           |
| Venda estornada                                        | Sim                                           | Sim                    |
| Comissão liberada (AVAILABLE)                          | Digest diário se houver                       | —                      |
| Lote pago                                              | Sim (extrato)                                 | —                      |
| Webhook falhou / reconciliação divergente              | —                                             | Sim                    |
| Comprador: pedido criado (Pix) / pago / download       | Comprador                                     | —                      |
