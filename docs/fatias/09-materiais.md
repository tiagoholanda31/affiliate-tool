# Fatia 09 · Materiais de divulgação

## Objetivo

Admin cadastra materiais (imagens, PDFs, textos prontos, links), gerais ou por produto; afiliado aprovado navega,
copia textos já com seu link e baixa arquivos.

## Pré-requisito

Fatia 08 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 8 Materiais)
- `docs/spec/03-modelo-de-dados.md` (`Material`)
- `docs/spec/05-design-system-ux.md` (Padrões 1, 4; telas `/painel/materiais`, `/painel/links` integração, Admin `/materiais`)
- `docs/spec/04-seguranca.md` (uploads)

## Escopo

**Dentro:** CRUD admin com upload (reutiliza `/api/admin/uploads/[kind]` com `kind: material`), ordenação, ativo/inativo, vínculo opcional a produto; galeria do afiliado com filtros (tipo, produto), preview de imagem, copiar texto com `{{link}}` substituído pelo link do afiliado (geral ou do produto vinculado), download por rota autenticada `GET /api/materials/[id]/download` (afiliado APPROVED ou admin), contagem de downloads (opcional, agregada), materiais do produto exibidos em `/painel/links`.
**Fora:** editor de imagens, geração automática de criativos.

## Tarefas

1. Model + migration (+ `downloadCount Int @default(0)` se adotar contagem).
2. Admin `/admin/materiais`: grid/tabela com thumb, tipo, produto, status, ordem; form em Sheet (título, descrição, tipo → campos condicionais, produto, ativo). Imagens re-encodadas (`sharp`) mantendo original para download? **Decisão:** manter original (afiliado precisa da qualidade) + thumb webp para listagem.
3. Afiliado `/painel/materiais`: filtros na URL; cards com preview; ações: Baixar, Copiar texto (com substituição), Abrir link; `EmptyState` orientando quando não há materiais.
4. Integração em `/painel/links`: sob cada produto, materiais vinculados (até 3 + "ver todos").
5. Rota de download autenticada com `Content-Disposition`.

## Critérios de aceite

- Afiliado `PENDING/SUSPENDED` não acessa materiais nem a rota de download (403 → redirect status).
- Texto com `{{link}}` copiado contém `https://affiliates.example.com/r/<code>/<slug>` do afiliado logado.
- Upload de 25 MB de PDF é rejeitado (limite 20); imagem 10 MB aceita e thumb gerado.
- Inativar material esconde do afiliado imediatamente (`revalidateTag("materials")`).

## Testes

- Unit: substituição de placeholder, schemas condicionais.
- Integration: CRUD com audit, download por role/status, limites de upload.
- E2E: admin cadastra texto com `{{link}}` → afiliado copia e recebe link próprio.

## Handoff

Registrar limites e decisão sobre contagem de downloads.
