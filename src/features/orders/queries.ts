/**
 * Consultas de pedido (página pública e admin).
 */
import type { OrderStatus, PaymentMethod, Prisma } from "@/generated/prisma/client";

import { hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";

export async function findOrderByPublicCode(publicCode: string) {
  return db.order.findUnique({
    where: { publicCode },
    include: {
      product: {
        select: {
          id: true,
          slug: true,
          type: true,
          deliveryNote: true,
          coverImagePath: true,
        },
      },
      affiliate: {
        select: { id: true, code: true, user: { select: { name: true } } },
      },
    },
  });
}

/** Valida `?t=` contra o hash; lança NOT_FOUND se inválido. */
export async function getOrderForBuyer(publicCode: string, accessToken: string) {
  const order = await findOrderByPublicCode(publicCode);
  if (order?.accessTokenHash !== hashToken(accessToken)) {
    throw notFound("Pedido não encontrado.");
  }
  return order;
}

export type AdminOrdersFilter = {
  status?: OrderStatus;
  productId?: string;
  affiliateId?: string;
  source?: "CHECKOUT" | "MANUAL";
  method?: PaymentMethod;
  q?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export async function listAdminOrders(filter: AdminOrdersFilter = {}) {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 20));
  const where: Prisma.OrderWhereInput = {};

  if (filter.status) where.status = filter.status;
  if (filter.productId) where.productId = filter.productId;
  if (filter.affiliateId) where.affiliateId = filter.affiliateId;
  if (filter.source) where.source = filter.source;
  if (filter.method) where.paymentMethod = filter.method;
  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }
  if (filter.q) {
    where.OR = [
      { publicCode: { contains: filter.q, mode: "insensitive" } },
      { customerEmail: { contains: filter.q, mode: "insensitive" } },
      { customerName: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  const [total, items] = await Promise.all([
    db.order.count({ where }),
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { name: true, slug: true } },
        affiliate: {
          select: { code: true, user: { select: { name: true } } },
        },
      },
    }),
  ]);

  return { total, page, pageSize, items };
}

export async function getAdminOrderDetail(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, slug: true, type: true } },
      affiliate: {
        select: {
          id: true,
          code: true,
          user: { select: { name: true, email: true } },
        },
      },
      click: { select: { id: true, createdAt: true, productId: true } },
    },
  });
  if (!order) return null;

  const webhooks = order.gatewayOrderId
    ? await db.webhookEvent.findMany({
        where: {
          provider: "pagarme",
          OR: [
            { payload: { path: ["data", "id"], equals: order.gatewayOrderId } },
            {
              payload: {
                path: ["data", "metadata", "orderId"],
                equals: order.id,
              },
            },
            {
              payload: {
                path: ["data", "metadata", "publicCode"],
                equals: order.publicCode,
              },
            },
          ],
        },
        orderBy: { receivedAt: "desc" },
        take: 20,
      })
    : [];

  return { order, webhooks };
}

/** Status leve para polling (sem PII). */
export async function getOrderStatus(publicCode: string, accessToken: string) {
  const order = await db.order.findUnique({
    where: { publicCode },
    select: {
      status: true,
      accessTokenHash: true,
      failureReason: true,
      paidAt: true,
      pixExpiresAt: true,
    },
  });
  if (order?.accessTokenHash !== hashToken(accessToken)) {
    return null;
  }
  return {
    status: order.status,
    failureReason: order.failureReason,
    paidAt: order.paidAt?.toISOString() ?? null,
    pixExpiresAt: order.pixExpiresAt?.toISOString() ?? null,
  };
}
