import { describe, expect, it } from "vitest";

import {
  calculateCommission,
  previewCommission,
} from "@/features/commissions/service";
import { addHoldDays, nextPayoutDate } from "@/lib/dates";

describe("calculateCommission", () => {
  it("PERCENT 15% sobre R$ 199,90 → R$ 29,98 (half-even em 2998,5)", () => {
    // 19990 * 1500 / 10000 = 2998,5 → par mais próximo = 2998 (não half-up 2999).
    expect(calculateCommission(19_990, { type: "PERCENT", value: 1500 })).toBe(2998);
  });

  it("FIXED maior que a base → min(fixed, base)", () => {
    expect(calculateCommission(1000, { type: "FIXED", value: 1500 })).toBe(1000);
  });

  it("FIXED menor ou igual à base", () => {
    expect(calculateCommission(5000, { type: "FIXED", value: 1000 })).toBe(1000);
  });

  it("nunca negativa", () => {
    expect(calculateCommission(0, { type: "PERCENT", value: 1500 })).toBe(0);
    expect(calculateCommission(100, { type: "FIXED", value: 0 })).toBe(0);
  });

  it("PERCENT 10% half-even em casos de empate", () => {
    // 15 * 10% = 1.5 → half-even → 2 (ímpar sobe)
    expect(calculateCommission(15, { type: "PERCENT", value: 1000 })).toBe(2);
    // 25 * 10% = 2.5 → half-even → 2 (par fica)
    expect(calculateCommission(25, { type: "PERCENT", value: 1000 })).toBe(2);
  });
});

describe("previewCommission / holdDays", () => {
  it("availableAt = paidAt + holdDays", () => {
    const paidAt = new Date("2026-09-01T15:00:00.000Z");
    const preview = previewCommission(
      10_000,
      { type: "PERCENT", value: 1500 },
      paidAt,
      7,
    );
    expect(preview.amountCents).toBe(1500);
    expect(preview.availableAt.toISOString()).toBe(addHoldDays(paidAt, 7).toISOString());
  });
});

describe("nextPayoutDate (contrato getBalances)", () => {
  it("usa o dia configurado neste mês ou no próximo", () => {
    const from = new Date("2026-09-05T15:00:00.000Z"); // dia 5 em SP
    const next = nextPayoutDate(10, from);
    expect(next.toISOString()).toBe("2026-09-10T03:00:00.000Z"); // meia-noite SP

    const after = new Date("2026-09-15T15:00:00.000Z");
    const nextMonth = nextPayoutDate(10, after);
    expect(nextMonth.toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });
});
