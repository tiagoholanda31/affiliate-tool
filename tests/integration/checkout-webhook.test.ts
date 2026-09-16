/**
 * Integração: checkout, webhook e reconciliação (driver fake).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as webhookPost } from "@/app/api/webhooks/pagarme/route";
import { createCheckoutOrder } from "@/features/checkout/service";
import {
  applyGatewayStatus,
  canTransition,
  transitionOrder,
} from "@/features/orders/service";
import { expirePendingPix } from "@/features/orders/reconcile";
import { processPagarmeWebhook, verifyWebhookBasicAuth } from "@/features/orders/webhook";
import { encrypt, hashToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { signRef } from "@/lib/attribution";
import {
  forceFakeOrderStatus,
  resetFakePagarmeStore,
  resetPagarmeCache,
} from "@/server/pagarme";
import { seedSettings, truncateAll } from "../helpers/integration";

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => jar.get(name),
    }),
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

const jar = new Map<string, { value: string }>();

function setCookie(name: string, value: string) {
  jar.set(name, { value });
}

async function seedProduct(overrides?: { status?: "ACTIVE" | "DRAFT"; priceCents?: number }) {
  return db.product.create({
    data: {
      slug: `prod-${String(Date.now())}`,
      name: "Produto Teste",
      type: "SERVICE",
      status: overrides?.status ?? "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: overrides?.priceCents ?? 15_000,
      commissionType: "PERCENT",
      commissionValue: 1500,
      allowPix: true,
      allowCard: true,
      maxInstallments: 3,
      deliveryNote: "Agendaremos em 2 dias.",
    },
  });
}

async function seedAffiliate(email: string) {
  const user = await db.user.create({
    data: {
      name: "Afiliado",
      email,
      emailVerified: true,
      role: "AFFILIATE",
    },
  });
  return db.affiliate.create({
    data: {
      userId: user.id,
      code: "afftest1",
      status: "APPROVED",
      phone: "+5511999990001",
      socialNetwork: "INSTAGRAM",
      socialHandle: "aff",
      pixKeyType: "EMAIL",
      pixKeyEncrypted: encrypt("aff@pix.test"),
      pixKeyMasked: "af***@pix.test",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsIp: "127.0.0.1",
    },
  });
}

const customer = {
  name: "Ana Costa",
  email: "ana@exemplo.test",
  phone: "11987654321",
  document: "39053344705", // CPF válido
};

describe("checkout + webhook", () => {
  beforeAll(async () => {
    resetPagarmeCache();
    await truncateAll();
  });

  beforeEach(async () => {
    jar.clear();
    resetFakePagarmeStore();
    resetPagarmeCache();
    await truncateAll();
    await seedSettings();
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("recalcula preço no servidor (ignora amountCents do client)", async () => {
    const product = await seedProduct({ priceCents: 20_000 });
    const result = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer,
        amountCents: 1,
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.10",
    );
    const order = await db.order.findUniqueOrThrow({ where: { publicCode: result.publicCode } });
    expect(order.amountCents).toBe(20_000);
    expect(order.status).toBe("PENDING");
    expect(order.pixQrCode).toBeTruthy();
  });

  it("bloqueia produto inativo", async () => {
    const product = await seedProduct({ status: "DRAFT" });
    await expect(
      createCheckoutOrder(
        {
          productId: product.id,
          method: "pix",
          customer,
          website: "",
          formStartedAt: Date.now() - 5_000,
        },
        "203.0.113.10",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("atribui afiliado pelo cookie e bloqueia auto-compra", async () => {
    const affiliate = await seedAffiliate("aff@exemplo.test");
    const click = await db.click.create({
      data: {
        affiliateId: affiliate.id,
        ipHash: "abc",
        uaHash: "def",
        isUnique: true,
      },
    });
    const token = await signRef({ a: affiliate.id, c: click.id }, 30);
    setCookie("if_ref", token);

    const product = await seedProduct();
    const withAff = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer,
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.10",
    );
    const orderAff = await db.order.findUniqueOrThrow({
      where: { publicCode: withAff.publicCode },
    });
    expect(orderAff.affiliateId).toBe(affiliate.id);
    expect(orderAff.clickId).toBe(click.id);

    const self = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer: { ...customer, email: "aff@exemplo.test" },
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.11",
    );
    const orderSelf = await db.order.findUniqueOrThrow({
      where: { publicCode: self.publicCode },
    });
    expect(orderSelf.affiliateId).toBeNull();
    expect(orderSelf.metadata).toMatchObject({ selfPurchaseBlocked: true });
  });

  it("cartão aprovado vai a PAID; token decline → FAILED", async () => {
    const product = await seedProduct();
    const paid = await createCheckoutOrder(
      {
        productId: product.id,
        method: "card",
        customer,
        cardToken: "tok_ok_1111",
        installments: 1,
        billingAddress: {
          line1: "Rua A, 100",
          zipCode: "01310100",
          city: "São Paulo",
          state: "SP",
        },
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.12",
    );
    expect(paid.status).toBe("PAID");

    const failed = await createCheckoutOrder(
      {
        productId: product.id,
        method: "card",
        customer: { ...customer, email: "outra@exemplo.test" },
        cardToken: "tok_decline_0002",
        installments: 1,
        billingAddress: {
          line1: "Rua A, 100",
          zipCode: "01310100",
          city: "São Paulo",
          state: "SP",
        },
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.13",
    );
    expect(failed.status).toBe("FAILED");
    expect(failed.failureReason).toBeTruthy();
  });

  it("webhook: 401 sem auth; duplicado; paid → PAID; desconhecido → FAILED event", async () => {
    expect(verifyWebhookBasicAuth(null)).toBe(false);

    const product = await seedProduct();
    const created = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer,
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.14",
    );
    const order = await db.order.findUniqueOrThrow({
      where: { publicCode: created.publicCode },
    });

    const user = env.PAGARME_WEBHOOK_USER ?? "affiliate";
    const pass = env.PAGARME_WEBHOOK_PASSWORD ?? "troque-me";
    expect(user.length + pass.length).toBeGreaterThan(0);

    const noAuth = await webhookPost(
      new Request("http://localhost/api/webhooks/pagarme", {
        method: "POST",
        body: JSON.stringify({ id: "ev1", type: "order.paid", data: {} }),
      }),
    );
    expect(noAuth.status).toBe(401);

    const gatewayOrderId = order.gatewayOrderId;
    expect(gatewayOrderId).toBeTruthy();
    if (!gatewayOrderId) throw new Error("gatewayOrderId ausente");

    forceFakeOrderStatus(gatewayOrderId, "paid");

    const envelope = {
      id: "evt_paid_1",
      type: "order.paid",
      data: { id: gatewayOrderId, status: "paid", metadata: { orderId: order.id } },
    };

    const r1 = await processPagarmeWebhook(envelope);
    expect(r1.ok).toBe(true);
    const after = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(after.status).toBe("PAID");

    const r2 = await processPagarmeWebhook(envelope);
    expect(r2).toMatchObject({ ok: true, duplicate: true });
    const r3 = await processPagarmeWebhook(envelope);
    expect(r3).toMatchObject({ ok: true, duplicate: true });

    const paidMails = await db.emailLog.count({
      where: { template: "order-paid", to: customer.email, status: "SENT" },
    });
    expect(paidMails).toBe(1);

    const unknown = await processPagarmeWebhook({
      id: "evt_unknown",
      type: "order.paid",
      data: { id: "or_does_not_exist" },
    });
    expect(unknown.ok).toBe(true);
    const failedEv = await db.webhookEvent.findUnique({ where: { eventId: "evt_unknown" } });
    expect(failedEv?.status).toBe("FAILED");
  });

  it("transição inválida é ignorada; expirePendingPix marca EXPIRED", async () => {
    const product = await seedProduct();
    const order = await db.order.create({
      data: {
        publicCode: "IF-ZZZZZZ",
        accessTokenHash: hashToken("tok"),
        source: "CHECKOUT",
        status: "REFUNDED",
        productId: product.id,
        productNameSnap: product.name,
        customerName: "X",
        customerEmail: "x@y.test",
        amountCents: 1000,
        paymentMethod: "PIX",
        refundedAt: new Date(),
      },
    });

    expect(canTransition("REFUNDED", "PAID")).toBe(false);
    await expect(
      applyGatewayStatus(order, {
        id: "or_x",
        status: "paid",
        charges: [{ id: "ch_x", status: "paid" }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    const pending = await db.order.create({
      data: {
        publicCode: "IF-YYYYYY",
        accessTokenHash: hashToken("tok2"),
        source: "CHECKOUT",
        status: "PENDING",
        productId: product.id,
        productNameSnap: product.name,
        customerName: "Y",
        customerEmail: "y@y.test",
        amountCents: 1000,
        paymentMethod: "PIX",
        pixExpiresAt: new Date(Date.now() - 10 * 60_000),
      },
    });
    const n = await expirePendingPix();
    expect(n).toBeGreaterThanOrEqual(1);
    const expired = await db.order.findUniqueOrThrow({ where: { id: pending.id } });
    expect(expired.status).toBe("EXPIRED");
  });

  it("reconcile: PAID estornado no gateway → REFUNDED", async () => {
    const product = await seedProduct();
    const created = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer,
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.20",
    );
    const order = await db.order.findUniqueOrThrow({
      where: { publicCode: created.publicCode },
    });
    await transitionOrder(order.id, "PAID", { paidAt: new Date() });
    const gatewayOrderId = order.gatewayOrderId;
    expect(gatewayOrderId).toBeTruthy();
    if (!gatewayOrderId) throw new Error("gatewayOrderId ausente");

    const remote = forceFakeOrderStatus(gatewayOrderId, "refunded");
    const refreshed = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    await applyGatewayStatus(refreshed, remote);
    const final = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(final.status).toBe("REFUNDED");
  });
});
