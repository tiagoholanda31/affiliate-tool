import { describe, expect, it } from "vitest";

import {
  assertPaidAtNotFuture,
  computePayoutTotal,
} from "@/features/payouts/service";
import { AppError } from "@/lib/errors";
import { startOfDayInSaoPaulo } from "@/lib/dates";

describe("computePayoutTotal", () => {
  it("soma comissões e ajustes (ajustes negativos abatem)", () => {
    expect(
      computePayoutTotal(
        [{ amountCents: 3000 }, { amountCents: 2000 }],
        [{ amountCents: -500 }],
      ),
    ).toBe(4500);
  });

  it("aceita total zero (validação de negócio fica no draft)", () => {
    expect(computePayoutTotal([{ amountCents: 1000 }], [{ amountCents: -1000 }])).toBe(0);
  });
});

describe("assertPaidAtNotFuture", () => {
  const now = startOfDayInSaoPaulo(2026, 9, 10);

  it("aceita hoje e ontem", () => {
    expect(() => { assertPaidAtNotFuture(startOfDayInSaoPaulo(2026, 9, 10), now); }).not.toThrow();
    expect(() => { assertPaidAtNotFuture(startOfDayInSaoPaulo(2026, 9, 9), now); }).not.toThrow();
  });

  it("rejeita data futura", () => {
    expect(() => { assertPaidAtNotFuture(startOfDayInSaoPaulo(2026, 9, 11), now); }).toThrow(
      AppError,
    );
  });
});
