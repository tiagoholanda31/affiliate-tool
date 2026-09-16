/**
 * Tokenização de cartão no browser (nunca envia o número ao nosso servidor).
 * Sem chave pública (driver fake), gera token local.
 */
import { env } from "@/lib/env";

export type CardTokenInput = {
  number: string;
  holderName: string;
  expMonth: number;
  expYear: number;
  cvv: string;
};

export type CardTokenResult = {
  id: string;
  brand?: string;
  last4?: string;
};

/** Algoritmo de Luhn. */
export function luhnValid(number: string): boolean {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function detectBrand(number: string): string | null {
  const d = number.replace(/\D/g, "");
  if (d.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]|7[01]|720)/.test(d)) return "Mastercard";
  if (d.startsWith("34") || d.startsWith("37")) return "Amex";
  if (d.startsWith("606282") || d.startsWith("3841") || d.startsWith("60")) return "Hipercard";
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(d)) return "Elo";
  return null;
}

function fakeToken(digits: string): CardTokenResult {
  const last4 = digits.slice(-4);
  const id =
    last4 === "0002"
      ? `tok_decline_${last4}_${String(Date.now())}`
      : `tok_fake_${last4}_${String(Date.now())}`;
  return {
    id,
    brand: detectBrand(digits) ?? undefined,
    last4,
  };
}

export async function tokenizeCard(
  input: CardTokenInput,
  options?: { fake?: boolean },
): Promise<CardTokenResult> {
  const digits = input.number.replace(/\D/g, "");
  if (!luhnValid(digits)) {
    throw new Error("Número do cartão inválido.");
  }

  const pk = env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY;
  if (options?.fake || !pk) {
    return fakeToken(digits);
  }

  const url = `https://api.pagar.me/core/v5/tokens?appId=${encodeURIComponent(pk)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "card",
      card: {
        number: digits,
        holder_name: input.holderName,
        exp_month: input.expMonth,
        exp_year: input.expYear,
        cvv: input.cvv,
      },
    }),
  });

  if (!response.ok) {
    throw new Error("Não foi possível validar o cartão. Tente de novo.");
  }

  const json = (await response.json()) as {
    id: string;
    card?: { brand?: string; last_four_digits?: string };
  };
  return {
    id: json.id,
    brand: json.card?.brand,
    last4: json.card?.last_four_digits,
  };
}
