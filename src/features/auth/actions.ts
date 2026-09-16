"use server";

/**
 * Server Actions de autenticação: entrar, sair, recuperar e redefinir senha,
 * reenviar confirmação.
 *
 * Todas passam pelo `publicAction` (não há sessão ainda) e carregam, elas
 * mesmas, o que a API genérica do Better Auth não faz:
 *
 * - **rate limit em duas dimensões**: por IP (abuso distribuído) e por conta
 *   (força bruta contra um e-mail específico);
 * - **anti-enumeração**: as respostas de recuperação de senha e de reenvio são
 *   iguais exista ou não a conta (docs/spec/04);
 * - **auditoria + alerta** no login de admin.
 */
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import {
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
} from "@/features/affiliates/schemas";
import { recordAudit } from "@/lib/audit";
import { auth, RESET_TOKEN_MINUTES, toRole } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { AUTH_MESSAGES } from "@/lib/i18n/pt-BR";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { consume, reset as resetRateLimit } from "@/lib/rate-limit";
import { publicAction } from "@/lib/safe-action";
import { getSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/dates";

/** Chave do balde por conta: o e-mail não deve aparecer em claro na memória. */
function accountKey(email: string): string {
  return sha256(email.toLowerCase());
}

/** Erro do Better Auth que não deve virar mensagem genérica. */
function isEmailNotVerified(error: unknown): boolean {
  return (
    error instanceof Error &&
    /verif/i.test(error.message) &&
    /email/i.test(error.message)
  );
}

/**
 * Entrar.
 *
 * Devolve `redirectTo` em vez de redirecionar aqui dentro: o `redirect()` do
 * Next lança, e uma exceção de controle de fluxo atravessando o `try/catch` do
 * wrapper viraria "algo deu errado". Quem navega é o formulário.
 */
export const signIn = publicAction({
  name: "auth.signIn",
  schema: signInSchema,
  async handler({ email, password, next }, { ip, headers }) {
    const byIp = consume("login", ip);
    if (!byIp.ok) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.accountLocked);

    const byAccount = consume("loginAttempt", accountKey(email), Date.now());
    if (!byAccount.ok) throw new AppError("RATE_LIMITED", AUTH_MESSAGES.accountLocked);

    let user: { id: string; email: string; role?: unknown };
    try {
      // O retorno já traz o usuário — reler a sessão aqui falharia, porque o
      // cookie novo só existe na resposta, não nos headers desta requisição.
      ({ user } = await auth.api.signInEmail({ body: { email, password }, headers }));
    } catch (error) {
      if (isEmailNotVerified(error)) {
        // O Better Auth já reenviou o link (`emailVerification.sendOnSignIn`).
        throw new AppError("FORBIDDEN", AUTH_MESSAGES.emailNotVerified);
      }
      logger.warn({ ip, remaining: byAccount.remaining }, "Tentativa de login falhou");
      throw new AppError("UNAUTHENTICATED", AUTH_MESSAGES.invalidCredentials);
    }

    // Só zera o contador quem realmente entrou.
    resetRateLimit("loginAttempt", accountKey(email));
    resetRateLimit("login", ip);

    if (toRole(user.role) === "ADMIN") {
      await auditAdminLogin(user.id, user.email, ip, headers);
      return { redirectTo: "/admin" };
    }

    return { redirectTo: safeNext(next) ?? "/painel" };
  },
});

/** Só caminhos internos: `next=https://…` seria um open redirect. */
function safeNext(next: string | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

/**
 * Login de admin: trilha de auditoria + e-mail de aviso com IP e navegador
 * (docs/spec/04, Autenticação). É o alarme de takeover da conta mais valiosa.
 */
async function auditAdminLogin(
  userId: string,
  email: string,
  ip: string,
  headers: Headers,
): Promise<void> {
  const userAgent = headers.get("user-agent") ?? "desconhecido";

  await recordAudit({
    actorId: userId,
    actorRole: "ADMIN",
    action: "auth.admin_login",
    entity: "User",
    entityId: userId,
    after: { userAgent },
    ip,
  });

  const settings = await getSettings();
  await sendMail({
    to: settings.adminNotifyEmail,
    template: "admin-alert",
    props: {
      title: "Novo login de administrador",
      message: "Um acesso administrativo acabou de ser feito na plataforma.",
      details: [
        { label: "Conta", value: email },
        { label: "IP", value: ip },
        { label: "Navegador", value: userAgent },
        { label: "Quando", value: formatDateTime(new Date()) },
      ],
      actionUrl: `${APP_URL}/admin/sistema`,
      actionLabel: "Ver auditoria",
    },
  });
}

/** Sair. Encerra a sessão no banco e apaga o cookie, depois volta para `/entrar`. */
export async function signOutAction(): Promise<void> {
  await auth.api.signOut({ headers: await nextHeaders() });
  redirect("/entrar");
}

/**
 * Pedir link de redefinição.
 *
 * Responde a mesma coisa exista ou não a conta. Sem isso, o formulário viraria
 * um oráculo para descobrir quais e-mails estão cadastrados.
 */
export const requestPasswordReset = publicAction({
  name: "auth.requestPasswordReset",
  schema: requestPasswordResetSchema,
  async handler({ email }, { ip, headers }) {
    if (!consume("passwordReset", ip).ok) {
      throw new AppError("RATE_LIMITED", AUTH_MESSAGES.accountLocked);
    }
    consume("passwordReset", accountKey(email));

    try {
      await auth.api.requestPasswordReset({
        body: { email, redirectTo: `${APP_URL}/redefinir-senha` },
        headers,
      });
    } catch (error) {
      // Nem o erro pode vazar: só registramos e devolvemos a mesma mensagem.
      logger.warn({ ip, err: error }, "Falha ao pedir redefinição de senha");
    }

    return { message: AUTH_MESSAGES.resetRequested, expiresInMinutes: RESET_TOKEN_MINUTES };
  },
});

/** Definir a nova senha a partir do token do e-mail. */
export const resetPassword = publicAction({
  name: "auth.resetPassword",
  schema: resetPasswordSchema,
  async handler({ token, newPassword }, { ip, headers }) {
    if (!consume("passwordReset", ip).ok) {
      throw new AppError("RATE_LIMITED", AUTH_MESSAGES.accountLocked);
    }

    try {
      // `revokeSessionsOnPasswordReset` derruba as demais sessões.
      await auth.api.resetPassword({ body: { token, newPassword }, headers });
    } catch (error) {
      logger.warn({ ip, err: error }, "Token de redefinição inválido");
      throw new AppError("VALIDATION", AUTH_MESSAGES.linkExpired);
    }

    return { message: "Senha alterada. Entre com a nova senha." };
  },
});

/** Reenviar a confirmação de e-mail — resposta idêntica exista ou não a conta. */
export const resendVerification = publicAction({
  name: "auth.resendVerification",
  schema: resendVerificationSchema,
  async handler({ email }, { ip, headers }) {
    if (!consume("signup", ip).ok) {
      throw new AppError("RATE_LIMITED", AUTH_MESSAGES.accountLocked);
    }

    const user = await db.user.findUnique({
      where: { email },
      select: { emailVerified: true },
    });

    if (user && !user.emailVerified) {
      try {
        await auth.api.sendVerificationEmail({
          body: { email, callbackURL: "/verificar-email?status=ok" },
          headers,
        });
      } catch (error) {
        logger.warn({ ip, err: error }, "Falha ao reenviar confirmação de e-mail");
      }
    }

    return { message: AUTH_MESSAGES.checkYourEmail };
  },
});
