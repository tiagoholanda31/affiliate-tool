/**
 * Dinheiro e percentuais.
 *
 * Regra do CLAUDE.md: valores sempre em **centavos** (`Int`) e percentuais em
 * **basis points** (1500 = 15,00%). Nada de `Float` — 0.1 + 0.2 não é 0.3 e uma
 * comissão errada por um centavo vira suporte.
 */

/** Formata centavos como moeda pt-BR: 123456 → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  assertSafeInteger(cents, "cents");
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

/**
 * Formata centavos sem o símbolo: 123456 → "1.234,56".
 * Útil quando o "R$" já aparece separado (ex. KPI com moeda em texto menor).
 */
export function formatAmount(cents: number): string {
  assertSafeInteger(cents, "cents");
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Lê um valor digitado em pt-BR e devolve centavos.
 * Aceita "R$ 1.234,56", "1234,56", "1234.56" e "1234".
 * Devolve `null` quando não há número reconhecível.
 */
export function parseBRL(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (cleaned === "" || cleaned === "-") return null;

  const negative = cleaned.startsWith("-");
  const digitsOnly = cleaned.replace(/-/g, "");

  const lastComma = digitsOnly.lastIndexOf(",");
  const lastDot = digitsOnly.lastIndexOf(".");
  const separatorIndex = Math.max(lastComma, lastDot);

  let normalized: string;
  if (separatorIndex === -1) {
    // Sem separador decimal: "1234" são reais inteiros.
    normalized = `${digitsOnly}.00`;
  } else {
    const decimals = digitsOnly.slice(separatorIndex + 1);
    const integer = digitsOnly.slice(0, separatorIndex).replace(/[.,]/g, "");
    // "1.234" (milhar) não tem casa decimal: 3 dígitos após o separador.
    normalized =
      decimals.length === 3 ? `${integer}${decimals}.00` : `${integer || "0"}.${decimals}`;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  const cents = roundHalfEven(value * 100);
  return negative ? -cents : cents;
}

/** Basis points → número decimal de porcentagem: 1500 → 15. */
export function percentFromBp(basisPoints: number): number {
  assertSafeInteger(basisPoints, "basisPoints");
  return basisPoints / 100;
}

/** Formata basis points para exibição: 1500 → "15%", 1550 → "15,5%". */
export function formatPercent(basisPoints: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(percentFromBp(basisPoints))
    .concat("%");
}

/** Porcentagem decimal → basis points: 15 → 1500. Arredonda para o bp mais próximo. */
export function bpFromPercent(percent: number): number {
  return roundHalfEven(percent * 100);
}

/**
 * Aplica um percentual (em basis points) sobre um valor em centavos.
 * Arredondamento *half-even* (bankers rounding): distribui o viés dos empates,
 * então uma comissão de 15% sobre R$ 0,10 não favorece sistematicamente um lado.
 */
export function applyPercent(cents: number, basisPoints: number): number {
  assertSafeInteger(cents, "cents");
  assertSafeInteger(basisPoints, "basisPoints");
  return roundHalfEven((cents * basisPoints) / 10_000);
}

export type CommissionInput = {
  type: "PERCENT" | "FIXED";
  /** Basis points (PERCENT) ou centavos (FIXED). */
  value: number;
  priceCents: number;
};

/**
 * Calcula a comissão em centavos a partir da regra do produto.
 * Mesma função usada no formulário (preview) e no server — evita divergência.
 */
export function calculateCommission({ type, value, priceCents }: CommissionInput): number {
  assertSafeInteger(value, "commissionValue");
  assertSafeInteger(priceCents, "priceCents");

  if (type === "PERCENT") {
    if (value < 0 || value > 10_000) {
      throw new RangeError("commissionValue em PERCENT deve estar entre 0 e 10000 bp.");
    }
    return applyPercent(priceCents, value);
  }

  if (value < 0 || value > priceCents) {
    throw new RangeError("commissionValue em FIXED não pode exceder o preço.");
  }
  return value;
}

/** Texto do tipo "15% · R$ 30,00 em R$ 200,00" para tabelas admin. */
export function formatCommissionPreview(input: CommissionInput): string {
  const commission = calculateCommission(input);
  const price = formatBRL(input.priceCents);
  if (input.type === "PERCENT") {
    return `${formatPercent(input.value)} · ${formatBRL(commission)} em ${price}`;
  }
  return `${formatBRL(commission)} fixos em ${price}`;
}

/**
 * Arredonda para inteiro com desempate no par mais próximo.
 * 0,5 → 0 · 1,5 → 2 · 2,5 → 2 · -0,5 → -0 · -1,5 → -2
 */
export function roundHalfEven(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("roundHalfEven recebeu um valor não finito.");
  }

  const floor = Math.floor(value);
  const diff = value - floor;

  // Ponto flutuante: 1.005 * 100 dá 100.49999… — a tolerância evita perder o empate.
  const EPSILON = 1e-9;

  if (Math.abs(diff - 0.5) < EPSILON) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return diff > 0.5 ? floor + 1 : floor;
}

/** Soma valores em centavos garantindo que o total continua inteiro seguro. */
export function sumCents(values: readonly number[]): number {
  return values.reduce<number>((total, value) => {
    assertSafeInteger(value, "cents");
    return total + value;
  }, 0);
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} deve ser um inteiro seguro; recebido: ${String(value)}`);
  }
}
