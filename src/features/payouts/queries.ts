/**
 * Consultas de lotes de pagamento (admin e afiliado).
 */
import type { PayoutStatus, Prisma } from "@/generated/prisma/client";

import { getBalances } from "@/features/commissions/service";
import type { ListPayoutsInput } from "@/features/payouts/schemas";
import { partsInSaoPaulo, startOfDayInSaoPaulo } from "@/lib/dates";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { sumCents } from "@/lib/money";

function parseDayBound(iso: string | undefined, end: boolean): Date | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return undefined;
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const start = startOfDayInSaoPaulo(y, m, d);
  if (!end) return start;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Cards do topo: total disponível a pagar e nº de afiliados. */
export async function getPayoutDashboardSummary() {
  const available = await db.commission.groupBy({
    by: ["affiliateId"],
    where: { status: "AVAILABLE", payoutId: null },
    _sum: { amountCents: true },
  });

  const openAdj = await db.commissionAdjustment.groupBy({
    by: ["affiliateId"],
    where: { payoutId: null },
    _sum: { amountCents: true },
  });
  const adjByAffiliate = new Map(
    openAdj.map((a) => [a.affiliateId, a._sum.amountCents ?? 0]),
  );

  let totalAvailableCents = 0;
  let affiliatesWithBalance = 0;
  for (const row of available) {
    const adj = adjByAffiliate.get(row.affiliateId) ?? 0;
    const net = (row._sum.amountCents ?? 0) + adj;
    if (net > 0) {
      totalAvailableCents += net;
      affiliatesWithBalance += 1;
    }
  }

  // Afiliados só com ajuste positivo aberto e sem AVAILABLE (raro, mas conta).
  for (const [affiliateId, adj] of adjByAffiliate) {
    if (available.some((a) => a.affiliateId === affiliateId)) continue;
    if (adj > 0) {
      totalAvailableCents += adj;
      affiliatesWithBalance += 1;
    }
  }

  const draftsCount = await db.payout.count({ where: { status: "DRAFT" } });

  return { totalAvailableCents, affiliatesWithBalance, draftsCount };
}

export type AffiliatePayableRow = {
  affiliateId: string;
  name: string;
  code: string | null;
  availableCents: number;
  openAdjustmentsCents: number;
  lastPaidAt: Date | null;
};

/** Afiliados com disponível > 0, ordenados por valor. */
export async function listAffiliatesPayable(): Promise<AffiliatePayableRow[]> {
  const available = await db.commission.groupBy({
    by: ["affiliateId"],
    where: { status: "AVAILABLE", payoutId: null },
    _sum: { amountCents: true },
  });
  if (available.length === 0) return [];

  const affiliateIds = available.map((a) => a.affiliateId);
  const [affiliates, openAdj, lastPaid] = await Promise.all([
    db.affiliate.findMany({
      where: { id: { in: affiliateIds } },
      select: {
        id: true,
        code: true,
        user: { select: { name: true } },
      },
    }),
    db.commissionAdjustment.groupBy({
      by: ["affiliateId"],
      where: { affiliateId: { in: affiliateIds }, payoutId: null },
      _sum: { amountCents: true },
    }),
    db.payout.findMany({
      where: { affiliateId: { in: affiliateIds }, status: "PAID" },
      orderBy: { paidAt: "desc" },
      distinct: ["affiliateId"],
      select: { affiliateId: true, paidAt: true },
    }),
  ]);

  const adjMap = new Map(openAdj.map((a) => [a.affiliateId, a._sum.amountCents ?? 0]));
  const lastMap = new Map(lastPaid.map((p) => [p.affiliateId, p.paidAt]));
  const affMap = new Map(affiliates.map((a) => [a.id, a]));

  const rows: AffiliatePayableRow[] = [];
  for (const row of available) {
    const aff = affMap.get(row.affiliateId);
    if (!aff) continue;
    const openAdjustmentsCents = adjMap.get(row.affiliateId) ?? 0;
    const availableCents = (row._sum.amountCents ?? 0) + openAdjustmentsCents;
    if (availableCents <= 0) continue;
    rows.push({
      affiliateId: row.affiliateId,
      name: aff.user.name,
      code: aff.code,
      availableCents,
      openAdjustmentsCents,
      lastPaidAt: lastMap.get(row.affiliateId) ?? null,
    });
  }

  rows.sort((a, b) => b.availableCents - a.availableCents);
  return rows;
}

export type PayoutListItem = {
  id: string;
  status: PayoutStatus;
  totalCents: number;
  referenceMonth: string;
  paidAt: Date | null;
  createdAt: Date;
  proofReference: string | null;
  proofPath: string | null;
  affiliate: { id: string; code: string | null; name: string };
  commissionCount: number;
  adjustmentCount: number;
};

export async function listPayouts(input: ListPayoutsInput): Promise<{
  items: PayoutListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const where: Prisma.PayoutWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.affiliateId) where.affiliateId = input.affiliateId;

  const from = parseDayBound(input.from, false);
  const to = parseDayBound(input.to, true);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const page = input.page;
  const pageSize = input.pageSize;
  const [total, rows] = await Promise.all([
    db.payout.count({ where }),
    db.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
        _count: { select: { commissions: true, adjustments: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    items: rows.map((p) => ({
      id: p.id,
      status: p.status,
      totalCents: p.totalCents,
      referenceMonth: p.referenceMonth,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      proofReference: p.proofReference,
      proofPath: p.proofPath,
      affiliate: {
        id: p.affiliate.id,
        code: p.affiliate.code,
        name: p.affiliate.user.name,
      },
      commissionCount: p._count.commissions,
      adjustmentCount: p._count.adjustments,
    })),
  };
}

export async function getPayoutDetail(payoutId: string) {
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    include: {
      affiliate: {
        select: {
          id: true,
          code: true,
          pixKeyType: true,
          pixKeyMasked: true,
          user: { select: { name: true, email: true } },
        },
      },
      commissions: {
        orderBy: { availableAt: "asc" },
        include: {
          order: {
            select: {
              publicCode: true,
              amountCents: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      adjustments: { orderBy: { createdAt: "asc" } },
    },
  });
  return payout;
}

export async function listAffiliatePayouts(affiliateId: string) {
  return db.payout.findMany({
    where: { affiliateId, status: "PAID" },
    orderBy: { paidAt: "desc" },
    include: {
      commissions: {
        orderBy: { availableAt: "asc" },
        include: {
          order: {
            select: {
              publicCode: true,
              product: { select: { name: true } },
            },
          },
        },
      },
      adjustments: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function listAffiliateAdjustments(affiliateId: string) {
  return db.commissionAdjustment.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/** Sino: comissões disponíveis para pagar quando hoje ≥ payoutDay. */
export async function getPayoutBellHint(now: Date = new Date()): Promise<{
  show: boolean;
  affiliatesWithBalance: number;
  totalAvailableCents: number;
} | null> {
  const settings = await getSettings();
  const today = partsInSaoPaulo(now);
  if (today.day < settings.payoutDay) {
    return null;
  }
  const summary = await getPayoutDashboardSummary();
  if (summary.affiliatesWithBalance === 0) return null;
  return {
    show: true,
    affiliatesWithBalance: summary.affiliatesWithBalance,
    totalAvailableCents: summary.totalAvailableCents,
  };
}

export async function getAffiliateStatement(affiliateId: string) {
  const [balances, payouts] = await Promise.all([
    getBalances(affiliateId),
    listAffiliatePayouts(affiliateId),
  ]);
  return { balances, payouts };
}

/** Total líquido disponível de um afiliado (para botão Gerar lote). */
export async function getAffiliateAvailableCents(affiliateId: string): Promise<number> {
  const balances = await getBalances(affiliateId);
  return balances.availableCents;
}

export { sumCents };
