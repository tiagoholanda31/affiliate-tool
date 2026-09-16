/**
 * Queries de cliques para o painel do afiliado e admin.
 * Cache 60 s por afiliado (fatia 04).
 */
import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";
import { partsInSaoPaulo, startOfDayInSaoPaulo, toIsoDate } from "@/lib/dates";

function daysAgoStart(days: number, now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const p = partsInSaoPaulo(shifted);
  return startOfDayInSaoPaulo(p.year, p.month, p.day);
}

export type ClickKpis = {
  today: number;
  last7d: number;
  last30d: number;
  unique30d: number;
};

export type ClicksByDay = {
  date: string;
  total: number;
  unique: number;
};

export type TopClickedProduct = {
  productId: string;
  name: string;
  slug: string;
  clicks: number;
};

async function loadClickKpis(affiliateId: string, now: Date): Promise<ClickKpis> {
  const startToday = daysAgoStart(0, now);
  const start7 = daysAgoStart(6, now);
  const start30 = daysAgoStart(29, now);

  const base = { affiliateId, isBot: false };

  const [today, last7d, last30d, unique30d] = await Promise.all([
    db.click.count({ where: { ...base, createdAt: { gte: startToday } } }),
    db.click.count({ where: { ...base, createdAt: { gte: start7 } } }),
    db.click.count({ where: { ...base, createdAt: { gte: start30 } } }),
    db.click.count({
      where: { ...base, isUnique: true, createdAt: { gte: start30 } },
    }),
  ]);

  return { today, last7d, last30d, unique30d };
}

async function loadClicksByDay(affiliateId: string, now: Date): Promise<ClicksByDay[]> {
  const start30 = daysAgoStart(29, now);
  const clicks = await db.click.findMany({
    where: {
      affiliateId,
      isBot: false,
      createdAt: { gte: start30 },
    },
    select: { createdAt: true, isUnique: true },
  });

  const byDay = new Map<string, { total: number; unique: number }>();
  for (let i = 29; i >= 0; i -= 1) {
    const d = daysAgoStart(i, now);
    byDay.set(toIsoDate(d), { total: 0, unique: 0 });
  }

  for (const click of clicks) {
    const key = toIsoDate(click.createdAt);
    const bucket = byDay.get(key);
    if (!bucket) continue;
    bucket.total += 1;
    if (click.isUnique) bucket.unique += 1;
  }

  return [...byDay.entries()].map(([date, counts]) => ({
    date,
    total: counts.total,
    unique: counts.unique,
  }));
}

async function loadTopClickedProducts(
  affiliateId: string,
  now: Date,
  limit = 5,
): Promise<TopClickedProduct[]> {
  const start30 = daysAgoStart(29, now);

  const grouped = await db.click.groupBy({
    by: ["productId"],
    where: {
      affiliateId,
      isBot: false,
      productId: { not: null },
      createdAt: { gte: start30 },
    },
    _count: { _all: true },
    orderBy: { _count: { productId: "desc" } },
    take: limit,
  });

  const productIds = grouped
    .map((g) => g.productId)
    .filter((id): id is string => typeof id === "string");

  if (productIds.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  return grouped
    .map((g) => {
      const product = g.productId ? byId.get(g.productId) : undefined;
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        clicks: g._count._all,
      };
    })
    .filter((row): row is TopClickedProduct => row !== null);
}

export type AffiliateClickDashboard = {
  kpis: ClickKpis;
  byDay: ClicksByDay[];
  topProducts: TopClickedProduct[];
};

export function getAffiliateClickDashboard(
  affiliateId: string,
): Promise<AffiliateClickDashboard> {
  const cached = unstable_cache(
    async () => {
      const now = new Date();
      const [kpis, byDay, topProducts] = await Promise.all([
        loadClickKpis(affiliateId, now),
        loadClicksByDay(affiliateId, now),
        loadTopClickedProducts(affiliateId, now),
      ]);
      return { kpis, byDay, topProducts };
    },
    [`affiliate-clicks-${affiliateId}`],
    { revalidate: 60, tags: [`affiliate-clicks-${affiliateId}`] },
  );
  return cached();
}

/** Cliques (não-bot) dos últimos 30 dias — coluna admin. */
export async function getClicks30dByAffiliateIds(
  affiliateIds: string[],
): Promise<Map<string, number>> {
  if (affiliateIds.length === 0) return new Map();

  const start30 = daysAgoStart(29);
  const grouped = await db.click.groupBy({
    by: ["affiliateId"],
    where: {
      affiliateId: { in: affiliateIds },
      isBot: false,
      createdAt: { gte: start30 },
    },
    _count: { _all: true },
  });

  const map = new Map<string, number>();
  for (const id of affiliateIds) map.set(id, 0);
  for (const g of grouped) {
    map.set(g.affiliateId, g._count._all);
  }
  return map;
}

export async function getAffiliateClicks30d(affiliateId: string): Promise<number> {
  const map = await getClicks30dByAffiliateIds([affiliateId]);
  return map.get(affiliateId) ?? 0;
}

/** Resolve afiliado por código com cache em memória (60 s). */
const affiliateCodeCache = new Map<string, { expiresAt: number; value: AffiliateCodeRow | null }>();
const AFFILIATE_CODE_TTL_MS = 60_000;

type AffiliateCodeRow = {
  id: string;
  code: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "REMOVED";
};

export async function getAffiliateByCodeCached(code: string): Promise<AffiliateCodeRow | null> {
  const now = Date.now();
  const hit = affiliateCodeCache.get(code);
  if (hit && hit.expiresAt > now) return hit.value;

  const value = await db.affiliate.findFirst({
    where: { code },
    select: { id: true, code: true, status: true },
  });

  affiliateCodeCache.set(code, { expiresAt: now + AFFILIATE_CODE_TTL_MS, value });
  return value;
}

/** Só para testes — esvazia o cache de código. */
export function clearAffiliateCodeCache(): void {
  affiliateCodeCache.clear();
}
