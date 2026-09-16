# 00 · Visão e Escopo

## Objetivo

Permitir que pessoas (afiliados) divulguem serviços e livros digitais por links
rastreáveis, que compradores paguem por um checkout próprio (Pagar.me) e que o operador acompanhe e pague
comissões com transparência — sem depender de plataforma terceira de afiliados.

Este repositório é a ferramenta genérica (white-label): um operador configura marca, produtos,
comissões e pagamentos. O domínio de exemplo é `affiliates.example.com`.

## Atores

| Ator                    | Descrição                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Visitante/Comprador** | Chega por link de afiliado (ou direto), compra um serviço/livro no checkout. Não cria conta. Recebe e-mail com confirmação e, para livros, link de download. |
| **Afiliado**            | Cadastra-se, aguarda aprovação, gera links, acompanha cliques, vendas, comissões e pagamentos, baixa materiais de divulgação.                                |
| **Admin**               | Único no MVP. Aprova/reprova/suspende/remove afiliados, cadastra produtos e materiais, lança vendas manuais, libera e paga comissões, configura regras.      |
| **Sistema**             | Atribui vendas a afiliados, calcula comissões, aplica carência, processa webhooks, envia e-mails, entrega arquivos.                                          |

## Escopo do MVP (fatias 00–11)

- Cadastro de afiliado com: nome, e-mail, celular/WhatsApp, rede social principal + @, tipo e chave Pix, aceite dos termos
- Aprovação/reprovação/suspensão/remoção com motivo, e-mails automáticos
- Produtos de dois tipos: **Serviço** (checkout, sem entrega automática) e **Livro digital** (checkout + download protegido de PDF/EPUB)
- Comissão por produto: percentual ou valor fixo
- Link de afiliado por produto e link geral; contagem de cliques (total e únicos); atribuição último clique em 30 dias
- Checkout Pagar.me: Pix (QR + copia-e-cola, expiração) e cartão (tokenização no browser, parcelamento configurável por produto)
- Webhooks Pagar.me → pedido pago/falho/estornado/chargeback → comissão criada/revertida
- **Venda manual** lançada pelo admin (negociações por WhatsApp), com ou sem afiliado
- Carência de comissão: 7 dias (configurável) → status "Disponível"
- Pagamento de comissão **manual** pelo admin: cria lote por afiliado, marca como pago, anexa comprovante/ID da transação
- Extrato do afiliado; visão consolidada do admin; exportação CSV/XLSX
- Materiais de divulgação (imagens, PDFs, textos prontos, links) cadastrados pelo admin
- Notificações por e-mail (Resend, plano gratuito) para admin e afiliados
- Integração opcional via webhook n8n (já existente na VPS) → Google Sheets
- Deploy Docker no EasyPanel (VPS)

## Fora do escopo (registrar como fase 2 se surgir)

- Split automático de pagamento (Pagar.me Recebedores) — a modelagem já deixa `Affiliate.gatewayRecipientId` reservado
- Hospedagem de vídeo, cursos online, área de membros
- Multi-admin, permissões granulares, multiempresa
- Afiliação multinível, cupons de desconto, assinaturas/recorrência
- App mobile, dark mode, i18n além de pt-BR
- Emissão de nota fiscal, cálculo de impostos, KYC

## Restrições e premissas

- Servidor: VPS com EasyPanel (e n8n opcional para crons). Alvo: app ≤ 512 MB RAM em regime, Postgres ≤ 512 MB.
- Sem serviço de e-mail pago no MVP: Resend free (3.000/mês, 100/dia) com domínio verificado; fallback SMTP.
- Conta Pagar.me: desenvolvimento e testes com sandbox; produção troca apenas as chaves (`PAGARME_SECRET_KEY`, `PAGARME_PUBLIC_KEY`, webhook). Não há dependência de ID de conta no código.
- Volume estimado: dezenas de afiliados, centenas de pedidos/mês. Otimize para clareza e segurança, não para escala massiva.
- LGPD: coletar o mínimo, criptografar chave Pix e documento do comprador em repouso, registrar consentimento com versão dos termos, permitir exclusão/anonimização do afiliado.

## Métricas de sucesso do produto

- Afiliado consegue se cadastrar e copiar um link em < 3 minutos após aprovação, pelo celular
- Admin aprova um afiliado, cadastra um produto e lança uma venda manual sem ler manual
- 100% dos pedidos pagos no gateway refletidos no sistema em < 1 minuto (webhook) e 100% reconciliados em < 1 hora (job)
- Nenhum arquivo digital acessível sem grant válido

## Glossário

- **Código do afiliado**: identificador curto e único (ex. `graz7k2`) usado nos links `/r/<codigo>`
- **Grant de download**: autorização temporária e limitada para baixar o arquivo de um pedido pago
- **Carência (hold)**: período entre pagamento e liberação da comissão para pagamento
- **Lote de pagamento (Payout)**: conjunto de comissões disponíveis de um afiliado pagas juntas pelo admin
