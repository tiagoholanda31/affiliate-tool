import { describe, expect, it } from "vitest";

import {
  funnelRates,
  isAnomalousConversion,
  monthBoundsInSaoPaulo,
  trendBps,
} from "@/features/dashboard/aggregations";

describe("monthBoundsInSaoPaulo", () => {
  it("calcula mês corrente e anterior em SP", () => {
    // 10/09/2026 15:00 UTC = 12:00 SP
    const now = new Date("2026-09-10T15:00:00.000Z");
    const bounds = monthBoundsInSaoPaulo(now);
    expect(bounds.currentStart.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(bounds.currentEnd.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(bounds.previousStart.toISOString()).toBe("2026-08-01T03:00:00.000Z");
    expect(bounds.previousEnd.toISOString()).toBe(bounds.currentStart.toISOString());
  });

  it("cruza virada de ano", () => {
    const now = new Date("2026-01-15T15:00:00.000Z");
    const bounds = monthBoundsInSaoPaulo(now);
    expect(bounds.currentStart.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(bounds.previousStart.toISOString()).toBe("2025-12-01T03:00:00.000Z");
  });
});

describe("trendBps", () => {
  it("calcula variação em basis points", () => {
    expect(trendBps(110, 100)).toBe(1000); // +10%
    expect(trendBps(90, 100)).toBe(-1000);
    expect(trendBps(0, 0)).toBe(0);
    expect(trendBps(50, 0)).toBe(10_000);
    expect(trendBps(0, 50)).toBe(-10_000);
  });
});

describe("funnelRates", () => {
  it("calcula taxas do funil", () => {
    const rates = funnelRates(1000, 100, 40);
    expect(rates.clickToOrderBps).toBe(1000); // 10%
    expect(rates.orderToPaidBps).toBe(4000); // 40%
    expect(rates.clickToPaidBps).toBe(400); // 4%
  });

  it("retorna 0 quando denominador é zero", () => {
    expect(funnelRates(0, 0, 0)).toEqual({
      clickToOrderBps: 0,
      orderToPaidBps: 0,
      clickToPaidBps: 0,
    });
  });
});

describe("isAnomalousConversion", () => {
  it("exige mínimo de cliques e taxa > 50%", () => {
    expect(isAnomalousConversion(15, 20)).toBe(true); // 75%
    expect(isAnomalousConversion(9, 20)).toBe(false); // 45%
    expect(isAnomalousConversion(10, 19)).toBe(false); // < 20 cliques
  });
});
