/**
 * Agregações do dashboard admin — cache 60 s (tag `dashboard`).
 */
import { unstable_cache } from "next/cache";

import {
  daysAgoStart,
  emptyDailySeries,
  funnelRates,
  isAnomalousConversion,
  monthBoundsInSaoPaulo,
  trendBps,
} from "@/features/dashboard/aggregations";
import { getPayoutDashboardSummary } from "@/features/payouts/queries";
import { toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";

export type DashboardKpi = {
  value: number;
  previous: number;
  trendBps: number;
};

export type AdminDashboardKpis = {
  salesCount: DashboardKpi;
  revenueCents: DashboardKpi;
  commissionsGeneratedCents: DashboardKpi;
  commissionsPayableCents: number;
};

export type RevenueCommissionsDay = {
  date: string;
  revenueCents: number;
  commissionsCents: number;
};

export type FunnelSnapshot = {
  clicks: number;
  orders: number;
  paid: number;
  clickToOrderBps: number;
  orderToPaidBps: number;
  clickToPaidBps: number;
};

export type RankingRow = {
  id: string;
  label: string;
  sublabel: string | null;
  revenueCents: number;
  href: string;
};

export type PendenciasSnapshot = {
  pendingAffiliates: number;
  affiliatesWithBalance: number;
  totalAvailableCents: number;
  failedWebhooks: number;
  failedJobs7d: number;
};

export type AntifraudAlert = {
  kind: "clicks_burst" | "anomalous_conversion" | "suspicious_order";
  title: string;
  detail: string;
  href: string;
};

export type AdminDashboardData = {
  kpis: AdminDashboardKpis;
  series90d: RevenueCommissionsDay[];
  funnel: FunnelSnapshot;
  topAffiliates: RankingRow[];
  topProducts: RankingRow[];
  pendencias: PendenciasSnapshot;
  antifraud: AntifraudAlert[];
};

async function monthPaidAgg(from: Date, to: Date) {
  return db.order.aggregate({
    where: {
      status: "PAID",
      paidAt: { gte: from, lt: to },
    },
    _count: { _all: true },
    _sum: { amountCents: true },
  });
}

async function monthCommissionsGenerated(from: Date, to: Date) {
  const agg = await db.commission.aggregate({
    where: { createdAt: { gte: from, lt: to } },
    _sum: { amountCents: true },
  });
  return agg._sum.amountCents ?? 0;
}

async function loadKpis(now: Date): Promise<AdminDashboardKpis> {
  const bounds = monthBoundsInSaoPaulo(now);
  const [curPaid, prevPaid, curComm, prevComm, payoutSummary] = await Promise.all([
    monthPaidAgg(bounds.currentStart, bounds.currentEnd),
    monthPaidAgg(bounds.previousStart, bounds.previousEnd),
    monthCommissionsGenerated(bounds.currentStart, bounds.currentEnd),
    monthCommissionsGenerated(bounds.previousStart, bounds.previousEnd),
    getPayoutDashboardSummary(),
  ]);

  const curSales = curPaid._count._all;
  const prevSales = prevPaid._count._all;
  const curRevenue = curPaid._sum.amountCents ?? 0;
  const prevRevenue = prevPaid._sum.amountCents ?? 0;

  return {
    salesCount: {
      value: curSales,
      previous: prevSales,
      trendBps: trendBps(curSales, prevSales),
    },
    revenueCents: {
      value: curRevenue,
      previous: prevRevenue,
      trendBps: trendBps(curRevenue, prevRevenue),
    },
    commissionsGeneratedCents: {
      value: curComm,
      previous: prevComm,
      trendBps: trendBps(curComm, prevComm),
    },
    commissionsPayableCents: payoutSummary.totalAvailableCents,
  };
}

async function loadSeries90d(now: Date): Promise<RevenueCommissionsDay[]> {
  const start = daysAgoStart(89, now);
  const [orders, commissions] = await Promise.all([
    db.order.findMany({
      where: { status: "PAID", paidAt: { gte: start } },
      select: { paidAt: true, amountCents: true },
    }),
    db.commission.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, amountCents: true },
    }),
  ]);

  const series = emptyDailySeries(90, now);
  for (const order of orders) {
    if (!order.paidAt) continue;
    const key = toIsoDate(order.paidAt);
    const bucket = series.get(key);
    if (bucket) bucket.revenueCents += order.amountCents;
  }
  for (const c of commissions) {
    const key = toIsoDate(c.createdAt);
    const bucket = series.get(key);
    if (bucket) bucket.commissionsCents += c.amountCents;
  }

  return [...series.entries()].map(([date, v]) => ({
    date,
    revenueCents: v.revenueCents,
    commissionsCents: v.commissionsCents,
  }));
}

async function loadFunnel(now: Date): Promise<FunnelSnapshot> {
  const start = daysAgoStart(29, now);
  const [clicks, orders, paid] = await Promise.all([
    db.click.count({ where: { isBot: false, createdAt: { gte: start } } }),
    db.order.count({
      where: {
        affiliateId: { not: null },
        createdAt: { gte: start },
      },
    }),
    db.order.count({
      where: {
        status: "PAID",
        affiliateId: { not: null },
        paidAt: { gte: start },
      },
    }),
  ]);
  const rates = funnelRates(clicks, orders, paid);
  return { clicks, orders, paid, ...rates };
}

async function loadTopAffiliates(now: Date, limit = 5): Promise<RankingRow[]> {
  const start = daysAgoStart(29, now);
  const grouped = await db.order.groupBy({
    by: ["affiliateId"],
    where: {
      status: "PAID",
      affiliateId: { not: null },
      paidAt: { gte: start },
    },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
    take: limit,
  });

  const ids = grouped
    .map((g) => g.affiliateId)
    .filter((id): id is string => typeof id === "string");
  if (ids.length === 0) return [];

  const affiliates = await db.affiliate.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      code: true,
      user: { select: { name: true } },
    },
  });
  const byId = new Map(affiliates.map((a) => [a.id, a]));

  return grouped.flatMap((g) => {
      const id = g.affiliateId;
      if (!id) return [];
      const a = byId.get(id);
      if (!a) return [];
      return [
        {
          id,
          label: a.user.name,
          sublabel: a.code ? `@${a.code}` : null,
          revenueCents: g._sum.amountCents ?? 0,
          href: `/admin/afiliados/${id}`,
        },
      ];
    });
}

async function loadTopProducts(now: Date, limit = 5): Promise<RankingRow[]> {
  const start = daysAgoStart(29, now);
  const grouped = await db.order.groupBy({
    by: ["productId"],
    where: { status: "PAID", paidAt: { gte: start } },
    _sum: { amountCents: true },
    orderBy: { _sum: { amountCents: "desc" } },
    take: limit,
  });

  const ids = grouped.map((g) => g.productId);
  if (ids.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return grouped.flatMap((g) => {
    const p = byId.get(g.productId);
    if (!p) return [];
    return [
      {
        id: p.id,
        label: p.name,
        sublabel: p.slug,
        revenueCents: g._sum.amountCents ?? 0,
        href: `/admin/produtos/${p.id}`,
      },
    ];
  });
}

async function loadPendencias(): Promise<PendenciasSnapshot> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [pendingAffiliates, payoutSummary, failedWebhooks, failedJobs7d] = await Promise.all([
    db.affiliate.count({ where: { status: "PENDING" } }),
    getPayoutDashboardSummary(),
    db.webhookEvent.count({ where: { status: "FAILED" } }),
    db.jobRun.count({ where: { ok: false, startedAt: { gte: weekAgo } } }),
  ]);

  return {
    pendingAffiliates,
    affiliatesWithBalance: payoutSummary.affiliatesWithBalance,
    totalAvailableCents: payoutSummary.totalAvailableCents,
    failedWebhooks,
    failedJobs7d,
  };
}

async function loadAntifraud(now: Date): Promise<AntifraudAlert[]> {
  const alerts: AntifraudAlert[] = [];
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = daysAgoStart(6, now);
  const conversionStart = daysAgoStart(29, now);

  const [clicks24h, uniqueClicks, paidByAff, suspiciousOrders] = await Promise.all([
    db.click.groupBy({
      by: ["affiliateId"],
      where: { isBot: false, createdAt: { gte: last24h } },
      _count: { _all: true },
    }),
    db.click.groupBy({
      by: ["affiliateId"],
      where: {
        isBot: false,
        isUnique: true,
        createdAt: { gte: conversionStart },
      },
      _count: { _all: true },
    }),
    db.order.groupBy({
      by: ["affiliateId"],
      where: {
        status: "PAID",
        affiliateId: { not: null },
        paidAt: { gte: conversionStart },
      },
      _count: { _all: true },
    }),
    db.order.findMany({
      where: {
        createdAt: { gte: last7d },
        metadata: { path: ["suspicious"], equals: true },
      },
      select: {
        id: true,
        publicCode: true,
        affiliateId: true,
        productNameSnap: true,
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const burstSource = clicks24h.filter((r) => r._count._all > 500);
  const anomalousIds: string[] = [];
  const clicksMap = new Map(uniqueClicks.map((r) => [r.affiliateId, r._count._all]));
  const paidMap = new Map(
    paidByAff
      .filter((r): r is typeof r & { affiliateId: string } => r.affiliateId != null)
      .map((r) => [r.affiliateId, r._count._all]),
  );
  for (const [affiliateId, clicks] of clicksMap) {
    const paid = paidMap.get(affiliateId) ?? 0;
    if (isAnomalousConversion(paid, clicks)) anomalousIds.push(affiliateId);
  }

  const nameIds = [...new Set([...burstSource.map((r) => r.affiliateId), ...anomalousIds])];
  const affiliates =
    nameIds.length === 0
      ? []
      : await db.affiliate.findMany({
          where: { id: { in: nameIds } },
          select: { id: true, code: true, user: { select: { name: true } } },
        });
  const byId = new Map(affiliates.map((a) => [a.id, a]));

  for (const row of burstSource) {
    const a = byId.get(row.affiliateId);
    const name = a?.user.name ?? "Afiliado";
    const code = a?.code ? ` (@${a.code})` : "";
    alerts.push({
      kind: "clicks_burst",
      title: `Pico de cliques: ${name}${code}`,
      detail: `${row._count._all.toLocaleString("pt-BR")} cliques nas últimas 24 h`,
      href: `/admin/afiliados/${row.affiliateId}`,
    });
  }

  for (const id of anomalousIds) {
    const a = byId.get(id);
    if (!a) continue;
    const clicks = clicksMap.get(id) ?? 0;
    const paid = paidMap.get(id) ?? 0;
    const rate = clicks > 0 ? ((paid / clicks) * 100).toFixed(0) : "0";
    alerts.push({
      kind: "anomalous_conversion",
      title: `Conversão anômala: ${a.user.name}${a.code ? ` (@${a.code})` : ""}`,
      detail: `${String(paid)} vendas / ${String(clicks)} cliques únicos (${rate}%) nos últimos 30 dias`,
      href: `/admin/afiliados/${id}`,
    });
  }

  for (const order of suspiciousOrders) {
    alerts.push({
      kind: "suspicious_order",
      title: `Pedido suspeito ${order.publicCode}`,
      detail: order.productNameSnap,
      href: order.affiliateId
        ? `/admin/afiliados/${order.affiliateId}`
        : `/admin/vendas/${order.id}`,
    });
  }

  return alerts.slice(0, 30);
}

async function loadAdminDashboardUncached(): Promise<AdminDashboardData> {
  const now = new Date();
  const [kpis, series90d, funnel, topAffiliates, topProducts, pendencias, antifraud] =
    await Promise.all([
      loadKpis(now),
      loadSeries90d(now),
      loadFunnel(now),
      loadTopAffiliates(now),
      loadTopProducts(now),
      loadPendencias(),
      loadAntifraud(now),
    ]);

  return { kpis, series90d, funnel, topAffiliates, topProducts, pendencias, antifraud };
}

export function getAdminDashboard(): Promise<AdminDashboardData> {
  const cached = unstable_cache(loadAdminDashboardUncached, ["admin-dashboard"], {
    revalidate: 60,
    tags: ["dashboard"],
  });
  return cached();
}
