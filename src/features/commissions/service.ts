/**
 * Domínio de comissões: cálculo, criação idempotente, reversão, saldos e liberação.
 */
import type {
  Commission,
  CommissionAdjustment,
  CommissionType,
  Order,
  Prisma,
} from "@/generated/prisma/client";

import { addHoldDays, nextPayoutDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { applyPercent } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export type Tx = Prisma.TransactionClient;
type DbLike = Pick<Tx, "commission" | "commissionAdjustment">;

export type CommissionRateSnapshot = {
  type: CommissionType;
  /** Basis points (PERCENT) ou centavos (FIXED). */
  value: number;
};

/**
 * Calcula a comissão sobre a base do pedido.
 * PERCENT: half-even. FIXED: `min(fixed, base)`. Nunca negativa.
 */
export function calculateCommission(
  amountCents: number,
  snapshot: CommissionRateSnapshot,
): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new TypeError("amountCents deve ser inteiro ≥ 0.");
  }
  if (!Number.isSafeInteger(snapshot.value) || snapshot.value < 0) {
    throw new TypeError("rateValue deve ser inteiro ≥ 0.");
  }

  if (snapshot.type === "PERCENT") {
    if (snapshot.value > 10_000) {
      throw new RangeError("PERCENT em basis points deve ser ≤ 10000.");
    }
    return Math.max(0, applyPercent(amountCents, snapshot.value));
  }

  return Math.max(0, Math.min(snapshot.value, amountCents));
}

export type AffiliateBalances = {
  pendingCents: number;
  availableCents: number;
  paidCents: number;
  openAdjustmentsCents: number;
  nextPayoutDate: Date;
};

/**
 * Saldos derivados (nunca armazenados).
 * Disponível = AVAILABLE sem `payoutId` (não reservadas em lote) + ajustes abertos.
 */
export async function getBalances(
  affiliateId: string,
  tx: DbLike = db,
  now: Date = new Date(),
): Promise<AffiliateBalances> {
  const [groups, availableFree, openAdj, settings] = await Promise.all([
    tx.commission.groupBy({
      by: ["status"],
      where: { affiliateId },
      _sum: { amountCents: true },
    }),
    tx.commission.aggregate({
      where: { affiliateId, status: "AVAILABLE", payoutId: null },
      _sum: { amountCents: true },
    }),
    tx.commissionAdjustment.aggregate({
      where: { affiliateId, payoutId: null },
      _sum: { amountCents: true },
    }),
    getSettings(),
  ]);

  const byStatus = Object.fromEntries(
    groups.map((g) => [g.status, g._sum.amountCents ?? 0]),
  ) as Partial<Record<string, number>>;

  const pendingCents = byStatus.PENDING ?? 0;
  const availableRaw = availableFree._sum.amountCents ?? 0;
  const paidCents = byStatus.PAID ?? 0;
  const openAdjustmentsCents = openAdj._sum.amountCents ?? 0;
  // Ajustes abertos (tipicamente negativos de estorno PAID) abatem o disponível.
  const availableCents = availableRaw + openAdjustmentsCents;

  return {
    pendingCents,
    availableCents,
    paidCents,
    openAdjustmentsCents,
    nextPayoutDate: nextPayoutDate(settings.payoutDay, now),
  };
}

type OrderForCommission = Pick<
  Order,
  "id" | "status" | "affiliateId" | "amountCents" | "paidAt" | "productId"
>;

/**
 * Cria comissão para pedido PAID com afiliado. Idempotente (unique orderId).
 * Snapshot da taxa vem do produto no momento da venda.
 */
export async function createCommissionForOrder(
  order: OrderForCommission,
  tx: Tx,
): Promise<Commission | null> {
  if (order.status !== "PAID" || !order.affiliateId || !order.paidAt) {
    return null;
  }

  const existing = await tx.commission.findUnique({
    where: { orderId: order.id },
  });
  if (existing) {
    return existing;
  }

  const product = await tx.product.findUnique({
    where: { id: order.productId },
    select: { commissionType: true, commissionValue: true },
  });
  if (!product) {
    throw new AppError("NOT_FOUND", "Produto do pedido não encontrado.");
  }

  const snapshot: CommissionRateSnapshot = {
    type: product.commissionType,
    value: product.commissionValue,
  };
  const amountCents = calculateCommission(order.amountCents, snapshot);
  const settings = await getSettings();
  const availableAt = addHoldDays(order.paidAt, settings.holdDays);

  try {
    return await tx.commission.create({
      data: {
        orderId: order.id,
        affiliateId: order.affiliateId,
        amountCents,
        baseAmountCents: order.amountCents,
        rateType: snapshot.type,
        rateValue: snapshot.value,
        status: "PENDING",
        availableAt,
      },
    });
  } catch (error) {
    // Corrida: outro processo criou no meio — devolve a existente.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return tx.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    }
    throw error;
  }
}

/**
 * Reverte comissão ao estornar pedido.
 * PENDING/AVAILABLE → REVERSED; PAID → CommissionAdjustment negativo.
 */
export async function reverseCommission(
  order: Pick<Order, "id" | "affiliateId">,
  reason: string,
  tx: Tx,
  createdById = "system",
): Promise<{ commission: Commission | null; adjustment: CommissionAdjustment | null }> {
  const commission = await tx.commission.findUnique({
    where: { orderId: order.id },
  });
  if (!commission) {
    return { commission: null, adjustment: null };
  }
  if (commission.status === "REVERSED") {
    return { commission, adjustment: null };
  }

  if (commission.status === "PENDING" || commission.status === "AVAILABLE") {
    const updated = await tx.commission.update({
      where: { id: commission.id },
      data: {
        status: "REVERSED",
        reversedAt: new Date(),
        reversalReason: reason,
      },
    });
    return { commission: updated, adjustment: null };
  }

  // PAID: saldo já saiu — gera débito aberto no afiliado.
  const adjustment = await tx.commissionAdjustment.create({
    data: {
      affiliateId: commission.affiliateId,
      amountCents: -commission.amountCents,
      reason,
      orderId: order.id,
      createdById,
    },
  });

  const updated = await tx.commission.update({
    where: { id: commission.id },
    data: {
      reversedAt: new Date(),
      reversalReason: reason,
      // Mantém PAID no histórico; o ajuste cobre o débito.
    },
  });

  return { commission: updated, adjustment };
}

/** Libera comissões PENDING com `availableAt <= now`. Retorna as liberadas. */
export async function releaseDueCommissions(
  tx: DbLike & Pick<Tx, "commission"> = db,
  now: Date = new Date(),
): Promise<Commission[]> {
  const due = await tx.commission.findMany({
    where: {
      status: "PENDING",
      availableAt: { lte: now },
    },
  });

  if (due.length === 0) {
    return [];
  }

  const ids = due.map((c) => c.id);
  await tx.commission.updateMany({
    where: { id: { in: ids }, status: "PENDING" },
    data: { status: "AVAILABLE" },
  });

  return tx.commission.findMany({
    where: { id: { in: ids }, status: "AVAILABLE" },
  });
}

/** Preview de comissão para o formulário de venda manual (sem persistir). */
export function previewCommission(
  amountCents: number,
  snapshot: CommissionRateSnapshot,
  paidAt: Date,
  holdDays: number,
): { amountCents: number; availableAt: Date } {
  return {
    amountCents: calculateCommission(amountCents, snapshot),
    availableAt: addHoldDays(paidAt, holdDays),
  };
}
