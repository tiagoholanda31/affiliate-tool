# 07 · E-mails, Notificações e Integrações

## Provedor de e-mail (gratuito)

**Primário: Resend (plano free — 3.000/mês, 100/dia, 1 domínio verificado).**

- Verificar o **subdomínio** `mail.example.com` (ou `afiliados.`) no Resend: DNS SPF + DKIM (+ DMARC `p=none` no início). Usar subdomínio isola a reputação do domínio raiz do WordPress.
- `MAIL_FROM="Affiliate Tool <noreply@mail.example.com>"`, `Reply-To` = e-mail real do operador.
- O DNS fica no provedor do operador. Registros a criar estão em `08-deploy`.

**Fallback: SMTP** (`MAIL_DRIVER=smtp`): qualquer caixa SMTP autenticada. Limites de envio por hora do provedor se aplicam — suficiente para o volume do MVP.

**Dev/test: `MAIL_DRIVER=log`** (imprime e grava em `EmailLog`, e-2-e lê o `EmailLog` para pegar links).

Regra de volume: e-mails ao **admin** são agregados quando possível (digest de novos cadastros a cada 2 h se houver > 3 em 2 h; vendas em tempo real). Nunca ultrapassar 100/dia no free: se `EmailLog` do dia ≥ 90, apenas e-mails **transacionais ao comprador** e **ao afiliado sobre status** saem; demais entram em `QUEUED` para o dia seguinte.

## Templates (React Email em `emails/`)

Layout base: header navy com a marca, corpo branco, Poppins com fallback, botão primário navy, footer com endereço configurável, WhatsApp e link "por que recebi este e-mail". Texto alternativo (plain) gerado.

| template                                                          | para                     | conteúdo                                                                              |
| ----------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------- |
| `verify-email`                                                    | afiliado                 | link de verificação (expira 24 h)                                                     |
| `reset-password`                                                  | afiliado/admin           | link (15 min)                                                                         |
| `affiliate-pending-admin`                                         | admin                    | novo cadastro: nome, rede social, link para aprovar                                   |
| `affiliate-approved`                                              | afiliado                 | boas-vindas, seu código, primeiro link, como funciona a comissão                      |
| `affiliate-rejected` / `-suspended` / `-reactivated` / `-removed` | afiliado                 | motivo, próximos passos                                                               |
| `order-created-pix`                                               | comprador                | QR/copia-e-cola, expiração, link `/pedido`                                            |
| `order-paid`                                                      | comprador                | recibo resumido, `deliveryNote` (serviço) ou botão download (digital), link `/pedido` |
| `order-failed`                                                    | comprador                | motivo amigável, link para tentar novamente                                           |
| `download-link`                                                   | comprador                | novo grant (reenvio)                                                                  |
| `sale-affiliate`                                                  | afiliado                 | produto, valor, comissão, data prevista de liberação                                  |
| `sale-admin`                                                      | admin                    | resumo + afiliado                                                                     |
| `order-refunded-*`                                                | comprador/afiliado/admin | conforme papel                                                                        |
| `commissions-available-digest`                                    | afiliado                 | soma liberada hoje e próximo pagamento                                                |
| `payout-paid`                                                     | afiliado                 | extrato do lote: comissões, total, referência do Pix                                  |
| `admin-alert`                                                     | admin                    | webhook falho, reconciliação divergente, job com erro, login admin                    |
| `pix-key-changed`                                                 | afiliado                 | aviso de segurança                                                                    |

## Fila e retry

`sendMail` grava `EmailLog QUEUED`, tenta enviar inline (aguarda até 5 s); falha → `attempts++`, fica `QUEUED`; `/api/cron/retry-emails` reenvia até 3 tentativas com backoff (10 min, 1 h, 6 h); depois `FAILED` + visível em `/admin/sistema`.

## Integração n8n (opcional, mesma VPS)

Emissor genérico `src/server/n8n/emit(event, payload)`: `POST N8N_WEBHOOK_URL` com header `X-Signature: HMAC-SHA256(body, N8N_WEBHOOK_SECRET)` e `X-Event`. Fire-and-forget com timeout 5 s; falha só loga. Eventos: `affiliate.approved`, `order.paid`, `order.refunded`, `commission.available`, `payout.paid`, `order.manual_created`.
Uso previsto: fluxo n8n "Append row" no Google Sheets do admin (uma aba por evento) e, se desejado, aviso no WhatsApp da equipe. Assim a planilha fica sincronizada sem credencial Google dentro do app.
Também disponível: exportação CSV/XLSX do filtro atual em Vendas, Comissões e Pagamentos (fatia 07), para conferência manual.

## Agendamento dos crons

Preferência: workflows n8n "Schedule Trigger → HTTP Request" com `Authorization: Bearer CRON_SECRET`. Alternativa: cron do EasyPanel (`docker exec` + `curl` no container). Documentado em `08-deploy`.
