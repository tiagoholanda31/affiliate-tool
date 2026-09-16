/**
 * Regras de domínio da gestão de afiliados pelo admin.
 *
 * Toda transição de status, geração de código, revelação de Pix e anonimização
 * vive aqui para ser testada sem Next, sem banco real e sem UI. As Server
 * Actions (`admin-actions.ts`) são camadas finas que orquestram este serviço,
 * gravação de audit e envio de e-mail.
 */
import type { AffiliateStatus, Prisma } from "@/generated/prisma/client";
import type { AffiliateStatus as AffiliateStatusEnum } from "@/generated/prisma/enums";
import { canTransition } from "@/features/affiliates/service";
import { decrypt, sha256 } from "@/lib/crypto";
import { APP_URL } from "@/lib/env";
import { AppError } from "@/lib/errors";

/** Caracteres permitidos no código auto-gerado: sem vogais ambíguas. */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE_LENGTH = 7;

const MAX_CODE_RETRIES = 10;

export type TransitionEmailEvent = {
  template:
    | "affiliate-approved"
    | "affiliate-rejected"
    | "affiliate-suspended"
    | "affiliate-reactivated"
    | "affiliate-removed";
  to: string;
  props: {
    name: string;
    code?: string;
    firstLink?: string;
    reason?: string;
    supportWhatsapp?: string;
  };
};

export type AffiliateTransitionResult = {
  affiliateId: string;
  userId: string;
  previousStatus: AffiliateStatus;
  newStatus: AffiliateStatus;
  code: string | null;
  reason: string | null;
  emailEvent: TransitionEmailEvent;
};

/** Gera um código curto e legível, evitando caracteres ambíguos. */
export function generateAffiliateCode(): string {
  let result = "";
  while (result.length < CODE_LENGTH) {
    const char = CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (char) result += char;
  }
  return result;
}

/** Verifica se o formato de código de vaidade é válido (4–20 chars, a-z, 0-9, -). */
export function isValidVanityCode(code: string): boolean {
  return /^[a-z0-9-]{4,20}$/.test(code);
}

/** Código sem ambíguos (mesmo alfabeto do auto-gerado, mas permite hífen). */
export function isSafeCodeCharacters(code: string): boolean {
  return Array.from(code).every((char) => char === "-" || CODE_ALPHABET.includes(char));
}

/**
 * Gera um código único, fazendo retry em caso de colisão.
 *
 * Testes podem passar um `prismaLike` que responde `findUnique` para simular
 * colisão. Em produção passamos `tx` (ou `db`) para a checagem de unicidade.
 */
export async function generateUniqueAffiliateCode(
  tx: Pick<Prisma.TransactionClient, "affiliate">,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
    const code = generateAffiliateCode();
    const existing = await tx.affiliate.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  throw new AppError("INTERNAL", "Não foi possível gerar um código de afiliado único.");
}

/** Remove todas as sessões ativas de um usuário. */
async function revokeUserSessions(userId: string, tx: Pick<Prisma.TransactionClient, "session">): Promise<void> {
  await tx.session.deleteMany({ where: { userId } });
}

/**
 * Transiciona o status de um afiliado, gerando código na primeira aprovação,
 * revogando sessões quando necessário e gravando auditoria.
 *
 * A transação é recebida por parâmetro: assim o chamador decide se a action
 * admin executa sozinha ou dentro de um bulk (toda ação ainda ganha seu próprio
 * audit e e-mail, mas o bulk pode controlar o envelope).
 */
export async function transitionAffiliate(
  affiliateId: string,
  to: AffiliateStatus,
  {
    reason,
    actorId,
  }: {
    /** Obrigatório para transições exceto aprovação. */
    reason?: string;
    actorId: string;
  },
  tx: Prisma.TransactionClient,
): Promise<AffiliateTransitionResult> {
  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    include: { user: true },
  });

  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  const from = affiliate.status;
  if (!canTransition(from, to)) {
    throw new AppError("INVALID_TRANSITION", `Não é possível mudar de ${from} para ${to}.`);
  }

  // Aprovação é a única transição que não exige motivo (fatia 02, tarefa 1).
  if (to !== "APPROVED" && (!reason || reason.trim().length < 10)) {
    throw new AppError("VALIDATION", "Informe um motivo com pelo menos 10 caracteres.");
  }

  const trimmedReason = to === "APPROVED" ? null : reason?.trim() ?? null;

  let code = affiliate.code;
  // Gera código na primeira aprovação (PENDING -> APPROVED). Reativação mantém.
  if (to === "APPROVED" && code === null) {
    code = await generateUniqueAffiliateCode(tx);
  }

  const previousStatus = from;
  const newStatus = to;

  const updated = await tx.affiliate.update({
    where: { id: affiliateId },
    data: {
      status: newStatus,
      statusReason: trimmedReason,
      statusChangedAt: new Date(),
      reviewedById: actorId,
      ...(code === affiliate.code ? {} : { code }),
    },
    include: { user: true },
  });

  await tx.auditLog.create({
    data: {
      actorId,
      actorRole: "ADMIN",
      action: `affiliate.${actionSuffixForTransition(newStatus)}`,
      entity: "Affiliate",
      entityId: affiliateId,
      before: { status: previousStatus, statusReason: affiliate.statusReason, code: affiliate.code },
      after: { status: newStatus, statusReason: trimmedReason, code },
    },
  });

  // Suspenso ou removido perde a sessão imediatamente.
  if (newStatus === "SUSPENDED" || newStatus === "REMOVED") {
    await revokeUserSessions(affiliate.userId, tx);
  }

  const emailEvent = buildStatusEmailEvent(updated.user, newStatus, {
    code,
    reason: trimmedReason ?? undefined,
  });

  return {
    affiliateId,
    userId: affiliate.userId,
    previousStatus,
    newStatus,
    code,
    reason: trimmedReason,
    emailEvent,
  };
}

function actionSuffixForTransition(status: AffiliateStatusEnum): string {
  switch (status) {
    case "APPROVED":
      return "approve";
    case "REJECTED":
      return "reject";
    case "SUSPENDED":
      return "suspend";
    case "REMOVED":
      return "remove";
    default:
      return status.toLowerCase();
  }
}

function buildStatusEmailEvent(
  user: { name: string; email: string },
  status: AffiliateStatusEnum,
  extras: { code?: string | null; reason?: string },
): TransitionEmailEvent {
  const baseProps = { name: user.name, reason: extras.reason };

  switch (status) {
    case "APPROVED":
      return {
        template: "affiliate-approved",
        to: user.email,
        props: {
          ...baseProps,
          code: extras.code ?? undefined,
          firstLink: extras.code ? `${APP_URL}/r/${extras.code}` : undefined,
        },
      };
    case "REJECTED":
      return {
        template: "affiliate-rejected",
        to: user.email,
        props: baseProps,
      };
    case "SUSPENDED":
      return {
        template: "affiliate-suspended",
        to: user.email,
        props: baseProps,
      };
    case "REMOVED":
      return {
        template: "affiliate-removed",
        to: user.email,
        props: baseProps,
      };
    default:
      throw new AppError("INTERNAL", `Status ${status} não dispara e-mail de transição.`);
  }
}

export type VanityCodeUpdateResult = {
  affiliateId: string;
  previousCode: string | null;
  newCode: string;
};

/**
 * Permite ao admin trocar o código do afiliado uma única vez (vaidade).
 *
 * Regras: min 4, max 20, [a-z0-9-], único, e só se `codeEditedAt` ainda for nulo.
 */
export async function updateAffiliateCode(
  affiliateId: string,
  newCode: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<VanityCodeUpdateResult> {
  if (!isValidVanityCode(newCode)) {
    throw new AppError(
      "VALIDATION",
      "Código inválido. Use de 4 a 20 caracteres entre letras minúsculas, números e hífen.",
    );
  }

  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    select: { code: true, codeEditedAt: true },
  });

  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  if (affiliate.codeEditedAt) {
    throw new AppError("CONFLICT", "O código de afiliado só pode ser alterado uma vez.");
  }

  const existing = await tx.affiliate.findUnique({
    where: { code: newCode },
    select: { id: true },
  });
  if (existing) {
    throw new AppError("CONFLICT", "Este código já está em uso.");
  }

  await tx.affiliate.update({
    where: { id: affiliateId },
    data: { code: newCode, codeEditedAt: new Date() },
  });

  await tx.auditLog.create({
    data: {
      actorId,
      actorRole: "ADMIN",
      action: "affiliate.code_change",
      entity: "Affiliate",
      entityId: affiliateId,
      before: { code: affiliate.code },
      after: { code: newCode },
    },
  });

  return { affiliateId, previousCode: affiliate.code, newCode };
}

export type PixRevealResult = {
  affiliateId: string;
  pixKey: string;
  pixKeyType: string;
};

/** Revela a chave Pix completa e registra a auditoria. */
export async function revealPixKey(
  affiliateId: string,
  actorId: string,
  tx: Prisma.TransactionClient,
): Promise<PixRevealResult> {
  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    select: { pixKeyEncrypted: true, pixKeyType: true },
  });

  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  let pixKey: string;
  try {
    pixKey = decrypt(affiliate.pixKeyEncrypted);
  } catch (error) {
    throw new AppError("INTERNAL", "Não foi possível revelar a chave Pix.", { cause: error });
  }

  await tx.auditLog.create({
    data: {
      actorId,
      actorRole: "ADMIN",
      action: "pix.reveal",
      entity: "Affiliate",
      entityId: affiliateId,
      after: { pixKeyType: affiliate.pixKeyType },
    },
  });

  return { affiliateId, pixKey, pixKeyType: affiliate.pixKeyType };
}

export type AnonymizeResult = {
  affiliateId: string;
  anonymizedAt: Date;
};

const ANONYMIZED_EMAIL_DOMAIN = "anonymized.local";

/**
 * Anonimiza os dados pessoais de um afiliado removido.
 *
 * Mantém `id`, `code`, vínculos, status e histórico contábil. Remove nome,
 * e-mail (vira hash), telefone, redes sociais e chave Pix.
 */
export async function anonymizeAffiliate(
  affiliateId: string,
  actorId: string | null,
  tx: Prisma.TransactionClient,
): Promise<AnonymizeResult> {
  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    include: { user: true },
  });

  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  if (affiliate.status !== "REMOVED") {
    throw new AppError("VALIDATION", "Só é possível anonimizar afiliados removidos.");
  }

  if (affiliate.anonymizedAt) {
    throw new AppError("CONFLICT", "Afiliado já foi anonimizado.");
  }

  const anonymizedAt = new Date();
  const hashedEmail = `${sha256(affiliate.user.email).slice(0, 32)}@${ANONYMIZED_EMAIL_DOMAIN}`;

  await tx.user.update({
    where: { id: affiliate.userId },
    data: { name: "Afiliado removido", email: hashedEmail },
  });

  await tx.affiliate.update({
    where: { id: affiliateId },
    data: {
      phone: "",
      socialHandle: "",
      socialNetwork: "OTHER",
      pixKeyEncrypted: "",
      pixKeyMasked: "***",
      anonymizedAt,
    },
  });

  await tx.auditLog.create({
    data: {
      actorId,
      actorRole: actorId ? "ADMIN" : "SYSTEM",
      action: "affiliate.anonymize",
      entity: "Affiliate",
      entityId: affiliateId,
      after: { anonymizedAt: anonymizedAt.toISOString() },
    },
  });

  return { affiliateId, anonymizedAt };
}
