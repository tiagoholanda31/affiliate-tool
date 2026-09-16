/**
 * Leituras do afiliado.
 *
 * Regra do CLAUDE.md e da spec 04: nenhuma função aqui aceita `affiliateId`
 * vindo do client. O identificador sai sempre da sessão — é o que impede que
 * trocar um id na URL mostre o cadastro de outra pessoa.
 *
 * A chave Pix sai daqui **sempre mascarada**. A versão em claro só é decifrada
 * na fatia 07, na tela de pagamento do admin, com `AuditLog pix.reveal`.
 */
import type { AffiliateStatus, PixKeyType, SocialNetwork } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

export type AffiliateProfile = {
  id: string;
  code: string | null;
  status: AffiliateStatus;
  statusReason: string | null;
  statusChangedAt: Date;
  reviewCount: number;
  phone: string;
  socialNetwork: SocialNetwork;
  socialHandle: string;
  pixKeyType: PixKeyType;
  pixKeyMasked: string;
  termsVersion: string;
  termsAcceptedAt: Date;
  createdAt: Date;
  user: { name: string; email: string };
};

/** Perfil completo do afiliado logado — o que as telas de status e o perfil usam. */
export async function getAffiliateProfile(userId: string): Promise<AffiliateProfile | null> {
  const affiliate = await db.affiliate.findUnique({
    where: { userId },
    select: {
      id: true,
      code: true,
      status: true,
      statusReason: true,
      statusChangedAt: true,
      reviewCount: true,
      phone: true,
      socialNetwork: true,
      socialHandle: true,
      pixKeyType: true,
      pixKeyMasked: true,
      termsVersion: true,
      termsAcceptedAt: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    },
  });

  return affiliate;
}

/** Celular em E.164 (`+5511987654321`) formatado para leitura. */
export function formatPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return e164;
}
