/**
 * Server Actions públicas (comprador) e admin da entrega digital.
 */
"use server";

import { revalidatePath } from "next/cache";

import {
  sendDownloadLinkEmail,
  sendOrderAccessLinkEmail,
} from "@/features/delivery/notify";
import {
  adminResendDownloadSchema,
  adminRevokeGrantsSchema,
  requestOrderLinkSchema,
  resendDownloadSchema,
} from "@/features/delivery/schemas";
import {
  resendGrant,
  revokeGrantsForOrder,
  rotateOrderAccessToken,
} from "@/features/delivery/service";
import { hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { notFound, rateLimited, validation } from "@/lib/errors";
import { consume } from "@/lib/rate-limit";
import { adminAction, publicAction } from "@/lib/safe-action";

const GENERIC_ORDER_LINK_OK =
  "Se o e-mail coincidir com a compra, enviamos o link do pedido em instantes.";

export const resendDownloadAction = publicAction({
  name: "delivery.resend",
  schema: resendDownloadSchema,
  handler: async (input, ctx) => {
    const rl = consume("download", `resend:${ctx.ip}:${input.publicCode}`);
    if (!rl.ok) throw rateLimited();

    const order = await db.order.findUnique({
      where: { publicCode: input.publicCode },
      select: {
        id: true,
        status: true,
        accessTokenHash: true,
        customerEmail: true,
        customerName: true,
        publicCode: true,
        productNameSnap: true,
        product: { select: { type: true } },
      },
    });

    if (order?.accessTokenHash !== hashToken(input.accessToken)) {
      throw notFound("Pedido não encontrado.");
    }
    if (order.status !== "PAID") {
      throw validation("O download só está disponível para pedidos pagos.");
    }
    if (order.product.type !== "DIGITAL") {
      throw validation("Este pedido não tem arquivo digital.");
    }

    const { grant, token } = await resendGrant(order.id);

    await sendDownloadLinkEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      publicCode: order.publicCode,
      productName: order.productNameSnap,
      token,
      expiresAt: grant.expiresAt,
      maxDownloads: grant.maxDownloads,
    });

    revalidatePath(`/pedido/${order.publicCode}`);
    return {
      expiresAt: grant.expiresAt.toISOString(),
      maxDownloads: grant.maxDownloads,
      remaining: grant.maxDownloads,
      downloadUrl: `/download/${encodeURIComponent(token)}`,
    };
  },
});
/**
 * Anti-enumeração: resposta sempre igual, independente de o e-mail bater.
 * Só envia se o e-mail coincidir (case-insensitive).
 */
export const requestOrderLinkAction = publicAction({
  name: "delivery.requestOrderLink",
  schema: requestOrderLinkSchema,
  handler: async (input, ctx) => {
    const rl = consume("download", `order-link:${ctx.ip}:${input.publicCode}`);
    if (!rl.ok) throw rateLimited();

    const order = await db.order.findUnique({
      where: { publicCode: input.publicCode },
      select: {
        id: true,
        customerEmail: true,
        customerName: true,
        publicCode: true,
        productNameSnap: true,
      },
    });

    const emailNorm = input.email.trim().toLowerCase();
    if (order?.customerEmail.toLowerCase() === emailNorm) {
      const accessToken = await rotateOrderAccessToken(order.id);
      await sendOrderAccessLinkEmail({
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        publicCode: order.publicCode,
        productName: order.productNameSnap,
        accessToken,
      });
    }

    return { message: GENERIC_ORDER_LINK_OK };
  },
});

export const adminResendDownloadAction = adminAction({
  name: "delivery.adminResend",
  schema: adminResendDownloadSchema,
  handler: async (input) => {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        status: true,
        customerEmail: true,
        customerName: true,
        publicCode: true,
        productNameSnap: true,
        product: { select: { type: true } },
      },
    });
    if (!order) throw notFound("Pedido não encontrado.");
    if (order.status !== "PAID" || order.product.type !== "DIGITAL") {
      throw validation("Pedido sem entrega digital ativa.");
    }

    const { grant, token } = await resendGrant(order.id);
    await sendDownloadLinkEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      publicCode: order.publicCode,
      productName: order.productNameSnap,
      token,
      expiresAt: grant.expiresAt,
      maxDownloads: grant.maxDownloads,
    });

    revalidatePath(`/admin/vendas/${order.id}`);
    return { grantId: grant.id };
  },
  audit: (result, input) => ({
    action: "delivery.resend",
    entity: "Order",
    entityId: input.orderId,
    after: { grantId: result.grantId },
  }),
});

export const adminRevokeGrantsAction = adminAction({
  name: "delivery.adminRevoke",
  schema: adminRevokeGrantsSchema,
  handler: async (input) => {
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: { id: true },
    });
    if (!order) throw notFound("Pedido não encontrado.");

    const count = await db.$transaction((tx) => revokeGrantsForOrder(order.id, tx));
    revalidatePath(`/admin/vendas/${order.id}`);
    return { revoked: count };
  },
  audit: (result, input) => ({
    action: "delivery.revoke",
    entity: "Order",
    entityId: input.orderId,
    after: { revoked: result.revoked },
  }),
});
