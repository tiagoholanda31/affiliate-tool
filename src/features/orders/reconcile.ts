/**
 * Expiração de Pix pendente e reconciliação com o gateway.
 */
import { applyGatewayStatus, transitionOrder } from "@/features/orders/service";
import { APP_URL } from "@/lib/env";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";
import { getPagarme } from "@/server/pagarme";
import { mapGatewayStatus } from "@/server/pagarme/map";

export type ReconcileSummary = {
  pendingChecked: number;
  paidChecked: number;
  applied: number;
  expired: number;
  divergences: number;
  errors: number;
};

/**
 * Marca PENDING Pix com `pixExpiresAt < now - graceMinutes` como EXPIRED.
 * Spec: grace de 5 min após a expiração do QR.
 */
export async function expirePendingPix(now = new Date(), graceMinutes = 5): Promise<number> {
  const cutoff = new Date(now.getTime() - graceMinutes * 60_000);
  const candidates = await db.order.findMany({
    where: {
      status: "PENDING",
      paymentMethod: "PIX",
      pixExpiresAt: { lt: cutoff },
    },
    select: { id: true },
    take: 200,
  });

  let expired = 0;
  for (const row of candidates) {
    try {
      await transitionOrder(row.id, "EXPIRED");
      expired += 1;
    } catch (error) {
      logger.warn({ orderId: row.id, err: error }, "Falha ao expirar Pix pendente");
    }
  }
  return expired;
}

/**
 * Reconcilia PENDING (>10 min) e PAID (últimas 48 h) com o gateway.
 */
export async function reconcileOrders(now = new Date()): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    pendingChecked: 0,
    paidChecked: 0,
    applied: 0,
    expired: 0,
    divergences: 0,
    errors: 0,
  };

  const gateway = getPagarme();
  const pendingCutoff = new Date(now.getTime() - 10 * 60_000);
  const paidSince = new Date(now.getTime() - 48 * 60 * 60_000);

  const pending = await db.order.findMany({
    where: {
      status: "PENDING",
      source: "CHECKOUT",
      gatewayOrderId: { not: null },
      createdAt: { lt: pendingCutoff },
    },
    take: 100,
  });
  summary.pendingChecked = pending.length;

  for (const order of pending) {
    if (!order.gatewayOrderId) continue;
    try {
      const remote = await gateway.getOrder(order.gatewayOrderId);
      const status = mapGatewayStatus(remote);

      if (status === "paid" || status === "failed" || status === "canceled" || status === "refunded") {
        const before = order.status;
        await applyGatewayStatus(order, remote);
        summary.applied += 1;
        if (before !== "PAID" && status === "paid") {
          summary.divergences += 1;
          await notifyDivergence(order.publicCode, before, "PAID");
        }
      } else if (
        order.paymentMethod === "PIX" &&
        order.pixExpiresAt &&
        order.pixExpiresAt.getTime() < now.getTime() - 5 * 60_000
      ) {
        await transitionOrder(order.id, "EXPIRED");
        summary.expired += 1;
      }
    } catch (error) {
      summary.errors += 1;
      logger.error({ orderId: order.id, err: error }, "Erro na reconciliação de PENDING");
    }
  }

  const paid = await db.order.findMany({
    where: {
      status: "PAID",
      source: "CHECKOUT",
      gatewayOrderId: { not: null },
      paidAt: { gte: paidSince },
    },
    take: 100,
  });
  summary.paidChecked = paid.length;

  for (const order of paid) {
    if (!order.gatewayOrderId) continue;
    try {
      const remote = await gateway.getOrder(order.gatewayOrderId);
      const status = mapGatewayStatus(remote);
      if (status === "refunded" || status === "chargedback") {
        await applyGatewayStatus(order, remote);
        summary.applied += 1;
        summary.divergences += 1;
        await notifyDivergence(
          order.publicCode,
          "PAID",
          status === "refunded" ? "REFUNDED" : "CHARGEDBACK",
        );
      }
    } catch (error) {
      summary.errors += 1;
      logger.error({ orderId: order.id, err: error }, "Erro na reconciliação de PAID");
    }
  }

  // Também roda expiração local (sem gateway) para Pix sem charge.
  summary.expired += await expirePendingPix(now);

  return summary;
}

async function notifyDivergence(publicCode: string, from: string, to: string): Promise<void> {
  const settings = await getSettings();
  await sendMail({
    to: settings.adminNotifyEmail,
    template: "admin-alert",
    props: {
      title: "Reconciliação corrigiu divergência",
      message: `O pedido ${publicCode} estava ${from} localmente e o gateway indicou ${to}.`,
      details: [
        { label: "Pedido", value: publicCode },
        { label: "Antes", value: from },
        { label: "Depois", value: to },
      ],
      actionUrl: `${APP_URL}/admin/vendas`,
      actionLabel: "Ver vendas",
    },
  });
}
