"use server";

/**
 * Server Actions do afiliado.
 *
 * Camada fina, como manda o CLAUDE.md: valida (nos schemas), autoriza (nos
 * wrappers de `safe-action`), chama o que precisa e devolve. As regras de
 * domínio ficam em `service.ts`; o que sobra aqui é orquestração e persistência.
 *
 * Duas regras atravessam este arquivo:
 * - a chave Pix **nunca** é gravada em claro (AES-256-GCM + versão mascarada);
 * - trocar a chave Pix exige a senha atual e avisa o afiliado por e-mail, porque
 *   é o campo que decide para onde o dinheiro sai (docs/spec/04).
 */
import { revalidatePath } from "next/cache";

import {
  changePasswordSchema,
  changePixKeySchema,
  registerAffiliateSchema,
  resubmitAffiliateSchema,
  updateProfileSchema,
  type PixKeyTypeValue,
} from "@/features/affiliates/schemas";
import { auth, notifyAdminOfPendingAffiliate } from "@/lib/auth";
import { encrypt, maskPixKey } from "@/lib/crypto";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { AUTH_MESSAGES, labelFor } from "@/lib/i18n/pt-BR";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { authedAction, publicAction } from "@/lib/safe-action";
import { getSettings, getSupportWhatsapp } from "@/lib/settings";

/** Tempo mínimo de preenchimento do cadastro (docs/spec/04, Anti-bot). */
const MIN_FILL_MS = 3_000;

/** Par (cifrado, mascarado) pronto para gravar. */
function encryptPixKey(type: PixKeyTypeValue, key: string) {
  return { pixKeyEncrypted: encrypt(key), pixKeyMasked: maskPixKey(key, type) };
}

/**
 * Cadastro do afiliado — os dois passos do formulário num envio só.
 *
 * Cria o `User` pelo próprio Better Auth (para a senha ser hasheada com o mesmo
 * algoritmo do login) e o `Affiliate` logo em seguida. Se o segundo falhar, o
 * primeiro é desfeito: conta sem cadastro deixaria a pessoa presa numa tela que
 * não existe.
 */
export const registerAffiliate = publicAction({
  name: "affiliate.register",
  schema: registerAffiliateSchema,
  async handler(input, { ip, headers }) {
    if (!consume("signup", ip).ok) {
      throw new AppError("RATE_LIMITED", "Muitas tentativas de cadastro. Tente mais tarde.");
    }

    // Anti-bot: honeypot preenchido ou formulário enviado rápido demais.
    // O schema já rejeita `website` não vazio; aqui sobra o tempo.
    if (Date.now() - input.startedAt < MIN_FILL_MS) {
      logger.warn({ ip }, "Cadastro descartado pelo tempo mínimo de preenchimento");
      throw new AppError("VALIDATION", "Confira os dados e tente novamente.");
    }

    const existing = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    // Anti-enumeração: a mesma resposta de um cadastro novo (docs/spec/04).
    // Quem já tem conta recebe o link de confirmação ou entra normalmente; quem
    // está sondando e-mails não descobre nada.
    if (existing) {
      logger.info({ ip }, "Cadastro com e-mail já existente — resposta neutra");
      return { email: input.email };
    }

    const settings = await getSettings();

    const signUp = await auth.api.signUpEmail({
      // `callbackURL` é para onde o link do e-mail leva depois de confirmar —
      // e, se o token falhar, para onde vai com `?error=…`.
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        callbackURL: "/verificar-email?status=ok",
      },
      headers,
    });

    try {
      await db.affiliate.create({
        data: {
          userId: signUp.user.id,
          phone: input.phone,
          socialNetwork: input.socialNetwork,
          socialHandle: input.socialHandle,
          pixKeyType: input.pixKeyType,
          ...encryptPixKey(input.pixKeyType, input.pixKey),
          termsVersion: settings.termsVersion,
          termsAcceptedAt: new Date(),
          termsIp: ip,
        },
      });
    } catch (error) {
      await db.user.delete({ where: { id: signUp.user.id } }).catch(() => undefined);
      throw new AppError("INTERNAL", "Não foi possível concluir o cadastro.", { cause: error });
    }

    return { email: input.email };
  },
});

/**
 * Reenvio do cadastro após reprovação (docs/spec/01, seção 1).
 * Volta o afiliado para `PENDING`, incrementa `reviewCount` e reavisa o admin.
 */
export const resubmitAffiliate = authedAction({
  name: "affiliate.resubmit",
  schema: resubmitAffiliateSchema,
  async handler(input, { session }) {
    const affiliate = await db.affiliate.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true, reviewCount: true },
    });

    if (!affiliate) throw new AppError("NOT_FOUND", "Cadastro não encontrado.");
    if (affiliate.status !== "REJECTED") {
      throw new AppError("INVALID_TRANSITION", "Seu cadastro não está reprovado.");
    }

    // A chave já veio validada e normalizada pelo schema.
    await db.$transaction([
      db.user.update({ where: { id: session.user.id }, data: { name: input.name } }),
      db.affiliate.update({
        where: { id: affiliate.id },
        data: {
          phone: input.phone,
          socialNetwork: input.socialNetwork,
          socialHandle: input.socialHandle,
          pixKeyType: input.pixKeyType,
          ...encryptPixKey(input.pixKeyType, input.pixKey),
          status: "PENDING",
          statusReason: null,
          statusChangedAt: new Date(),
          reviewCount: { increment: 1 },
        },
      }),
    ]);

    await notifyAdminOfPendingAffiliate(session.user.id, session.user.email, input.name);

    revalidatePath("/painel", "layout");
    return { status: "PENDING" as const };
  },
  audit: (_result, _input, { session }) => ({
    action: "affiliate.resubmit",
    entity: "Affiliate",
    entityId: session.user.id,
    after: { status: "PENDING" },
  }),
});

/** Dados do perfil que o afiliado muda sozinho — nada aqui envolve dinheiro. */
export const updateProfile = authedAction({
  name: "affiliate.updateProfile",
  schema: updateProfileSchema,
  async handler(input, { session }) {
    const affiliate = await db.affiliate.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!affiliate) throw new AppError("NOT_FOUND", "Cadastro não encontrado.");

    await db.$transaction([
      db.user.update({ where: { id: session.user.id }, data: { name: input.name } }),
      db.affiliate.update({
        where: { id: affiliate.id },
        data: {
          phone: input.phone,
          socialNetwork: input.socialNetwork,
          socialHandle: input.socialHandle,
        },
      }),
    ]);

    revalidatePath("/painel/perfil");
    return { name: input.name };
  },
});

/**
 * Troca da chave Pix.
 *
 * Exige a senha atual e dispara `pix-key-changed`. As duas coisas existem pelo
 * mesmo motivo: quem tomar a sessão de um afiliado só precisaria trocar este
 * campo para desviar todas as comissões futuras. A senha barra o sequestro de
 * sessão; o e-mail garante que o afiliado saiba na mesma hora se acontecer.
 */
export const changePixKey = authedAction({
  name: "affiliate.changePixKey",
  schema: changePixKeySchema,
  async handler(input, { session, headers }) {
    const affiliate = await db.affiliate.findUnique({
      where: { userId: session.user.id },
      select: { id: true, pixKeyMasked: true, pixKeyType: true },
    });
    if (!affiliate) throw new AppError("NOT_FOUND", "Cadastro não encontrado.");

    // `verifyPassword` lança quando a senha não confere — não devolve `false`.
    try {
      await auth.api.verifyPassword({ body: { password: input.currentPassword }, headers });
    } catch {
      throw new AppError("FORBIDDEN", AUTH_MESSAGES.wrongPassword);
    }

    const encrypted = encryptPixKey(input.pixKeyType, input.pixKey);
    await db.affiliate.update({
      where: { id: affiliate.id },
      data: { pixKeyType: input.pixKeyType, ...encrypted },
    });

    const changedAt = new Date();
    await sendMail({
      to: session.user.email,
      template: "pix-key-changed",
      props: {
        name: session.user.name,
        pixKeyTypeLabel: labelFor("pixKeyType", input.pixKeyType),
        pixKeyMasked: encrypted.pixKeyMasked,
        changedAt: formatDateTime(changedAt),
        profileUrl: `${APP_URL}/painel/perfil`,
        supportWhatsapp: await getSupportWhatsapp(),
      },
    });

    revalidatePath("/painel/perfil");
    return {
      affiliateId: affiliate.id,
      pixKeyMasked: encrypted.pixKeyMasked,
      previousMasked: affiliate.pixKeyMasked,
      previousType: affiliate.pixKeyType,
      pixKeyType: input.pixKeyType,
    };
  },
  // Mudança de destino do dinheiro: entra na trilha, sempre — e só a versão
  // mascarada, para a auditoria não virar um depósito de chaves Pix.
  audit: (result) => ({
    action: "affiliate.pix_change",
    entity: "Affiliate",
    entityId: result.affiliateId,
    before: { pixKeyType: result.previousType, pixKeyMasked: result.previousMasked },
    after: { pixKeyType: result.pixKeyType, pixKeyMasked: result.pixKeyMasked },
  }),
});

/** Troca de senha. Revoga as outras sessões — a sessão atual continua válida. */
export const changePassword = authedAction({
  name: "affiliate.changePassword",
  schema: changePasswordSchema,
  async handler(input, { headers }) {
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          revokeOtherSessions: true,
        },
        headers,
      });
    } catch (error) {
      logger.warn({ err: error }, "Troca de senha recusada");
      throw new AppError("FORBIDDEN", AUTH_MESSAGES.wrongPassword);
    }

    return { message: "Senha alterada. As outras sessões foram encerradas." };
  },
});
