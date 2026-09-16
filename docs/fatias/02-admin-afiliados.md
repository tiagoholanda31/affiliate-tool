# Fatia 02 · Admin — gestão de afiliados

## Objetivo

Admin lista, filtra, inspeciona e transiciona afiliados (aprovar, reprovar, suspender, reativar, remover) com motivo,
auditoria e e-mails. Código do afiliado gerado na aprovação.

## Pré-requisito

Fatia 01 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 1 completa; seção 10 linhas de afiliado)
- `docs/spec/05-design-system-ux.md` (Padrões 1–3, 9, 10; tela Admin `/afiliados`)
- `docs/spec/07-emails-notificacoes-integracoes.md` (templates `affiliate-approved/-rejected/-suspended/-reactivated/-removed`)
- `docs/spec/04-seguranca.md` (Checklist)

## Escopo

**Dentro:** `features/affiliates/service.ts` com máquina de estados, geração de código, actions admin, listagem `DataTable` com filtros na URL, detalhe com abas (dados; vendas/comissões/pagamentos como placeholders vazios; auditoria), revelação de Pix auditada, anonimização (job + botão), e-mails.
**Fora:** métricas de vendas (fatias 06–07 preenchem as abas).

## Tarefas

1. `transitionAffiliate(affiliateId, to, { reason, actorId }, tx)`: valida transição pela tabela do `01`, exige `reason` exceto approve, gera `code` na primeira aprovação, atualiza `statusReason/statusChangedAt/reviewedById`, revoga sessões em `SUSPENDED/REMOVED`, grava `AuditLog`, retorna evento para e-mail (enviado fora da transação).
2. `generateAffiliateCode()` 7 chars sem ambíguos, unicidade com retry. `updateAffiliateCode` (uma vez; regras do `01`).
3. `/admin/afiliados`: `DataTable` server-side (busca por nome/e-mail/@/código, filtro status com contagens, ordenação, paginação 25); ações em linha e em massa (aprovar selecionados); badge de status; coluna "cadastro há".
4. `/admin/afiliados/[id]`: header com nome, status, código (copiar), ações contextuais por status; aba **Dados** (contato com links WhatsApp/rede, Pix mascarada + "Revelar" com `AuditLog pix.reveal`, termos aceitos/versão/IP, histórico de status); aba **Auditoria** (AuditLog da entidade). Abas Vendas/Comissões/Pagamentos exibem `EmptyState "disponível em breve"` até as fatias 06–07.
5. `ReasonDialog` para reprovar/suspender/remover (remover exige digitar o nome). Toast com **desfazer** em suspender (10 s → chama `reactivate`).
6. `/api/cron/anonymize-removed` + botão "Anonimizar agora" no detalhe de `REMOVED`.
7. Sino de pendências no header admin: contagem de `PENDING` (fonte para a fatia 10 estender).
8. Templates de e-mail de status, enviados pós-commit.

## Critérios de aceite

- Aprovar um `PENDING` gera código único, envia `affiliate-approved` com o link `/r/<code>` (rota existe só na fatia 04 — apontar para `APP_URL/r/<code>` já correto) e o afiliado passa a acessar `/painel`.
- Reprovar sem motivo é impossível pela UI e pela action (Zod).
- Suspender revoga sessão: afiliado logado cai para `/painel/suspenso` na próxima navegação.
- Filtros e paginação persistem na URL e sobrevivem a refresh; 0 resultados de filtro ≠ lista vazia.
- Revelar Pix gera `AuditLog` com `actorId`; sem revelar, nenhuma resposta ao client contém a chave.
- Anonimização remove PII e mantém `id`, `code`, status e vínculos.

## Testes

- Unit: matriz completa de transições (válidas retornam novo estado; inválidas lançam `INVALID_TRANSITION`); `generateAffiliateCode` (formato, sem ambíguos, colisão); anonimização.
- Integration: cada action admin (permissão negada para afiliado; audit gravado; e-mail enfileirado); bulk approve; revelar Pix.
- E2E: admin aprova afiliado pendente → afiliado loga e vê `/painel`.

## Handoff

Listar contagens/queries que podem ficar lentas (para índices na 10) e o formato do evento de e-mail pós-commit adotado.
