import { describe, expect, it } from "vitest";

import {
  AA_LARGE_TEXT,
  AA_NORMAL_TEXT,
  CONTRAST_PAIRS,
  contrastRatio,
  COLORS,
  minimumRatio,
  relativeLuminance,
} from "@/lib/design-tokens";

describe("contrastRatio", () => {
  it("bate com os valores de referência da WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    // Cinza web padrão sobre branco: 4,54:1 (referência conhecida).
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 1);
  });

  it("é simétrico — a ordem das cores não importa", () => {
    expect(contrastRatio(COLORS.navy900, COLORS.white)).toBeCloseTo(
      contrastRatio(COLORS.white, COLORS.navy900),
      10,
    );
  });

  it("aceita hexadecimal de 3 dígitos", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
  });

  it("recusa cor inválida em vez de calcular errado", () => {
    expect(() => relativeLuminance("azul")).toThrow(TypeError);
    expect(() => relativeLuminance("#12345")).toThrow(TypeError);
  });
});

describe("pares de cor da interface", () => {
  // Este teste é a "ferramenta de verificação" pedida na fatia 00: se alguém
  // mexer num token e quebrar o contraste, `pnpm check` falha.
  it.each(CONTRAST_PAIRS.map((pair) => [pair.name, pair] as const))(
    "%s atende AA",
    (_name, pair) => {
      expect(pair.ratio).toBeGreaterThanOrEqual(minimumRatio(pair));
    },
  );

  it("usa os mínimos corretos da WCAG", () => {
    expect(AA_NORMAL_TEXT).toBe(4.5);
    expect(AA_LARGE_TEXT).toBe(3);
  });

  it("só o KPI dourado depende da regra de texto grande", () => {
    const large = CONTRAST_PAIRS.filter((pair) => pair.large).map((pair) => pair.name);
    expect(large).toEqual(["KPI dourado"]);
  });

  it("confirma por que existe o gold-700", () => {
    // gold-500 e gold-600 não atingem AA sobre branco em tamanho nenhum —
    // nem os 3:1 de texto grande. Por isso texto dourado sobre claro usa gold-700.
    expect(contrastRatio(COLORS.gold500, COLORS.white)).toBeLessThan(AA_LARGE_TEXT);
    expect(contrastRatio(COLORS.gold600, COLORS.white)).toBeLessThan(AA_LARGE_TEXT);
    expect(contrastRatio(COLORS.gold700, COLORS.white)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });
});
