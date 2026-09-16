/**
 * Consultas de comissão (admin e afiliado).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { CommissionStatus } from "@/generated/prisma/enums";

import { getBalances } from "@/features/commissions/service";
import type { ListCommissionsInput } from "@/features/commissions/schemas";
import { partsInSaoPaulo, startOfDayInSaoPaulo } from "@/lib/dates";
import { db } from "@/lib/db";

function dayBounds(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (from) {
    const [y, m, d] = from.split("-").map(Number) as [number, number, number];
    filter.gte = startOfDayInSaoPaulo(y, m, d);
  }
  if (to) {
    const [y, m, d] = to.split("-").map(Number) as [number, number, number];
    // Inclusive no dia: próximo dia à meia-noite SP.
    const end = startOfDayInSaoPaulo(y, m, d);
    filter.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return filter;
}

export async function listAdminCommissions(input: ListCommissionsInput) {
  const where: Prisma.CommissionWhereInput = {};
  if (input.status) where.status = input.status;
  if (input.affiliateId) where.affiliateId = input.affiliateId;
  const createdAt = dayBounds(input.from, input.to);
  if (createdAt) where.createdAt = createdAt;

  const page = input.page;
  const pageSize = input.pageSize;
  const [items, total, sumAgg] = await Promise.all([
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        affiliate: { select: { id: true, code: true, user: { select: { name: true } } } },
        order: {
          select: {
            id: true,
            publicCode: true,
            productNameSnap: true,
            paidAt: true,
          },
        },
      },
    }),
    db.commission.count({ where }),
    db.commission.aggregate({ where, _sum: { amountCents: true } }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    filterTotalCents: sumAgg._sum.amountCents ?? 0,
  };
}

export async function listAffiliateCommissions(
  affiliateId: string,
  opts: { status?: CommissionStatus; page?: number; pageSize?: number } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;
  const where: Prisma.CommissionWhereInput = { affiliateId };
  if (opts.status) where.status = opts.status;

  const [items, total, balances] = await Promise.all([
    db.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        order: {
          select: {
            id: true,
            publicCode: true,
            productNameSnap: true,
            amountCents: true,
            paidAt: true,
            status: true,
          },
        },
      },
    }),
    db.commission.count({ where }),
    getBalances(affiliateId),
  ]);

  return { items, total, page, pageSize, balances };
}

export async function listAffiliateOrders(
  affiliateId: string,
  opts: {
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {},
) {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 25;
  const where: Prisma.OrderWhereInput = { affiliateId };
  if (opts.status) {
    where.status = opts.status as Prisma.EnumOrderStatusFilter;
  }
  const createdAt = dayBounds(opts.from, opts.to);
  if (createdAt) where.createdAt = createdAt;

  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        commission: {
          select: {
            amountCents: true,
            status: true,
            availableAt: true,
          },
        },
        product: { select: { name: true, slug: true } },
      },
    }),
    db.order.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

/** KPIs do início do painel (vendas 30d + saldos + conversão). */
export async function getAffiliateSalesDashboard(affiliateId: string) {
  const now = new Date();
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [sales30d, uniqueClicks30d, balances, recentOrders] = await Promise.all([
    db.order.count({
      where: {
        affiliateId,
        status: "PAID",
        paidAt: { gte: from30 },
      },
    }),
    db.click.count({
      where: {
        affiliateId,
        isUnique: true,
        isBot: false,
        createdAt: { gte: from30 },
      },
    }),
    getBalances(affiliateId, db, now),
    db.order.findMany({
      where: { affiliateId, status: { in: ["PAID", "REFUNDED", "CHARGEDBACK"] } },
      orderBy: { paidAt: "desc" },
      take: 5,
      include: {
        commission: { select: { amountCents: true, status: true, availableAt: true } },
      },
    }),
  ]);

  const conversionRate =
    uniqueClicks30d > 0 ? Math.round((sales30d / uniqueClicks30d) * 10_000) / 100 : 0;

  return {
    sales30d,
    uniqueClicks30d,
    conversionRate,
    balances,
    recentOrders,
    /** Só para tipagem / debug — dia civil SP de referência. */
    asOf: partsInSaoPaulo(now),
  };
}

export async function listAffiliateOrdersForAdmin(affiliateId: string, limit = 50) {
  return db.order.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      commission: { select: { amountCents: true, status: true, availableAt: true } },
      product: { select: { name: true } },
    },
  });
}

export async function listAffiliateCommissionsForAdmin(affiliateId: string, limit = 50) {
  return db.commission.findMany({
    where: { affiliateId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      order: { select: { publicCode: true, productNameSnap: true, id: true } },
    },
  });
}
