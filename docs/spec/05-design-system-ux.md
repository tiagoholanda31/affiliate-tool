# 05 · Design System e UX

Tema **claro** apenas. A interface deve parecer um produto premium: calma, espaçosa,
poucas cores por tela, dourado usado com parcimônia. Tokens podem ser trocados em
`src/app/globals.css` e `src/lib/design-tokens.ts` para outra marca.

## Tokens (Tailwind 4 `@theme` em `src/app/globals.css`)

```css
@theme {
  /* marca */
  --color-navy-900: #00172d; /* texto principal, headings, botão primário */
  --color-navy-800: #0b2440;
  --color-navy-700: #163356;
  --color-teal-700: #2f7f7a; /* ação secundária, links, foco, sucesso institucional */
  --color-teal-600: #3a9691;
  --color-teal-100: #e3f1f0;
  --color-gold-500: #e9be60; /* destaque: badge "comissão", KPI de ganhos, ícone da marca */
  --color-gold-600: #d1a84b; /* texto dourado sobre claro (contraste) */
  --color-gold-100: #fbf3e0;
  --color-mist-300: #b8c6dd; /* bordas, divisores, ícones inativos */
  --color-mist-100: #f0f2f4; /* fundo da aplicação */
  --color-white: #ffffff; /* superfícies (cards) */
  /* semânticas */
  --color-success: #2f7f7a;
  --color-success-bg: #e3f1f0;
  --color-warning: #b7791f;
  --color-warning-bg: #fbf3e0;
  --color-danger: #b42318;
  --color-danger-bg: #fdecea;
  --color-info: #1d4f8f;
  --color-info-bg: #e8f0fb;
  /* tipografia */
  --font-display: "Playfair Display", ui-serif, Georgia, serif; /* substitui JRoxborough CF */
  --font-sans: "Poppins", ui-sans-serif, system-ui, sans-serif;
  /* raio / sombra */
  --radius-lg: 1rem;
  --radius-md: 0.75rem;
  --radius-sm: 0.5rem;
  --shadow-card: 0 1px 2px rgb(0 23 45 / 0.06), 0 8px 24px -12px rgb(0 23 45 / 0.12);
}
```

- Fontes via `next/font/google` (Poppins 400/500/600; Playfair Display 500/600), `display: swap`, subsets latin.
- Contraste: texto normal sempre `navy-900`/`navy-700` sobre `white`/`mist-100`; dourado **nunca** como texto pequeno sobre branco (use `gold-600` ≥ 18 px ou sobre `navy`). Verificar AA em todos os pares usados.
- shadcn/ui: mapear `--primary` → navy-900, `--secondary` → teal-700, `--accent` → gold-100, `--muted` → mist-100, `--border` → mist-300, `--ring` → teal-700. Componentes gerados não devem ser editados fora do mapeamento de tokens.

## Tipografia

- Display (Playfair): apenas H1 de página e números-destaque de KPI (ex. saldo disponível). Nunca em botões ou tabelas.
- Sans (Poppins): tudo o mais. Escala: 12/14/16/18/24/32/40. Line-height 1.5 corpo, 1.15 display.
- Números tabulares (`font-variant-numeric: tabular-nums`) em tabelas e KPIs.

## Layout

- **Afiliado (mobile-first)**: bottom nav no celular (Início · Links · Vendas · Materiais · Perfil), sidebar no desktop. Largura máxima 1200 px.
- **Admin (desktop-first, responsivo)**: sidebar fixa 260 px com grupos (Visão geral · Afiliados · Produtos · Vendas · Comissões · Pagamentos · Materiais · Configurações · Sistema). Header com busca global (⌘K) e sino de pendências.
- **Público** (vitrine, produto, checkout, pedido): header mínimo com logo dourado sobre navy, conteúdo em card branco sobre `mist-100`, footer com contato do suporte e selo "Pagamento seguro via Pagar.me".
- Grid 8 pt. Cards com `shadow-card`, `radius-lg`, padding 24. Densidade confortável; tabelas com linha 48 px.

## Padrões de UX obrigatórios

1. **Estados completos** em toda lista/painel: loading (skeleton com mesma geometria), vazio (ilustração leve + CTA), erro (mensagem + tentar novamente), sem resultados de filtro (distinto de vazio).
2. **Feedback imediato**: `useActionState`/`useOptimistic` em ações rápidas (aprovar, copiar, arquivar); toast (sonner) confirmando com **ação de desfazer** quando reversível (arquivar produto, suspender).
3. **Destrutivo com fricção proporcional**: remover afiliado/produto → diálogo com motivo obrigatório + digitar o nome. Marcar lote pago → resumo do que vai acontecer (n comissões, valor, e-mail que será enviado).
4. **Copiar link em um toque** com feedback "Copiado" e QR code gerado no client (`qrcode` lib) para compartilhar em stories. Botão "Compartilhar" usa Web Share API quando disponível.
5. **Formulários**: validação inline no blur, mensagem sob o campo, resumo de erros no topo com links (a11y), máscaras pt-BR (telefone, CPF/CNPJ, moeda) com valor limpo no submit, botão desabilitado só enquanto envia (não por invalidez), autofocus no primeiro erro.
6. **Progressive disclosure**: cadastro em 2 passos (dados + Pix/termos) com barra de progresso; checkout em uma página com seções colapsáveis (dados → pagamento), resumo fixo no desktop / drawer no mobile.
7. **Checkout Pix**: QR grande, botão "Copiar código", contador regressivo, polling a cada 4 s (`router.refresh`/SSE simples) que troca a tela para "Pagamento confirmado" sem reload manual; instruções curtas em 3 passos.
8. **Checkout cartão**: campos com formatação e detecção de bandeira, parcelas com valor por parcela, erros do gateway traduzidos ("Cartão recusado pelo banco. Tente outro cartão ou Pix.").
9. **Tabelas** (TanStack): ordenação, filtros persistidos na URL (`searchParams`), paginação server-side 25/página, seleção em massa quando fizer sentido (aprovar vários), exportar CSV do filtro atual, colunas ocultáveis no desktop e cards empilhados no mobile.
10. **Status sempre com ícone + cor + texto** (badge). Cores semânticas: PENDING=warning, APPROVED/PAID/AVAILABLE=success, REJECTED/FAILED/REVERSED=danger, SUSPENDED/EXPIRED=neutral, DRAFT=info.
11. **Dinheiro**: `R$ 1.234,56` sempre; ganhos do afiliado em destaque dourado sobre navy no card principal; diferenciar "Pendente" (com tooltip "libera em dd/mm") de "Disponível".
12. **Datas** relativas na lista ("há 2 h") com absoluta no `title`; absolutas em extratos.
13. **Acessibilidade**: foco visível `ring-teal-700`, `aria-live` para toasts e troca de estado do Pix, labels reais, navegação por teclado em diálogos e menus (Radix já cobre), contraste AA, `prefers-reduced-motion` respeitado.
14. **Performance percebida**: `loading.tsx` por segmento, `Suspense` nos gráficos, imagens via `next/image` com `sizes`, sem bibliotecas de gráfico no bundle público.
15. **Microcopy** em pt-BR, direta, segunda pessoa, sem jargão ("Sua comissão fica disponível 7 dias após o pagamento — isso protege contra estornos.").

## Inventário de telas

**Público**: `/` vitrine (produtos ativos) · `/p/[slug]` produto + checkout · `/pedido/[code]` status/download · `/download/[token]` (rota) · `/termos` · `/privacidade` · `/r/[code]/[[...slug]]` (rota)

**Auth**: `/entrar` · `/cadastro` (2 passos) · `/verificar-email` · `/recuperar-senha` · `/redefinir-senha`

**Afiliado** `/painel`: início (KPIs: cliques 30d, vendas 30d, pendente, disponível, próximo pagamento; gráfico cliques×vendas; últimas vendas) · `/links` (link geral + por produto, QR, materiais do produto) · `/vendas` (lista com status e comissão) · `/comissoes` (extrato: pendente/disponível/pago, lotes) · `/materiais` · `/perfil` (dados, Pix — alteração de Pix exige senha e gera e-mail de aviso) · `/aguardando` · `/suspenso` · `/reprovado` (com reenvio)

**Admin** `/admin`: visão geral (KPIs mês, funil clique→venda, pendências: afiliados a aprovar, comissões disponíveis, webhooks falhos) · `/afiliados` (+ detalhe com abas: dados, vendas, comissões, pagamentos, auditoria) · `/produtos` (+ form) · `/vendas` (+ "Lançar venda manual", detalhe do pedido com timeline) · `/comissoes` · `/pagamentos` (+ lote) · `/materiais` · `/configuracoes` (regras, termos) · `/sistema` (webhooks, jobs, e-mails, auditoria)

## Componentes compartilhados (`src/components/`)

`AppShell` · `PageHeader` (título display + ações) · `KpiCard` · `StatusBadge` · `MoneyText` · `DateText` · `EmptyState` · `ErrorState` · `ConfirmDialog` (com modo "digite para confirmar") · `ReasonDialog` · `CopyButton` · `ShareLinkCard` (link + copiar + QR + compartilhar) · `DataTable` (wrapper TanStack + URL state) · `FileDropzone` · `MaskedInput` (phone/cpf/cnpj/money) · `Timeline` · `PixQr` · `CountdownTimer`
