/**
 * Helpers puros do dashboard admin (sem I/O) — testáveis em isolação.
 */
import { partsInSaoPaulo, startOfDayInSaoPaulo, toIsoDate } from "@/lib/dates";

/** Início do dia em SP deslocado N dias a partir de `now` (0 = hoje). */
export function daysAgoStart(days: number, now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const p = partsInSaoPaulo(shifted);
  return startOfDayInSaoPaulo(p.year, p.month, p.day);
}

export type MonthBounds = {
  /** Meia-noite SP do dia 1 do mês corrente. */
  currentStart: Date;
  /** Meia-noite SP do dia 1 do mês seguinte (exclusive end). */
  currentEnd: Date;
  /** Meia-noite SP do dia 1 do mês anterior. */
  previousStart: Date;
  /** = currentStart (exclusive end do mês anterior). */
  previousEnd: Date;
};

/** Limites do mês corrente e anterior no fuso America/Sao_Paulo. */
export function monthBoundsInSaoPaulo(now: Date = new Date()): MonthBounds {
  const { year, month } = partsInSaoPaulo(now);
  const currentStart = startOfDayInSaoPaulo(year, month, 1);
  const currentEnd =
    month === 12
      ? startOfDayInSaoPaulo(year + 1, 1, 1)
      : startOfDayInSaoPaulo(year, month + 1, 1);

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const previousStart = startOfDayInSaoPaulo(prevYear, prevMonth, 1);
  const previousEnd = currentStart;

  return { currentStart, currentEnd, previousStart, previousEnd };
}

/**
 * Variação percentual em basis points: ((current - previous) / previous) * 10_000.
 * previous=0 → 0 se current=0; +10_000 se current>0; −10_000 se current<0.
 */
export function trendBps(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return current > 0 ? 10_000 : -10_000;
  }
  return Math.round(((current - previous) / previous) * 10_000);
}

export type FunnelRates = {
  /** Pedidos / cliques (bps). */
  clickToOrderBps: number;
  /** Pagos / pedidos (bps). */
  orderToPaidBps: number;
  /** Pagos / cliques (bps). */
  clickToPaidBps: number;
};

/** Taxas do funil cliques → pedidos → pagos, em basis points. */
export function funnelRates(clicks: number, orders: number, paid: number): FunnelRates {
  return {
    clickToOrderBps: rateBps(orders, clicks),
    orderToPaidBps: rateBps(paid, orders),
    clickToPaidBps: rateBps(paid, clicks),
  };
}

function rateBps(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10_000);
}

/** Preenche série diária contínua (ISO YYYY-MM-DD em SP) com zeros. */
export function emptyDailySeries(
  days: number,
  now: Date = new Date(),
): Map<string, { revenueCents: number; commissionsCents: number }> {
  const map = new Map<string, { revenueCents: number; commissionsCents: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    map.set(toIsoDate(daysAgoStart(i, now)), { revenueCents: 0, commissionsCents: 0 });
  }
  return map;
}

/** Conversão anômala: paidOrders/uniqueClicks > threshold com mínimo de cliques. */
export function isAnomalousConversion(
  paidOrders: number,
  uniqueClicks: number,
  opts: { minClicks?: number; maxRate?: number } = {},
): boolean {
  const minClicks = opts.minClicks ?? 20;
  const maxRate = opts.maxRate ?? 0.5;
  if (uniqueClicks < minClicks) return false;
  return paidOrders / uniqueClicks > maxRate;
}
