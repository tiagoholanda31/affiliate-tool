"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { adminAction } from "@/lib/safe-action";
import { AppError, notFound, validation } from "@/lib/errors";
import { db } from "@/lib/db";
import { getPagarme } from "@/server/pagarme";

export const refundOrderAction = adminAction({
  name: "order.refund",
  schema: z.object({
    orderId: z.string().min(1),
    confirm: z.literal("ESTORNAR"),
  }),
  handler: async (input) => {
    const order = await db.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw notFound("Pedido não encontrado.");
    if (order.status !== "PAID") {
      throw validation("Só é possível estornar pedidos pagos.");
    }
    if (!order.gatewayChargeId) {
      throw validation("Pedido sem cobrança no gateway.");
    }

    try {
      await getPagarme().cancelCharge(order.gatewayChargeId);
    } catch (cause) {
      throw new AppError(
        "INTERNAL",
        "Não foi possível solicitar o estorno no gateway.",
        { expose: true, cause },
      );
    }

    const meta =
      order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
        ? { ...(order.metadata as Record<string, unknown>) }
        : {};
    meta.refundRequestedAt = new Date().toISOString();

    await db.order.update({
      where: { id: order.id },
      data: { metadata: meta as Prisma.InputJsonValue },
    });

    revalidatePath("/admin/vendas");
    revalidatePath(`/admin/vendas/${order.id}`);
    return { ok: true as const };
  },
  audit: (_result, input) => ({
    action: "order.refund_request",
    entity: "Order",
    entityId: input.orderId,
  }),
});
