import { describe, expect, it } from "vitest";

import { generatePublicCode, isValidPublicCode } from "@/features/orders/public-code";
import { canTransition } from "@/features/orders/service";
import {
  gatewayStatusToOrderStatus,
  mapCardDecline,
  mapGatewayStatus,
} from "@/server/pagarme/map";
import type { PagarmeOrder } from "@/server/pagarme/types";

function orderWith(status: string, chargeStatus?: string): PagarmeOrder {
  return {
    id: "or_1",
    status,
    charges: chargeStatus
      ? [{ id: "ch_1", status: chargeStatus, last_transaction: { status: chargeStatus } }]
      : [],
  };
}

describe("publicCode", () => {
  it("gera IF- + 6 alfanuméricos", () => {
    const code = generatePublicCode();
    expect(isValidPublicCode(code)).toBe(true);
    expect(code).toMatch(/^IF-[A-Z0-9]{6}$/);
  });
});

describe("mapGatewayStatus", () => {
  it("mapeia paid / failed / refunded / chargedback / pending", () => {
    expect(mapGatewayStatus(orderWith("paid"))).toBe("paid");
    expect(mapGatewayStatus(orderWith("failed"))).toBe("failed");
    expect(mapGatewayStatus(orderWith("pending", "refunded"))).toBe("refunded");
    expect(mapGatewayStatus(orderWith("canceled", "chargedback"))).toBe("chargedback");
    expect(mapGatewayStatus(orderWith("pending"))).toBe("pending");
  });
});

describe("mapCardDecline", () => {
  it("traduz códigos comuns", () => {
    expect(mapCardDecline("51")).toMatch(/Saldo|limite/i);
    expect(mapCardDecline("54")).toMatch(/expir/i);
    expect(mapCardDecline(null, "CVV invalid")).toMatch(/CVV|segurança/i);
    expect(mapCardDecline("xx")).toMatch(/recusado|Pix/i);
  });
});

describe("gatewayStatusToOrderStatus", () => {
  it("converte para enum interno", () => {
    expect(gatewayStatusToOrderStatus("paid")).toBe("PAID");
    expect(gatewayStatusToOrderStatus("failed")).toBe("FAILED");
    expect(gatewayStatusToOrderStatus("processing")).toBe("PENDING");
  });
});

describe("canTransition", () => {
  it("permite matriz válida e bloqueia inválida", () => {
    expect(canTransition("PENDING", "PAID")).toBe(true);
    expect(canTransition("PENDING", "FAILED")).toBe(true);
    expect(canTransition("PENDING", "EXPIRED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "CHARGEDBACK")).toBe(true);
    expect(canTransition("REFUNDED", "PAID")).toBe(false);
    expect(canTransition("FAILED", "PAID")).toBe(false);
    expect(canTransition("PAID", "PAID")).toBe(true);
  });
});

describe("luhn / brand", () => {
  it("valida Visa de teste", async () => {
    const { luhnValid, detectBrand } = await import("@/features/checkout/card-token");
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
    expect(detectBrand("4111111111111111")).toBe("Visa");
  });
});
