# 04 · Segurança

Referência de revisão para toda fatia (`/revisar` usa este checklist). Ameaças priorizadas: fraude de afiliado
(auto-compra, cliques falsos, manipulação de preço), acesso indevido a arquivos pagos, vazamento de PII/Pix,
abuso de webhooks, takeover de conta admin.

## Autenticação e sessão

- Better Auth com senha (scrypt/argon2 do próprio lib), `minPasswordLength: 10`, verificação de e-mail obrigatória para login, reset por token de uso único (15 min).
- Sessão em banco, cookie `HttpOnly Secure SameSite=Lax`, 7 dias com renovação deslizante; **revogar todas as sessões** ao trocar senha e ao afiliado ser `SUSPENDED`/`REMOVED`.
- Admin: senha ≥ 14 chars no seed; login admin registra `AuditLog` + e-mail "novo login" com IP/UA. (2FA TOTP fica como dívida fase 2 — deixar hook no modelo).
- Rate limit em `/api/auth/*` (10/15 min por IP) e bloqueio progressivo por conta após 5 falhas (Better Auth ou custom).
- Enumeração de e-mail: respostas idênticas em cadastro/reset ("Se este e-mail existir, enviaremos…").

## Autorização

- Todo layout de `(admin)` chama `requireAdmin()`; de `(affiliate)` chama `requireAffiliate()` que também aplica regras por `status` (PENDING → só `/painel/aguardando`, etc.).
- Toda action re-verifica role/status no servidor (não confie no layout). Toda query de afiliado filtra por `affiliateId` da sessão — **nunca** aceite `affiliateId` vindo do client em rotas de afiliado.
- IDs `cuid` + checagem de posse (`where: { id, affiliateId }`) em qualquer leitura de recurso próprio.

## Validação e integridade

- Zod em: forms, search params, route params, webhook payloads, env, `FormData` de upload.
- Preço e comissão sempre recalculados no servidor a partir do banco; o client só envia `productId`, método, parcelas, dados do comprador e `card_token`.
- Uploads: limite de tamanho por tipo, `file-type` por magic bytes, extensão normalizada, nome uuid, armazenamento **fora** de `public/`, servidos por rota autenticada/grant. Imagens re-encodadas com `sharp` (remove metadados/EXIF).
- Markdown de descrição renderizado com sanitização (`rehype-sanitize`).

## Dados sensíveis (LGPD)

- Criptografia AES-256-GCM em repouso: chave Pix, CPF/CNPJ do comprador. Chave em `ENCRYPTION_KEY` (32 bytes), rotação documentada em `08-deploy`.
- Exibição sempre mascarada (`***.456.789-**`, `j***@d***.com`). Revelar Pix completa: ação explícita do admin, `AuditLog pix.reveal`.
- Logs: nunca e-mail/telefone/documento completos; use `mask()`.
- Anonimização de afiliados removidos após 30 dias (job). Botão admin "Anonimizar agora".
- Termos de uso com versão + IP + timestamp. Página pública `/termos` e `/privacidade` (placeholders editáveis).
- Retenção: `Click` bruto 13 meses (job apaga); agregados mantidos.

## Pagamentos

- Dados de cartão **nunca** tocam o servidor: tokenização via chave pública Pagar.me no browser; servidor recebe `card_token` de uso único.
- Webhook: endpoint com **Basic Auth** (usuário/senha configurados no dashboard Pagar.me e em env), IP não confiável; após aceitar, **re-consulta o pedido na API** (`GET /orders/{id}`) e só então muda estado — o payload é gatilho, a API é a verdade.
- Idempotência por `eventId`; transações `SERIALIZABLE` (ou `SELECT … FOR UPDATE`) na transição de status.
- Webhook responde 200 rápido e processa em seguida (mesma request, mas após gravar `RECEIVED`); falha → `FAILED` + e-mail admin; job de reconciliação corrige.

## Web

- Headers via `next.config.ts`: `Content-Security-Policy` (nonce para scripts inline; `connect-src` inclui `api.pagar.me`; `frame-ancestors 'none'`), `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínimo.
- Server Actions: `experimental.serverActions.allowedOrigins` = domínio de produção; verificação de `Origin` já nativa.
- Cookie de atribuição assinado (HMAC) — não confiável para dinheiro, só para atribuição; validado no servidor no checkout.
- Anti-bot no checkout e cadastro: honeypot + tempo mínimo de preenchimento + rate limit. Sem CAPTCHA no MVP (dívida se houver abuso).
- Sem `dangerouslySetInnerHTML` exceto markdown sanitizado.

## Antifraude de afiliados

- Bloqueio de auto-compra por e-mail igual; flag `metadata.suspicious` quando comprador tem mesmo `ipHash` do afiliado nos últimos 30 dias (não bloqueia, destaca no admin).
- Cliques únicos por `ipHash+affiliate/24h`; painel do admin mostra razão cliques/vendas e alerta > 500 cliques/dia por afiliado.
- Carência de 7 dias antes de liberar comissão cobre estornos rápidos.

## Operação

- Segredos apenas em env do EasyPanel. `.env` no `.gitignore`; `.env.example` sem valores reais.
- Dependências: `pnpm audit` na fatia 11 e antes de cada deploy; lockfile commitado.
- Backups diários do Postgres (ver `08-deploy`), teste de restore documentado.
- `/api/health` sem dados sensíveis (`{ ok, db: true, version }`).

## Checklist por fatia (copiar para o handoff)

- [ ] Entradas validadas com Zod (forms, params, webhooks)
- [ ] Actions com `authedAction`/`adminAction`; queries filtradas por posse
- [ ] Nenhum `process.env` fora de `env.ts`
- [ ] PII mascarada em UI e logs; sensíveis criptografados
- [ ] Ações de admin e de dinheiro geram `AuditLog`
- [ ] Uploads validados por magic bytes e fora de `public/`
- [ ] Rate limit nas rotas públicas novas
- [ ] Testes cobrindo caminhos de erro/abuso, não só o feliz
