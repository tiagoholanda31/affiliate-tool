import { describe, expect, it } from "vitest";

import {
  applyPercent,
  bpFromPercent,
  calculateCommission,
  formatAmount,
  formatBRL,
  formatCommissionPreview,
  formatPercent,
  parseBRL,
  percentFromBp,
  roundHalfEven,
  sumCents,
} from "@/lib/money";

// `Intl` usa espaço não separável (U+00A0) entre "R$" e o número.
const nbsp = " ";

describe("formatBRL", () => {
  it("formata centavos no padrão pt-BR", () => {
    expect(formatBRL(123456)).toBe(`R$${nbsp}1.234,56`);
    expect(formatBRL(0)).toBe(`R$${nbsp}0,00`);
    expect(formatBRL(5)).toBe(`R$${nbsp}0,05`);
    expect(formatBRL(100)).toBe(`R$${nbsp}1,00`);
  });

  it("formata valores negativos (estorno)", () => {
    expect(formatBRL(-2500)).toBe(`-R$${nbsp}25,00`);
  });

  it("recusa valores não inteiros — dinheiro nunca é Float", () => {
    expect(() => formatBRL(12.5)).toThrow(TypeError);
  });
});

describe("formatAmount", () => {
  it("formata sem o símbolo da moeda", () => {
    expect(formatAmount(123456)).toBe("1.234,56");
    expect(formatAmount(99)).toBe("0,99");
  });
});

describe("parseBRL", () => {
  it("lê valores digitados pelo usuário", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(123456);
    expect(parseBRL("1234,56")).toBe(123456);
    expect(parseBRL("1234.56")).toBe(123456);
    expect(parseBRL("0,05")).toBe(5);
    expect(parseBRL("  R$ 89,90 ")).toBe(8990);
  });

  it("trata valor sem casas decimais como reais inteiros", () => {
    expect(parseBRL("1234")).toBe(123400);
    expect(parseBRL("7")).toBe(700);
  });

  it("distingue separador de milhar de separador decimal", () => {
    // Três dígitos após o ponto: é milhar, não decimal.
    expect(parseBRL("1.234")).toBe(123400);
    expect(parseBRL("1.234.567,89")).toBe(123456789);
  });

  it("lê valores negativos", () => {
    expect(parseBRL("-25,00")).toBe(-2500);
  });

  it("devolve null quando não há número", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("R$")).toBeNull();
  });

  it("faz ida e volta com formatBRL", () => {
    for (const cents of [0, 1, 99, 100, 12345, 999999999]) {
      expect(parseBRL(formatBRL(cents))).toBe(cents);
    }
  });
});

describe("roundHalfEven", () => {
  it("desempata para o par mais próximo", () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
    expect(roundHalfEven(-1.5)).toBe(-2);
    expect(roundHalfEven(-2.5)).toBe(-2);
  });

  it("arredonda normalmente fora do empate", () => {
    expect(roundHalfEven(1.4)).toBe(1);
    expect(roundHalfEven(1.6)).toBe(2);
    expect(roundHalfEven(-1.4)).toBe(-1);
    expect(roundHalfEven(-1.6)).toBe(-2);
  });

  it("não distorce empates por erro de ponto flutuante", () => {
    // 100.49999999999999 na aritmética binária, mas conceitualmente 100,5.
    expect(roundHalfEven(1.005 * 100)).toBe(100);
  });

  it("recusa valores não finitos", () => {
    expect(() => roundHalfEven(Number.NaN)).toThrow(TypeError);
    expect(() => roundHalfEven(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe("applyPercent", () => {
  it("calcula comissão em basis points", () => {
    // 15% de R$ 100,00
    expect(applyPercent(10000, 1500)).toBe(1500);
    // 20% de R$ 249,90 = R$ 49,98
    expect(applyPercent(24990, 2000)).toBe(4998);
    // 12,5% de R$ 80,00 = R$ 10,00
    expect(applyPercent(8000, 1250)).toBe(1000);
  });

  it("arredonda meio centavo para o par (sem viés a favor de um lado)", () => {
    // 50% de 1 centavo = 0,5 → 0
    expect(applyPercent(1, 5000)).toBe(0);
    // 50% de 3 centavos = 1,5 → 2
    expect(applyPercent(3, 5000)).toBe(2);
    // 50% de 5 centavos = 2,5 → 2
    expect(applyPercent(5, 5000)).toBe(2);
  });

  it("trata 0% e 100%", () => {
    expect(applyPercent(12345, 0)).toBe(0);
    expect(applyPercent(12345, 10000)).toBe(12345);
  });

  it("recusa entradas não inteiras", () => {
    expect(() => applyPercent(100.5, 1500)).toThrow(TypeError);
    expect(() => applyPercent(100, 15.5)).toThrow(TypeError);
  });
});

describe("calculateCommission", () => {
  it("PERCENT usa applyPercent", () => {
    expect(calculateCommission({ type: "PERCENT", value: 1500, priceCents: 20000 })).toBe(3000);
  });

  it("FIXED devolve o valor em centavos", () => {
    expect(calculateCommission({ type: "FIXED", value: 2500, priceCents: 20000 })).toBe(2500);
  });

  it("FIXED não pode exceder o preço", () => {
    expect(() => calculateCommission({ type: "FIXED", value: 30000, priceCents: 20000 })).toThrow(
      RangeError,
    );
  });

  it("formatCommissionPreview descreve percentual e fixo", () => {
    const nbsp = " ";
    expect(formatCommissionPreview({ type: "PERCENT", value: 1500, priceCents: 20000 })).toBe(
      `15% · R$${nbsp}30,00 em R$${nbsp}200,00`,
    );
    expect(formatCommissionPreview({ type: "FIXED", value: 3000, priceCents: 20000 })).toBe(
      `R$${nbsp}30,00 fixos em R$${nbsp}200,00`,
    );
  });
});

describe("percentFromBp / bpFromPercent / formatPercent", () => {
  it("converte nos dois sentidos", () => {
    expect(percentFromBp(1500)).toBe(15);
    expect(percentFromBp(1550)).toBe(15.5);
    expect(bpFromPercent(15)).toBe(1500);
    expect(bpFromPercent(15.5)).toBe(1550);
  });

  it("formata para exibição", () => {
    expect(formatPercent(1500)).toBe("15%");
    expect(formatPercent(1550)).toBe("15,5%");
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("sumCents", () => {
  it("soma listas de centavos", () => {
    expect(sumCents([100, 250, 5])).toBe(355);
    expect(sumCents([])).toBe(0);
  });

  it("recusa valores não inteiros na lista", () => {
    expect(() => sumCents([100, 0.5])).toThrow(TypeError);
  });
});
