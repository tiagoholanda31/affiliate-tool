/**
 * Venda manual lançada pelo admin: Order MANUAL PAID + onOrderPaid.
 */
import { createCommissionForOrder, previewCommission } from "@/features/commissions/service";
import type { CreateManualOrderInput } from "@/features/commissions/schemas";
import { sendDownloadLinkEmail } from "@/features/delivery/notify";
import { onOrderPaid } from "@/features/orders/hooks";
import { generatePublicCode } from "@/features/orders/public-code";
import { hashToken, randomToken } from "@/lib/crypto";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import { formatBRL } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export type ManualOrderResult = {
  orderId: string;
  publicCode: string;
  commissionCents: number | null;
  availableAtLabel: string | null;
  affiliateCode: string | null;
  downloadSent: boolean;
};

export async function createManualOrder(
  input: CreateManualOrderInput,
  adminUserId: string,
): Promise<ManualOrderResult> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      status: true,
      type: true,
      commissionType: true,
      commissionValue: true,
      digitalFile: { select: { id: true } },
    },
  });
  if (!product || product.status === "ARCHIVED") {
    throw notFound("Produto não encontrado ou arquivado.");
  }

  let affiliateCode: string | null = null;
  if (input.affiliateId) {
    const affiliate = await db.affiliate.findUnique({
      where: { id: input.affiliateId },
      select: { id: true, code: true, status: true },
    });
    if (!affiliate || affiliate.status === "REMOVED") {
      throw validation("Afiliado inválido ou removido.");
    }
    affiliateCode = affiliate.code;
  }

  const accessToken = randomToken(32);
  let publicCode = generatePublicCode();

  const order = await db.$transaction(async (tx) => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await tx.order.create({
          data: {
            publicCode,
            accessTokenHash: hashToken(accessToken),
            source: "MANUAL",
            status: "PAID",
            productId: product.id,
            productNameSnap: product.name,
            affiliateId: input.affiliateId ?? null,
            customerName: input.customerName,
            customerEmail: input.customerEmail,
            customerPhone: input.customerPhone ?? null,
            amountCents: input.amountCents,
            paymentMethod: "MANUAL",
            paidAt: input.paidAt,
            notes: input.notes ?? null,
            createdById: adminUserId,
          },
        });
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code: string }).code === "P2002"
        ) {
          publicCode = generatePublicCode();
          continue;
        }
        throw error;
      }
    }
    throw validation("Não foi possível gerar um código de pedido único. Tente de novo.");
  });

  // Comissão + grant + e-mails afiliado/admin via hook.
  const paidResult = await onOrderPaid(order);
  const download =
    paidResult && "download" in paidResult ? paidResult.download : null;

  let downloadSent = false;
  if (
    input.sendDownloadLink &&
    product.type === "DIGITAL" &&
    download
  ) {
    await sendDownloadLinkEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      publicCode: order.publicCode,
      productName: order.productNameSnap,
      token: download.token,
      expiresAt: download.grant.expiresAt,
      maxDownloads: download.grant.maxDownloads,
    });
    downloadSent = true;
  }

  const commission = await db.commission.findUnique({
    where: { orderId: order.id },
    select: { amountCents: true, availableAt: true },
  });

  return {
    orderId: order.id,
    publicCode: order.publicCode,
    commissionCents: commission?.amountCents ?? null,
    availableAtLabel: commission ? formatDate(commission.availableAt) : null,
    affiliateCode,
    downloadSent,
  };
}

/** Resumo para a confirmação do formulário (sem gravar). */
export async function previewManualOrder(input: {
  productId: string;
  amountCents: number;
  paidAt: Date;
  affiliateId?: string | null;
}): Promise<{
  productName: string;
  amountLabel: string;
  commissionLabel: string | null;
  availableAtLabel: string | null;
  affiliateLabel: string | null;
  summary: string;
}> {
  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      name: true,
      commissionType: true,
      commissionValue: true,
      status: true,
    },
  });
  if (!product || product.status === "ARCHIVED") {
    throw notFound("Produto não encontrado ou arquivado.");
  }

  const settings = await getSettings();
  let affiliateLabel: string | null = null;
  if (input.affiliateId) {
    const affiliate = await db.affiliate.findUnique({
      where: { id: input.affiliateId },
      select: { code: true, user: { select: { name: true } }, status: true },
    });
    if (!affiliate || affiliate.status === "REMOVED") {
      throw validation("Afiliado inválido.");
    }
    affiliateLabel = affiliate.code ? `@${affiliate.code}` : affiliate.user.name;
  }

  const amountLabel = formatBRL(input.amountCents);

  if (!input.affiliateId) {
    return {
      productName: product.name,
      amountLabel,
      commissionLabel: null,
      availableAtLabel: null,
      affiliateLabel: null,
      summary: `Venda de ${amountLabel} sem afiliado — nenhuma comissão será gerada.`,
    };
  }

  const preview = previewCommission(
    input.amountCents,
    { type: product.commissionType, value: product.commissionValue },
    input.paidAt,
    settings.holdDays,
  );

  const commissionLabel = formatBRL(preview.amountCents);
  const availableAtLabel = formatDate(preview.availableAt);

  return {
    productName: product.name,
    amountLabel,
    commissionLabel,
    availableAtLabel,
    affiliateLabel,
    summary: `Comissão de ${commissionLabel} para ${affiliateLabel ?? "afiliado"}, liberada em ${availableAtLabel}.`,
  };
}

/** Busca afiliados APPROVED por nome, código ou e-mail (venda manual). */
export async function searchAffiliatesForManual(q: string, limit = 10) {
  const term = q.trim();
  if (term.length < 2) {
    return [];
  }

  return db.affiliate.findMany({
    where: {
      status: "APPROVED",
      OR: [
        { code: { contains: term, mode: "insensitive" } },
        { user: { name: { contains: term, mode: "insensitive" } } },
        { user: { email: { contains: term, mode: "insensitive" } } },
      ],
    },
    take: limit,
    select: {
      id: true,
      code: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Garante que createCommissionForOrder está no grafo (tree-shaking / testes). */
export { createCommissionForOrder };
