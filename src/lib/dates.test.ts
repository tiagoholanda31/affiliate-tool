import { describe, expect, it } from "vitest";

import {
  addHoldDays,
  formatDate,
  formatDateTime,
  formatMonthYear,
  formatRelative,
  nextPayoutDate,
  partsInSaoPaulo,
  startOfDayInSaoPaulo,
  toIsoDate,
} from "@/lib/dates";

describe("formatação no fuso de São Paulo", () => {
  it("formata data e hora convertendo de UTC", () => {
    // 2026-09-05T14:30Z = 11:30 em São Paulo (UTC-3).
    const date = new Date("2026-09-05T14:30:00.000Z");
    expect(formatDate(date)).toBe("05/09/2026");
    expect(formatDateTime(date)).toBe("05/09/2026 11:30");
  });

  it("usa o dia de São Paulo, não o do UTC, perto da meia-noite", () => {
    // 2026-09-06T02:00Z ainda é dia 5 em São Paulo.
    const date = new Date("2026-09-06T02:00:00.000Z");
    expect(formatDate(date)).toBe("05/09/2026");
    expect(toIsoDate(date)).toBe("2026-09-05");
  });

  it("formata mês e ano por extenso", () => {
    expect(formatMonthYear(new Date("2026-09-05T14:30:00.000Z"))).toBe("setembro de 2026");
  });

  it("recusa data inválida em vez de exibir 'Invalid Date'", () => {
    expect(() => formatDate(new Date("não é data"))).toThrow(TypeError);
  });
});

describe("partsInSaoPaulo", () => {
  it("decompõe a data no fuso local", () => {
    expect(partsInSaoPaulo(new Date("2026-09-06T02:00:00.000Z"))).toEqual({
      year: 2026,
      month: 9,
      day: 5,
    });
  });
});

describe("startOfDayInSaoPaulo", () => {
  it("devolve o instante UTC da meia-noite local", () => {
    // Meia-noite de 05/09/2026 em SP (UTC-3) = 03:00Z.
    expect(startOfDayInSaoPaulo(2026, 9, 5).toISOString()).toBe("2026-09-05T03:00:00.000Z");
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-05T12:00:00.000Z");

  it("diz 'agora há pouco' para o passado imediato", () => {
    expect(formatRelative(new Date("2026-09-05T11:59:30.000Z"), now)).toBe("agora há pouco");
  });

  it("usa português para distâncias maiores", () => {
    expect(formatRelative(new Date("2026-09-05T10:00:00.000Z"), now)).toContain("horas");
    expect(formatRelative(new Date("2026-09-03T12:00:00.000Z"), now)).toContain("dias");
  });
});

describe("addHoldDays", () => {
  it("soma a carência da comissão", () => {
    const paidAt = new Date("2026-09-05T14:30:00.000Z");
    expect(addHoldDays(paidAt, 7).toISOString()).toBe("2026-09-12T14:30:00.000Z");
  });

  it("aceita carência zero", () => {
    const paidAt = new Date("2026-09-05T14:30:00.000Z");
    expect(addHoldDays(paidAt, 0).toISOString()).toBe(paidAt.toISOString());
  });

  it("recusa carência negativa ou fracionada", () => {
    const paidAt = new Date("2026-09-05T14:30:00.000Z");
    expect(() => addHoldDays(paidAt, -1)).toThrow(TypeError);
    expect(() => addHoldDays(paidAt, 1.5)).toThrow(TypeError);
  });
});

describe("nextPayoutDate", () => {
  it("usa o mês corrente quando o dia ainda não passou", () => {
    const from = new Date("2026-09-05T12:00:00.000Z"); // dia 5 em SP
    expect(toIsoDate(nextPayoutDate(10, from))).toBe("2026-09-10");
  });

  it("inclui o próprio dia do pagamento", () => {
    const from = new Date("2026-09-10T12:00:00.000Z");
    expect(toIsoDate(nextPayoutDate(10, from))).toBe("2026-09-10");
  });

  it("passa para o mês seguinte quando o dia já passou", () => {
    const from = new Date("2026-09-11T12:00:00.000Z");
    expect(toIsoDate(nextPayoutDate(10, from))).toBe("2026-10-10");
  });

  it("vira o ano em dezembro", () => {
    const from = new Date("2026-12-20T12:00:00.000Z");
    expect(toIsoDate(nextPayoutDate(10, from))).toBe("2027-01-10");
  });

  it("ajusta para o último dia em meses curtos", () => {
    const from = new Date("2027-02-01T12:00:00.000Z");
    expect(toIsoDate(nextPayoutDate(31, from))).toBe("2027-02-28");

    const bissexto = new Date("2028-02-01T12:00:00.000Z");
    expect(toIsoDate(nextPayoutDate(31, bissexto))).toBe("2028-02-29");
  });

  it("devolve a meia-noite de São Paulo", () => {
    const from = new Date("2026-09-05T12:00:00.000Z");
    expect(nextPayoutDate(10, from).toISOString()).toBe("2026-09-10T03:00:00.000Z");
  });

  it("recusa dia fora de 1..31", () => {
    expect(() => nextPayoutDate(0)).toThrow(RangeError);
    expect(() => nextPayoutDate(32)).toThrow(RangeError);
    expect(() => nextPayoutDate(10.5)).toThrow(RangeError);
  });
});
