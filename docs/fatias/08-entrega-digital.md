# Fatia 08 · Entrega digital (grants, download, reenvio)

## Objetivo

Comprador de livro digital recebe link protegido após pagamento, baixa com limite de vezes/prazo, pode pedir reenvio;
estorno revoga acesso. Admin vê e reenvia/revoga.

## Pré-requisito

Fatia 07 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 7 Entrega digital; seção 9 downloadGrant*)
- `docs/spec/03-modelo-de-dados.md` (`DownloadGrant`, `DigitalFile`)
- `docs/spec/04-seguranca.md` (Validação — uploads fora de public; Operação)
- `docs/spec/05-design-system-ux.md` (tela `/pedido/[code]` estado Pago)
- `docs/spec/07-emails-notificacoes-integracoes.md` (`order-paid` variante digital, `download-link`)

## Escopo

**Dentro:** `features/delivery/service.ts` (`createGrant`, `revokeGrantsForOrder`, `validateAndConsume`), `GET /download/[token]` streaming, `/pedido/[code]` botão download + "Reenviar link" (limite 3/dia), e-mails, revogação em estorno, admin: seção Entrega no detalhe do pedido (grants, contador, reenviar, revogar), checkbox "enviar link de download" na venda manual de produto digital.
**Fora:** DRM, watermark, vídeo.

## Tarefas

1. Model + migration. `createGrant(orderId, tx)` usa `Setting.downloadGrantDays/downloadMaxCount`; token 32 bytes, hash SHA-256 no banco.
2. Ligar em `onOrderPaid` (DIGITAL) e `onOrderReversed` (revogar todos).
3. `GET /download/[token]`: rate limit por token e IP; valida; `openStream` do storage; headers `Content-Type` real, `Content-Length`, `Content-Disposition: attachment; filename*=UTF-8''<nome-do-produto>.<ext>`, `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`; incrementa contador **antes** do stream (transação); página de erro amigável (expirado/limite/revogado) com CTA para `/pedido`.
4. `/pedido/[code]?t=`: estado Pago para DIGITAL mostra botão "Baixar livro" (link com grant vigente), restantes/validade, "Reenviar link por e-mail" (novo grant, revoga anterior, 3/dia, toast). Sem `t` válido → formulário "digite o e-mail da compra" que envia o link do pedido por e-mail (anti-enumeração).
5. E-mail `order-paid` (variante digital) e `download-link`.
6. Admin detalhe do pedido: seção Entrega com grants, botões Reenviar/Revogar (audit).
7. Venda manual: checkbox "Enviar link de download ao comprador" para produto DIGITAL.

## Critérios de aceite

- Link do e-mail baixa o PDF com nome amigável; 6ª tentativa (limite 5) recebe página "limite atingido" com opção de reenvio; após 7 dias, "expirado".
- Token errado por 1 caractere → 404 genérico; caminho no disco nunca aparece em resposta/erro.
- Estorno → grants revogados imediatamente (download retorna revogado).
- Reenviar 4× no mesmo dia → bloqueio com mensagem.
- Stream de 50 MB não carrega o arquivo inteiro em memória (verificar com `--inspect` ou heap snapshot; anotar).

## Testes

- Unit: `validateAndConsume` (expirado, limite, revogado, ok), geração/hash de token.
- Integration: rota de download (headers, contador, 404), reenvio limite, revogação em estorno, posse (`t` inválido).
- E2E: checkout fake de livro → e-mail no `EmailLog` → download → contador 1.

## Handoff

Registrar limites finais e comportamento do stream; listar e-mails do comprador finalizados.
