# Passo a passo — deploy no EasyPanel (VPS)

Pacote desta pasta: `affiliate-tool-easypanel.zip`  
App em produção: `https://affiliates.example.com`  
Build: Dockerfile na raiz do zip (Node 24, Postgres 16, volume em `/data/storage`).

Faça **nesta ordem**. Não pule o volume nem os *Build Arguments* — sem eles o app sobe quebrado ou perde arquivos no próximo deploy.

---

## Antes de abrir o EasyPanel

Na sua máquina (Git Bash ou WSL):

```bash
openssl rand -base64 32   # rode 5 vezes e guarde cada valor
```

No PowerShell, se não tiver `openssl`:

```powershell
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$b = New-Object byte[] 32
$rng.GetBytes($b)
[Convert]::ToBase64String($b)
```

Anote com nome (não reutilize o mesmo valor):

| Nome | Uso |
| --- | --- |
| `BETTER_AUTH_SECRET` | sessões |
| `ENCRYPTION_KEY` | Pix e CPF (AES) — **tem que ser** a saída do comando acima (32 bytes em base64) |
| `REF_COOKIE_SECRET` | cookie de afiliado |
| `CRON_SECRET` | crons do n8n |
| `PAGARME_WEBHOOK_PASSWORD` | Basic Auth do webhook |

Tenha também: e-mail do admin, chaves Pagar.me (`sk_` / `pk_`) se já existirem, API key do Resend se já existir, IP da VPS.

Se Pagar.me ou Resend ainda não estiverem prontos, o app **sobe mesmo assim** (passos 14–15). Checkout real e e-mail ficam para depois.

---

## 1. Projeto

1. Abra o EasyPanel da VPS.
2. **Create Project** (ou **Novo projeto**) → nome: `affiliate-tool`.
3. Entre no projeto.

---

## 2. Banco Postgres

1. **+ Service** → **Postgres**.
2. Nome: `db`.
3. Imagem: `postgres:16-alpine` (se o serviço já vier em 16, mantenha).
4. Usuário / senha / database: deixe o EasyPanel gerar senha forte. Anote.
5. **Resources**: memória **512 MB**.
6. Em *Advanced* (se existir): `shared_buffers=128MB`, `max_connections=30`.
7. Crie o serviço e espere ficar *Running*.
8. Abra o serviço `db` e copie a **Internal Connection URL** (host interno, porta 5432).

Monte a URL do Prisma assim (adicione `?schema=public`):

```text
postgresql://USUARIO:SENHA@HOST_INTERNO:5432/DATABASE?schema=public
```

- Use o host **interno** (algo como `affiliate_db` ou `db`), nunca `localhost`.
- Se a senha tiver `@`, `#`, `%` ou `/`, codifique na URL (ex.: `@` → `%40`).

Não exponha a porta 5432 para a internet.

---

## 3. App a partir do ZIP

1. Ainda no projeto `affiliate-tool`: **+ Service** → **App**.
2. Nome: `web`.
3. **Source**:
   - Se existir **Upload** / **Arquivo**: envie `deploy/affiliate-tool-easypanel.zip`.
   - Se só existir **Git**: crie um repositório **privado**, envie o **conteúdo** do zip (arquivos na raiz, sem pasta extra) e conecte a branch `main`. Ative **Deploy on push**.
4. **Build**: Dockerfile.
5. Caminho do Dockerfile: `./Dockerfile`.
6. Porta: **3000**.

O zip já está com o `Dockerfile` na raiz. Não extraia e recompacte dentro de uma pasta `affiliate-tool/` — o EasyPanel precisa ver `Dockerfile` no primeiro nível.

---

## 4. Build Arguments (obrigatórios)

No serviço `web` → **Build** / **Build Arguments** (não são as env de runtime):

| Argumento | Valor |
| --- | --- |
| `APP_URL` | `https://affiliates.example.com` |
| `NEXT_PUBLIC_APP_URL` | `https://affiliates.example.com` |
| `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` | `pk_live_…` ou `pk_test_…` (a chave **pública**) |
| `BUILD_SHA` | data ou SHA, ex. `20260911` |

`NEXT_PUBLIC_*` e `APP_URL` entram no bundle **no build**. Mudou o domínio ou a `pk_`? Altere o arg e faça **Rebuild**, não só Restart.

Se for testar antes do DNS, use o domínio provisório do EasyPanel nesses três primeiros args, faça o build, e **rebuild** quando o domínio real estiver no ar.

---

## 5. Variáveis de ambiente (runtime)

Serviço `web` → **Environment**. Cole e preencha:

```env
NODE_ENV=production
DATABASE_URL=postgresql://USUARIO:SENHA@HOST_INTERNO:5432/DATABASE?schema=public
APP_URL=https://affiliates.example.com
NEXT_PUBLIC_APP_URL=https://affiliates.example.com
BETTER_AUTH_URL=https://affiliates.example.com
ADMIN_EMAIL=admin@example.com
BETTER_AUTH_SECRET=
ENCRYPTION_KEY=
REF_COOKIE_SECRET=
CRON_SECRET=
STORAGE_DIR=/data/storage
PAGARME_DRIVER=real
PAGARME_SECRET_KEY=sk_live_ou_sk_test
NEXT_PUBLIC_PAGARME_PUBLIC_KEY=pk_live_ou_pk_test
PAGARME_WEBHOOK_USER=affiliate
PAGARME_WEBHOOK_PASSWORD=
MAIL_DRIVER=resend
MAIL_FROM=Affiliate Tool <noreply@mail.example.com>
RESEND_API_KEY=
BUILD_SHA=20260911
```

Regras:

- `BETTER_AUTH_URL` = `APP_URL` (mesmo HTTPS, sem barra no final).
- Sem Pagar.me ainda: `PAGARME_DRIVER=fake` e deixe as chaves `sk_`/`pk_` de teste ou vazias.
- Sem Resend ainda: `MAIL_DRIVER=log` (e-mail só nos logs do container).
- **Não** coloque `SKIP_ENV_VALIDATION` em runtime (só o Docker usa no build).
- **Não** rode seed de exemplo em produção.

---

## 6. Volume de arquivos (obrigatório)

Serviço `web` → **Mounts** / **Volumes**:

| Volume | Destino no container |
| --- | --- |
| `affiliate-storage` | `/data/storage` |

Sem isso, capas, PDFs, materiais e comprovantes somem no próximo deploy.

---

## 7. Domínio e HTTPS

1. Serviço `web` → **Domains** → adicione `affiliates.example.com`.
2. Porta do serviço: **3000**.
3. HTTPS (Let's Encrypt) ligado.
4. **Compress** ligado.

No DNS do domínio (provedor do operador):

| Tipo | Nome | Valor |
| --- | --- | --- |
| A | `afiliados` | IP público da VPS |

Se usar Cloudflare: comece em **DNS only** (cinza). Só ative o proxy depois do certificado emitir. Com proxy laranja, o IP real do comprador vem em `CF-Connecting-IP` — o app ainda não lê esse header; deixe cinza no go-live.

Espere o DNS propagar e o certificado ficar verde no EasyPanel.

---

## 8. Recursos do app

Serviço `web` → **Resources**:

- Memória: **512 MB**
- CPU: **1**

O `NODE_OPTIONS=--max-old-space-size=384` já está na imagem. O build usa pico extra na VPS (~2 GB) e não fica limitado a esses 512 MB.

---

## 9. Deploy

1. **Deploy** / **Save & Redeploy**.
2. Logs do `web`. Ordem esperada:

```text
Aplicando migrations...
Iniciando servidor na porta 3000...
```

3. Se a migration falhar, o container morre e a versão anterior permanece — corrija a `DATABASE_URL` e redesdobre.

Build da primeira vez: alguns minutos (pnpm install + `next build` na VPS).

---

## 10. Conferir saúde

No navegador:

```text
https://affiliates.example.com/api/health
```

Resposta esperada:

```json
{ "ok": true, "db": true, "version": "20260911" }
```

`ok: true` e `db: true`. `version` = o `BUILD_SHA` que você definiu.  
`/` deve abrir a vitrine; `/entrar` o login. Rotas `/dev/*` respondem 404.

---

## 11. Criar o admin (uma vez)

A imagem de produção é enxuta e **não traz** o script. Rode na sua máquina, apontando para o banco da VPS.

1. No EasyPanel, serviço `db` → libere a porta **só enquanto cria o admin** (ex.: `5432` → um porto alto, ou “Enable remote access”).
2. Na pasta do projeto, com `.env` local **ou** variáveis na hora:

```bash
DATABASE_URL="postgresql://USUARIO:SENHA@IP_DA_VPS:PORTA/DATABASE?schema=public" \
ADMIN_EMAIL="admin@example.com" \
SEED_ADMIN_PASSWORD="senha-com-no-minimo-14-chars" \
pnpm admin:create
```

3. Feche a porta pública do Postgres de novo.
4. Entre em `https://affiliates.example.com/entrar` e troque a senha em `/painel/perfil`.

Não rode `pnpm db:seed` na VPS — cria afiliados e produtos de teste.

---

## 12. E-mail (Resend)

1. Painel Resend → verificar o domínio `mail.example.com`.
2. DNS (TXT SPF, CNAME/TXT DKIM, TXT DMARC) exatamente como o Resend mostrar.
3. EasyPanel → `MAIL_DRIVER=resend`, `RESEND_API_KEY`, `MAIL_FROM`.
4. Redeploy (env, não precisa rebuild).
5. Cadastre um afiliado de teste e confira a caixa de entrada.

Fallback se a cota estourar: `MAIL_DRIVER=smtp` + SMTP autenticado, redeploy.

---

## 13. Pagar.me (produção)

1. Dashboard da conta Pagar.me → copiar `sk_live_` e `pk_live_`.
2. EasyPanel:
   - runtime: `PAGARME_DRIVER=real`, `PAGARME_SECRET_KEY`, `PAGARME_WEBHOOK_USER`, `PAGARME_WEBHOOK_PASSWORD`
   - **Build Argument** `NEXT_PUBLIC_PAGARME_PUBLIC_KEY` = a `pk_` (rebuild)
3. Webhooks no dashboard Pagar.me:

   - URL: `https://affiliates.example.com/api/webhooks/pagarme`
   - Auth: **Basic** (`PAGARME_WEBHOOK_USER` / `PAGARME_WEBHOOK_PASSWORD`)
   - Eventos: `order.paid`, `order.payment_failed`, `order.canceled`, `charge.paid`, `charge.payment_failed`, `charge.refunded`, `charge.chargedback`, `charge.pending`

4. Pedido Pix de **R$ 1,00** → pago → `/admin/sistema` (webhook `PROCESSED`) → estornar no dashboard → comissão `REVERSED`. Remova o produto de teste.

---

## 14. Crons (n8n na mesma VPS)

Workflow **Affiliate Tool Crons**. Cada item: Schedule Trigger → HTTP Request.

URL **pública** (pelo Traefik, não pela rede Docker interna):

| Job | Método | Intervalo | URL |
| --- | --- | --- | --- |
| Liberar comissões | POST | 24 h | `https://affiliates.example.com/api/cron/release-commissions` |
| Reconciliar pedidos | POST | 15 min | `https://affiliates.example.com/api/cron/reconcile-orders` |
| Anonimizar removidos | POST | 24 h | `https://affiliates.example.com/api/cron/anonymize-removed` |
| Reenviar e-mails | POST | 10 min | `https://affiliates.example.com/api/cron/retry-emails` |
| Limpar cliques | POST | 24 h | `https://affiliates.example.com/api/cron/purge-clicks` |

Header em todos:

```text
Authorization: Bearer <CRON_SECRET>
```

Erro HTTP → e-mail/WhatsApp para você. `/admin/sistema` mostra job atrasado.

---

## 15. Backup na VPS + monitor

**Postgres:** EasyPanel → serviço `db` → **Backups** → diário 02:00, retenção 14 dias (S3 ou R2).

**Arquivos:** incluir o volume `affiliate-storage` num tar semanal no mesmo destino.

**Restore (teste em serviço temporário, não em produção):**

1. Subir um Postgres `db-restore`.
2. `pg_restore` do dump.
3. `SELECT count(*) FROM "Order";` tem de bater com o dump.
4. Derrubar `db-restore`.

**Uptime:** UptimeRobot / Better Stack, a cada 5 min, em  
`https://affiliates.example.com/api/health` → alerta no seu e-mail/WhatsApp.

---

## 16. Como atualizar depois

- **Git + Deploy on push:** push em `main` → o EasyPanel constrói sozinho. Confira logs: migrations → Ready → `/api/health`.
- **ZIP:** gere um zip novo da mesma forma (Dockerfile na raiz, sem `.env`) e faça Upload + Deploy.
- **Rollback:** `web` → **Deployments** → Redeploy da imagem anterior. Migrations só andam para frente; se uma migration for destrutiva, restaure o backup do banco.

---

## Problemas comuns

| Sintoma | Causa típica | O que fazer |
| --- | --- | --- |
| Build ok, site aponta para localhost | Faltou Build Arg `APP_URL` / `NEXT_PUBLIC_*` | Preencher e **Rebuild** |
| `/api/health` com `db: false` | `DATABASE_URL` errada (host, senha, `schema`) | Usar URL interna do serviço `db` |
| Container reinicia em loop | Migration falhou | Logs: “Aplicando migrations…”; conferir URL e se o `db` está *Running* |
| Upload some após deploy | Volume não montado | Mount `affiliate-storage` → `/data/storage` |
| Login não grava sessão | `BETTER_AUTH_URL` ≠ URL pública | Igualar a `APP_URL` com HTTPS |
| Cartão/Pix não tokeniza | `pk_` velha no bundle | Atualizar Build Arg e **Rebuild** |
| Webhook 401 | Basic Auth diferente do dashboard | Conferir user/senha no EasyPanel e no Pagar.me |
| Certificado não emite | DNS ainda não aponta, ou Cloudflare laranja | A record no IP da VPS, DNS only |

---

## Checklist de go-live

- [ ] `/api/health` → `{ ok: true, db: true, version }`
- [ ] DNS `afiliados` A → VPS; cadeado HTTPS
- [ ] Volume `/data/storage` montado
- [ ] Admin criado; cliente trocou a senha
- [ ] Resend + SPF/DKIM/DMARC em `mail.example.com`
- [ ] Pagar.me produção + webhook Basic Auth
- [ ] Pix R$ 1,00 pago + estorno conferido; produto de teste removido
- [ ] 5 crons no n8n
- [ ] Backup diário do Postgres + restore testado
- [ ] Monitor de `/api/health` a cada 5 min
- [ ] Termos oficiais em `/admin/configuracoes`

Operação do dia a dia (rollback, rotacionar `ENCRYPTION_KEY`, reprocessar webhook): `docs/RUNBOOK.md`.
