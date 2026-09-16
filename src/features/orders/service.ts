/**
 * Máquina de estados do pedido e efeitos pós-commit (e-mails, hooks).
 */
import type { Order, OrderStatus, Prisma } from "@/generated/prisma/client";

import { onOrderPaid, onOrderReversed } from "@/features/orders/hooks";
import { formatDate } from "@/lib/dates";
import { APP_URL } from "@/lib/env";
import { AppError, invalidTransition } from "@/lib/errors";
import { sendMail } from "@/lib/mail";
import { getSupportWhatsapp } from "@/lib/settings";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { formatBRL } from "@/lib/money";
import {
  gatewayStatusToOrderStatus,
  mapCardDecline,
  mapGatewayStatus,
  type GatewayStatus,
} from "@/server/pagarme/map";
import type { PagarmeOrder } from "@/server/pagarme/types";

/** Transições permitidas (CHECKOUT). MANUAL nasce PAID (fatia 06). */
const ALLOWED: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  PENDING: new Set(["PAID", "FAILED", "EXPIRED", "CANCELED"]),
  PAID: new Set(["REFUNDED", "CHARGEDBACK"]),
  FAILED: new Set([]),
  EXPIRED: new Set([]),
  CANCELED: new Set([]),
  REFUNDED: new Set([]),
  CHARGEDBACK: new Set([]),
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;
  return ALLOWED[from].has(to);
}

export type TransitionPatch = {
  status: OrderStatus;
  paidAt?: Date | null;
  refundedAt?: Date | null;
  failureReason?: string | null;
  gatewayOrderId?: string | null;
  gatewayChargeId?: string | null;
  pixQrCode?: string | null;
  pixQrCodeUrl?: string | null;
  pixExpiresAt?: Date | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Aplica transição com lock da linha. Efeitos colaterais (e-mails, hooks)
 * rodam **após** o commit.
 */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  patch: Omit<TransitionPatch, "status"> = {},
): Promise<Order> {
  const { order, previousStatus } = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) {
      throw new AppError("NOT_FOUND", "Pedido não encontrado.");
    }

    if (current.status === to) {
      return { order: current, previousStatus: current.status };
    }

    if (!canTransition(current.status, to)) {
      throw invalidTransition(current.status, to);
    }

    const data: Prisma.OrderUpdateInput = {
      status: to,
      ...(patch.paidAt !== undefined ? { paidAt: patch.paidAt } : {}),
      ...(patch.refundedAt !== undefined ? { refundedAt: patch.refundedAt } : {}),
      ...(patch.failureReason !== undefined ? { failureReason: patch.failureReason } : {}),
      ...(patch.gatewayOrderId !== undefined ? { gatewayOrderId: patch.gatewayOrderId } : {}),
      ...(patch.gatewayChargeId !== undefined ? { gatewayChargeId: patch.gatewayChargeId } : {}),
      ...(patch.pixQrCode !== undefined ? { pixQrCode: patch.pixQrCode } : {}),
      ...(patch.pixQrCodeUrl !== undefined ? { pixQrCodeUrl: patch.pixQrCodeUrl } : {}),
      ...(patch.pixExpiresAt !== undefined ? { pixExpiresAt: patch.pixExpiresAt } : {}),
      ...(patch.cardBrand !== undefined ? { cardBrand: patch.cardBrand } : {}),
      ...(patch.cardLast4 !== undefined ? { cardLast4: patch.cardLast4 } : {}),
      ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
    };

    if (to === "PAID" && !patch.paidAt && !current.paidAt) {
      data.paidAt = new Date();
    }
    if ((to === "REFUNDED" || to === "CHARGEDBACK") && !patch.refundedAt) {
      data.refundedAt = new Date();
    }

    const updated = await tx.order.update({ where: { id: orderId }, data });
    return { order: updated, previousStatus: current.status };
  });

  if (previousStatus !== order.status) {
    await runSideEffects(order, previousStatus).catch((error: unknown) => {
      logger.error(
        { orderId: order.id, from: previousStatus, to: order.status, err: error },
        "Falha em efeitos pós-transição de pedido",
      );
    });
  }

  return order;
}

async function runSideEffects(order: Order, previousStatus: OrderStatus): Promise<void> {
  const supportWhatsapp = await getSupportWhatsapp();
  const orderUrl = `${APP_URL}/pedido/${order.publicCode}`;
  // Token de acesso não está no banco — e-mails usam link sem ?t=;
  // o comprador recupera via formulário de e-mail em `/pedido` (fatia 08).
  // O grant de download traz o token em claro só neste momento.

  if (order.status === "PAID" && previousStatus !== "PAID") {
    const paidResult = await onOrderPaid(order);
    const product = await db.product.findUnique({
      where: { id: order.productId },
      select: { type: true, deliveryNote: true, slug: true },
    });
    const download = paidResult && "download" in paidResult ? paidResult.download : null;
    await sendMail({
      to: order.customerEmail,
      template: "order-paid",
      props: {
        customerName: order.customerName,
        publicCode: order.publicCode,
        productName: order.productNameSnap,
        amountLabel: formatBRL(order.amountCents),
        orderUrl,
        deliveryNote: product?.type === "SERVICE" ? (product.deliveryNote ?? undefined) : undefined,
        isDigital: product?.type === "DIGITAL",
        downloadUrl: download
          ? `${APP_URL}/download/${encodeURIComponent(download.token)}`
          : undefined,
        expiresAtLabel: download ? formatDate(download.grant.expiresAt) : undefined,
        maxDownloads: download?.grant.maxDownloads,
        supportWhatsapp,
      },
    });
  }

  if (order.status === "FAILED" && previousStatus === "PENDING") {
    const product = await db.product.findUnique({
      where: { id: order.productId },
      select: { slug: true },
    });
    await sendMail({
      to: order.customerEmail,
      template: "order-failed",
      props: {
        customerName: order.customerName,
        publicCode: order.publicCode,
        productName: order.productNameSnap,
        reason: order.failureReason ?? "Não foi possível concluir o pagamento.",
        retryUrl: product ? `${APP_URL}/p/${product.slug}` : APP_URL,
        supportWhatsapp,
      },
    });
  }

  if (
    (order.status === "REFUNDED" || order.status === "CHARGEDBACK") &&
    previousStatus === "PAID"
  ) {
    await onOrderReversed(order);
  }
}

/**
 * Aplica o status reconsultado no gateway ao pedido local.
 * Transição inválida → log + ignore (não derruba webhook).
 */
export async function applyGatewayStatus(
  order: Order,
  gatewayOrder: PagarmeOrder,
): Promise<Order> {
  const gatewayStatus = mapGatewayStatus(gatewayOrder);
  const target = gatewayStatusToOrderStatus(gatewayStatus);

  if (order.status === target) {
    return order;
  }

  if (!canTransition(order.status, target)) {
    logger.warn(
      {
        orderId: order.id,
        from: order.status,
        to: target,
        gatewayStatus,
      },
      "Transição de pedido ignorada (inválida)",
    );
    throw invalidTransition(order.status, target);
  }

  const charge = gatewayOrder.charges?.[0];
  const tx = charge?.last_transaction;
  const patch: Omit<TransitionPatch, "status"> = {
    gatewayChargeId: charge?.id ?? order.gatewayChargeId,
  };

  if (target === "PAID") {
    patch.paidAt = charge?.paid_at ? new Date(charge.paid_at) : new Date();
    if (tx?.card) {
      patch.cardBrand = tx.card.brand ?? undefined;
      patch.cardLast4 = tx.card.last_four_digits ?? undefined;
    }
  }

  if (target === "FAILED") {
    patch.failureReason = mapCardDecline(tx?.acquirer_return_code, tx?.acquirer_message);
    const meta =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? { ...(order.metadata as Record<string, unknown>) }
        : {};
    meta.gatewayDeclineCode = tx?.acquirer_return_code ?? null;
    patch.metadata = meta as Prisma.InputJsonValue;
  }

  if (target === "REFUNDED" || target === "CHARGEDBACK") {
    patch.refundedAt = new Date();
    if (target === "CHARGEDBACK") {
      const meta =
        order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
          ? { ...(order.metadata as Record<string, unknown>) }
          : {};
      meta.suspicious = true;
      patch.metadata = meta as Prisma.InputJsonValue;
    }
  }

  try {
    return await transitionOrder(order.id, target, patch);
  } catch (error) {
    if (error instanceof AppError && error.code === "INVALID_TRANSITION") {
      throw error;
    }
    throw error;
  }
}

/** Extrai dados Pix da resposta do gateway. */
export function extractPixData(gatewayOrder: PagarmeOrder): {
  qrCode: string | null;
  qrCodeUrl: string | null;
  expiresAt: Date | null;
  chargeId: string | null;
} {
  const charge = gatewayOrder.charges?.[0];
  const tx = charge?.last_transaction;
  return {
    qrCode: tx?.qr_code ?? null,
    qrCodeUrl: tx?.qr_code_url ?? null,
    expiresAt: tx?.expires_at ? new Date(tx.expires_at) : null,
    chargeId: charge?.id ?? null,
  };
}

export function extractCardData(gatewayOrder: PagarmeOrder): {
  brand: string | null;
  last4: string | null;
  chargeId: string | null;
  declineCode: string | null;
} {
  const charge = gatewayOrder.charges?.[0];
  const tx = charge?.last_transaction;
  return {
    brand: tx?.card?.brand ?? null,
    last4: tx?.card?.last_four_digits ?? null,
    chargeId: charge?.id ?? null,
    declineCode: tx?.acquirer_return_code ?? null,
  };
}

export type { GatewayStatus };
