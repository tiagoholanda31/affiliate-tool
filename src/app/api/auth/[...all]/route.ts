/**
 * Endpoints do Better Auth (`/api/auth/*`).
 *
 * Quem consome diretamente é o `auth-client` do browser (sair da conta, ler
 * sessão) e o link de confirmação de e-mail. O cadastro e o login passam por
 * Server Actions, que acrescentam rate limit por conta, auditoria e as regras
 * de status do afiliado — coisas que a API genérica não conhece.
 *
 * O rate limit por IP destas rotas está configurado no próprio Better Auth
 * (`rateLimit.customRules` em `src/lib/auth.ts`), que responde 429 com
 * `Retry-After` antes de tocar no banco.
 */
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth.handler);
