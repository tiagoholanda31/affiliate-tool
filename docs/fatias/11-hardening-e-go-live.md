# Fatia 11 · Hardening, acessibilidade, e2e completo, deploy e go-live

## Objetivo

Aplicação pronta para produção na VPS: segurança revisada, acessibilidade auditada, e2e do fluxo completo, deploy no
EasyPanel, DNS, e-mail e Pagar.me de produção configurados, backups e monitoramento ativos, runbook escrito.

## Pré-requisito

Fatia 10 `DONE`. Pendências externas do `PROGRESS.md` resolvidas (conta Pagar.me, DNS, Resend, termos).

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/04-seguranca.md` (inteiro)
- `docs/spec/08-deploy-easypanel.md` (inteiro)
- `docs/spec/05-design-system-ux.md` (Padrão 13 acessibilidade; 14 performance)
- `docs/spec/06-pagamentos-pagarme.md` (Contas e chaves; Webhook)

## Escopo

**Dentro:** auditoria de segurança com checklist, `pnpm audit`, CSP enforce final, rate limits revisados, headers, testes de abuso (auto-compra, preço, IDOR entre afiliados, upload malicioso, webhook forjado), a11y (axe em todas as telas, teclado, leitor de tela nas telas críticas), performance (Lighthouse público ≥ 90 perf/≥ 95 a11y), e2e completo, `scripts/create-admin.ts`, `scripts/rotate-encryption-key.ts`, `BUILD_SHA` no health, deploy, smoke em produção com R$ 1,00 real + estorno, backups + restore testado, monitor uptime, runbook `docs/RUNBOOK.md` (único novo doc permitido), remoção de rotas `/dev/*` em produção (guard por env).
**Fora:** novas features.

## Tarefas

1. Segurança: rodar checklist por área; grep de `process.env`, `dangerouslySetInnerHTML`, `any`; verificar todas as actions com wrapper; testes de abuso listados acima em `tests/integration/abuse.test.ts`; `pnpm audit --prod` sem high/critical (ou justificar em PROGRESS).
2. CSP enforce com nonce; testar tokenização Pagar.me e QR sob CSP; `Permissions-Policy`; HSTS preload-ready.
3. Acessibilidade: `@axe-core/playwright` em todas as rotas autenticadas e públicas; corrigir violações; navegação por teclado no checkout e nos diálogos; `aria-live` em Pix e toasts; contraste re-verificado.
4. Performance: analisar bundle (`@next/bundle-analyzer`), garantir Recharts/TanStack fora das rotas públicas, imagens otimizadas, `loading.tsx` completos, Lighthouse mobile em `/`, `/p/[slug]`, `/pedido/[code]`.
5. E2E completo (fake gateway): cadastro → verificação → admin aprova → link → clique → checkout Pix pago → comissão pendente → cron libera → lote → pago → extrato; + cartão recusado; + estorno reverte; + download com limite. Rodar em CI local (`pnpm test:e2e` headless).
6. Scripts operacionais: `create-admin`, `rotate-encryption-key`, `seed-volume` (já existe) marcado dev-only.
7. Deploy: seguir `08` passo a passo; `Dockerfile` build no EasyPanel; volume; env; domínio; health; migrations no start; `BUILD_SHA` via env do EasyPanel (ou git sha no build arg).
8. Produção: DNS (A + Resend); webhook Pagar.me (Basic Auth); `create-admin`; login e troca de senha; produto de teste R$ 1,00 → Pix pago → comissão → estorno → verificar tudo; remover produto de teste.
9. Backups (EasyPanel/R2 ou n8n) + **restore testado** em serviço temporário; monitor uptime; crons no n8n com alertas.
10. `docs/RUNBOOK.md`: como fazer deploy/rollback, trocar chaves Pagar.me, rotacionar `ENCRYPTION_KEY`, restaurar backup, reprocessar webhook, criar admin, o que fazer se e-mail free estourar, contatos.
11. Handoff final: PROGRESS com "Estado atual" definitivo, dívidas fase 2 (2FA admin, split automático, CAPTCHA se abuso, S3), e checklist de entrega para a cliente.

## Critérios de aceite

- Checklist de segurança 100% marcado com evidência; testes de abuso verdes; `pnpm audit` limpo ou justificado.
- axe sem violações `serious/critical`; Lighthouse conforme metas.
- E2E completo verde localmente.
- `https://affiliates.example.com/api/health` → `{ ok: true, db: true, version }`; TLS válido; webhook de produção recebido e processado no teste de R$ 1,00; estorno refletido.
- Backup diário configurado e restore validado (contagem de pedidos igual).
- Rotas `/dev/*` retornam 404 em produção.
- RUNBOOK completo e PROGRESS finalizado.

## Testes

- Todos os anteriores + `abuse.test.ts` + axe + e2e completo.

## Handoff

Este é o último handoff: estado final, credenciais/URLs (sem segredos — indicar onde estão), pendências fase 2 e data do go-live.
