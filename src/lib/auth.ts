/**
 * Better Auth: instância do servidor e os helpers que as camadas de cima usam.
 *
 * Decisões desta configuração (docs/spec/04):
 * - e-mail e senha, sem provedor social; senha com no mínimo 10 caracteres;
 * - `requireEmailVerification` — cadastro sem e-mail confirmado não vira sessão;
 * - sessão em banco, cookie `HttpOnly Secure SameSite=Lax`, 7 dias com renovação
 *   deslizante a cada 24 h;
 * - `role` como campo extra do `User`, definido no cadastro e imutável pelo
 *   próprio usuário (`input: false`): ninguém vira admin por um POST na API.
 *
 * O plugin `nextCookies()` precisa ser o **último** da lista: é ele que grava os
 * cookies via `next/headers` quando um endpoint é chamado de dentro de uma
 * Server Action, e para isso tem que rodar depois de todos os outros.
 */
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import type { AffiliateStatus, Role } from "@/generated/prisma/enums";
import { resolveAffiliateAccess } from "@/features/affiliates/service";
import { maskEmail } from "@/lib/crypto";
import { db } from "@/lib/db";
import { APP_URL, env, isDevelopment, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { getSupportWhatsapp } from "@/lib/settings";

const DAY_SECONDS = 60 * 60 * 24;

/** Validade dos links enviados por e-mail (docs/spec/04, Autenticação). */
export const VERIFICATION_TOKEN_HOURS = 24;
export const RESET_TOKEN_MINUTES = 15;

export const auth = betterAuth({
  appName: "Affiliate Tool",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL || APP_URL,
  trustedOrigins: [APP_URL],

  database: prismaAdapter(db, { provider: "postgresql", transaction: true }),

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "AFFILIATE",
        // Nunca aceito do corpo da requisição: quem define papel é o servidor.
        input: false,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    // Sem sessão automática no cadastro: a confirmação de e-mail vem antes.
    autoSignIn: false,
    resetPasswordTokenExpiresIn: RESET_TOKEN_MINUTES * 60,
    // Trocar a senha derruba as outras sessões — é a reação esperada de quem
    // troca a senha justamente por desconfiar de um acesso alheio.
    revokeSessionsOnPasswordReset: true,

    async sendResetPassword({ user, url }) {
      await sendMail({
        to: user.email,
        template: "reset-password",
        props: {
          name: user.name,
          url,
          expiresInMinutes: RESET_TOKEN_MINUTES,
          supportWhatsapp: await getSupportWhatsapp(),
        },
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    expiresIn: VERIFICATION_TOKEN_HOURS * 60 * 60,

    async sendVerificationEmail({ user, url }) {
      // Toda confirmação termina na tela de status, qualquer que seja o gatilho
      // do envio. Sem isto, o link reenviado pelo login (`sendOnSignIn`) vinha
      // com `callbackURL=/` — o padrão do Better Auth — e a pessoa confirmava
      // o e-mail e caía na vitrine, sem saber que o cadastro foi para análise.
      const target = new URL(url);
      target.searchParams.set("callbackURL", "/verificar-email?status=ok");

      await sendMail({
        to: user.email,
        template: "verify-email",
        props: {
          name: user.name,
          url: target.toString(),
          expiresInHours: VERIFICATION_TOKEN_HOURS,
          supportWhatsapp: await getSupportWhatsapp(),
        },
      });
    },

    /**
     * O admin é avisado só depois da confirmação do e-mail: cadastro com e-mail
     * inválido não deve gerar trabalho de análise (docs/spec/01, seção 1).
     */
    async afterEmailVerification(user) {
      await notifyAdminOfPendingAffiliate(user.id, user.email, user.name);
    },
  },

  session: {
    expiresIn: 7 * DAY_SECONDS,
    updateAge: DAY_SECONDS,
  },

  advanced: {
    // Atrás do Traefik do EasyPanel; em dev não há proxy e o header não existe.
    ipAddress: { ipAddressHeaders: ["x-forwarded-for", "x-real-ip"] },
    useSecureCookies: isProduction,
  },

  /**
   * Limite do próprio Better Auth sobre `/api/auth/*` (docs/spec/04: 10/15 min
   * por IP nas rotas sensíveis). O `src/lib/rate-limit.ts` continua valendo para
   * as Server Actions, que não passam por aqui. Desligado em desenvolvimento
   * para não travar runs repetidos de e2e contra o mesmo dev server.
   */
  rateLimit: {
    enabled: !isDevelopment,
    storage: "memory",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 15 * 60, max: 10 },
      "/sign-up/email": { window: 60 * 60, max: 5 },
      "/request-password-reset": { window: 60 * 60, max: 5 },
      "/send-verification-email": { window: 60 * 60, max: 5 },
    },
  },

  plugins: [nextCookies()],
});

/** Sessão + usuário como o resto do app usa. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
};

export type AppSession = {
  user: SessionUser;
  sessionId: string;
};

/** `role` chega como string do Better Auth; aqui vira o enum do Prisma. */
export function toRole(value: unknown): Role {
  return value === "ADMIN" ? "ADMIN" : "AFFILIATE";
}

/**
 * Sessão atual, ou `null`. Não redireciona — quem decide o que fazer sem sessão
 * é quem chamou (a home pública, por exemplo, não redireciona ninguém).
 */
export async function getSession(): Promise<AppSession | null> {
  const result = await auth.api.getSession({ headers: await nextHeaders() });
  if (!result) return null;

  return {
    sessionId: result.session.id,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      emailVerified: result.user.emailVerified,
      role: toRole((result.user as { role?: unknown }).role),
    },
  };
}

/** Monta `/entrar?next=…` preservando para onde a pessoa queria ir. */
function signInUrl(next?: string): string {
  if (!next?.startsWith("/")) return "/entrar";
  return `/entrar?next=${encodeURIComponent(next)}`;
}

/**
 * Exige sessão. Sem ela, manda para `/entrar` guardando o destino.
 * Retorna sempre — o `redirect` interrompe o render lançando.
 */
export async function requireSession(next?: string): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect(signInUrl(next));
  return session;
}

/**
 * Exige um admin. Afiliado que tenta `/admin` volta para o próprio painel: não
 * dizemos "sem permissão", só devolvemos a pessoa ao lugar dela.
 */
export async function requireAdmin(next?: string): Promise<AppSession> {
  const session = await requireSession(next);
  if (session.user.role !== "ADMIN") redirect("/painel");
  return session;
}

export type AffiliateSession = AppSession & {
  affiliate: {
    id: string;
    status: AffiliateStatus;
    statusReason: string | null;
    code: string | null;
    reviewCount: number;
  };
};

/**
 * Exige um afiliado e aplica as regras de status sobre `pathname`
 * (docs/spec/01, seção 1). A matriz status → rota vive em
 * `features/affiliates/service.ts`, testada isoladamente.
 *
 * Chamado no layout **e** valendo por render: nenhuma navegação do client
 * contorna a regra, porque quem responde à navegação é o servidor.
 */
export async function requireAffiliate(pathname: string): Promise<AffiliateSession> {
  const session = await requireSession(pathname);

  // Admin não tem painel de afiliado — nem tem `Affiliate` no banco.
  if (session.user.role === "ADMIN") redirect("/admin");

  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, status: true, statusReason: true, code: true, reviewCount: true },
  });

  if (!affiliate) {
    // Usuário AFFILIATE sem cadastro: só acontece se algo falhou entre criar o
    // User e criar o Affiliate. Registra e devolve ao cadastro em vez de dar 500.
    logger.error({ userId: session.user.id }, "Usuário afiliado sem registro de Affiliate");
    redirect("/cadastro?erro=cadastro-incompleto");
  }

  const access = resolveAffiliateAccess(affiliate.status, pathname);
  if (!access.allowed) {
    if (access.signOut) {
      await auth.api.signOut({ headers: await nextHeaders() });
    }
    redirect(access.redirectTo);
  }

  return { ...session, affiliate };
}

/**
 * Avisa o admin de que há um cadastro esperando análise.
 *
 * Exportado porque dois caminhos chegam aqui: a confirmação de e-mail (acima) e
 * o reenvio de um cadastro reprovado (`features/affiliates/actions.ts`).
 */
export async function notifyAdminOfPendingAffiliate(
  userId: string,
  email: string,
  name: string,
): Promise<void> {
  const affiliate = await db.affiliate.findUnique({
    where: { userId },
    select: { socialNetwork: true, socialHandle: true, reviewCount: true, status: true },
  });

  if (affiliate?.status !== "PENDING") return;

  const settings = await db.setting.findUnique({
    where: { id: 1 },
    select: { adminNotifyEmail: true },
  });

  await sendMail({
    to: settings?.adminNotifyEmail ?? env.ADMIN_EMAIL,
    template: "affiliate-pending-admin",
    props: {
      affiliateName: name,
      affiliateEmailMasked: maskEmail(email),
      socialNetwork: affiliate.socialNetwork,
      socialHandle: affiliate.socialHandle,
      reviewUrl: `${APP_URL}/admin/afiliados`,
      reviewCount: affiliate.reviewCount,
    },
  });
}
