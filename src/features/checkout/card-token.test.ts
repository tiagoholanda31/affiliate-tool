import { describe, expect, it } from "vitest";

import { tokenizeCard } from "@/features/checkout/card-token";

describe("tokenizeCard", () => {
  it("gera token de recusa no modo fake mesmo com PAN válido", async () => {
    const token = await tokenizeCard(
      {
        number: "4000000000000002",
        holderName: "TESTE",
        expMonth: 12,
        expYear: 30,
        cvv: "123",
      },
      { fake: true },
    );
    expect(token.id).toMatch(/^tok_decline_0002_/);
    expect(token.last4).toBe("0002");
  });

  it("gera token de aprovação no modo fake", async () => {
    const token = await tokenizeCard(
      {
        number: "4111111111111111",
        holderName: "TESTE",
        expMonth: 12,
        expYear: 30,
        cvv: "123",
      },
      { fake: true },
    );
    expect(token.id).toMatch(/^tok_fake_1111_/);
  });
});
