# Fatia 03 · Admin — produtos, serviços e arquivos digitais

## Objetivo

Admin cadastra serviços e livros digitais com preço, comissão, opções de pagamento e arquivo (PDF/EPUB), publica,
arquiva ou exclui. Vitrine pública `/` e página `/p/[slug]` mostram produtos ativos (ainda sem checkout).

## Pré-requisito

Fatia 02 `DONE`.

## Contexto necessário

- `docs/PROGRESS.md`
- `docs/spec/01-dominio-e-regras.md` (seção 2 Produto)
- `docs/spec/03-modelo-de-dados.md` (`Product`, `DigitalFile`)
- `docs/spec/04-seguranca.md` (Validação e integridade — uploads; Web — markdown)
- `docs/spec/05-design-system-ux.md` (Padrões 3, 5, 9; telas Público `/`, `/p/[slug]`; Admin `/produtos`)
- `docs/spec/02-arquitetura.md` (lib/storage)

## Escopo

**Dentro:** CRUD de produtos, upload de capa (re-encode `sharp`, webp, 3 tamanhos) e de arquivo digital (stream via Route Handler, magic bytes, ≤ 50 MB), slug automático editável, preview markdown sanitizado, vitrine e página do produto (com CTA "Comprar" desabilitado/"em breve" até fatia 05), ordenação drag-and-drop simples (ou campo numérico).
**Fora:** checkout, links de afiliado, materiais.

## Tarefas

1. Models + migration. `features/products/schemas.ts` (form único para ambos os tipos com campos condicionais). Regra: `DIGITAL` só fica `ACTIVE` com arquivo.
2. `lib/storage.ts` já existe: adicionar `saveUpload(req)` streaming em `POST /api/admin/uploads/[kind]` (`kind: cover|digital`) autenticado como admin, retornando `{ path, sha256, size, mime }` para o form guardar até salvar.
3. `/admin/produtos`: tabela (nome, tipo, preço, comissão formatada "15% · R$ 30,00 em R$ 200,00", status, vendas=0 placeholder), filtros, ações (editar, publicar/arquivar, excluir se sem pedidos).
4. `/admin/produtos/novo` e `/[id]`: form em seções (Básico · Preço e comissão · Pagamento · Arquivo/Entrega · Publicação). `MoneyInput`, `PercentInput` com preview da comissão calculada em tempo real sobre o preço; `FileDropzone` com progresso; capa com crop 4:3 opcional.
5. `deleteProduct` bloqueia se houver pedidos (checar `Order` — tabela chega na 05; hoje sempre permite mas deixar a checagem pronta com `count` seguro).
6. Vitrine `/`: grid de cards (capa, nome, descrição curta, preço "de/por", badge tipo). `/p/[slug]`: hero com capa, descrição markdown, preço, parcelamento máximo exibido, CTA placeholder. `generateMetadata` com OG image da capa. 404 para `DRAFT/ARCHIVED` (ARCHIVED mostra página "indisponível" com link à vitrine).
7. `revalidateTag("products")` em mutations.

## Critérios de aceite

- Upload de `.exe` renomeado para `.pdf` é rejeitado (magic bytes); PDF de 60 MB é rejeitado com mensagem clara; upload não trava a UI.
- Capa enviada é reprocessada (sem EXIF) e servida por `next/image` local.
- Preview de comissão bate com `calculateCommission` (mesma função usada no server — exportada de `lib/money` ou `commissions` temporário).
- Slug único; alterar slug de produto publicado avisa que links antigos quebram (dialog) — e cria redirect 301 na `/p/[oldSlug]` via tabela simples `ProductSlugHistory` (ou campo JSON `previousSlugs`).
- Vitrine e produto renderizam sem JS de terceiros e passam Lighthouse a11y ≥ 95.

## Testes

- Unit: schemas (condicionais por tipo), `calculateCommission`, slugify, validação de arquivo.
- Integration: upload aceito/rejeitado, criar/publicar/arquivar/excluir com audit, `DIGITAL` sem arquivo não publica.
- E2E: admin cria livro com PDF → aparece na vitrine → `/p/[slug]` renderiza.

## Handoff

Anotar limites definitivos de upload e caminho do storage em dev; registrar decisão slug-history.
