/**
 * Integração: comissões, venda manual, cron de liberação e posse.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createManualOrder } from "@/features/commissions/manual";
import { runReleaseCommissions } from "@/features/commissions/release";
import {
  createCommissionForOrder,
  getBalances,
  reverseCommission,
} from "@/features/commissions/service";
import { onOrderPaid } from "@/features/orders/hooks";
import { generatePublicCode } from "@/features/orders/public-code";
import { encrypt, hashToken, randomToken } from "@/lib/crypto";
import { addHoldDays } from "@/lib/dates";
import { db } from "@/lib/db";
import { seedSettings, truncateAll } from "../helpers/integration";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

async function seedProduct(overrides?: {
  commissionType?: "PERCENT" | "FIXED";
  commissionValue?: number;
  priceCents?: number;
}) {
  return db.product.create({
    data: {
      slug: `prod-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      name: "Produto Comissão",
      type: "SERVICE",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: overrides?.priceCents ?? 19_990,
      commissionType: overrides?.commissionType ?? "PERCENT",
      commissionValue: overrides?.commissionValue ?? 1500,
      allowPix: true,
      allowCard: true,
    },
  });
}

async function seedAffiliate(email: string, code: string) {
  const user = await db.user.create({
    data: {
      name: "Afiliado Teste",
      email,
      emailVerified: true,
      role: "AFFILIATE",
    },
  });
  return db.affiliate.create({
    data: {
      userId: user.id,
      code,
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

async function seedAdmin() {
  return db.user.create({
    data: {
      name: "Admin",
      email: `admin-${String(Date.now())}@teste.local`,
      emailVerified: true,
      role: "ADMIN",
    },
  });
}

async function seedPaidOrder(opts: {
  productId: string;
  affiliateId: string | null;
  amountCents: number;
  paidAt?: Date;
}) {
  const paidAt = opts.paidAt ?? new Date();
  return db.order.create({
    data: {
      publicCode: generatePublicCode(),
      accessTokenHash: hashToken(randomToken(16)),
      source: "CHECKOUT",
      status: "PAID",
      productId: opts.productId,
      productNameSnap: "Produto Comissão",
      affiliateId: opts.affiliateId,
      customerName: "Comprador",
      customerEmail: `buyer-${String(Date.now())}@exemplo.test`,
      amountCents: opts.amountCents,
      paymentMethod: "PIX",
      paidAt,
    },
  });
}

describe("commissions integration", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSettings();
    await db.setting.update({ where: { id: 1 }, data: { holdDays: 7, payoutDay: 10 } });
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("onOrderPaid cria comissão idempotente com snapshot e holdDays", async () => {
    const product = await seedProduct({ priceCents: 19_990, commissionValue: 1500 });
    const affiliate = await seedAffiliate("a1@exemplo.test", "affone01");
    const paidAt = new Date("2026-09-01T12:00:00.000Z");
    const order = await seedPaidOrder({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 19_990,
      paidAt,
    });

    await onOrderPaid(order);
    await onOrderPaid(order);

    const commissions = await db.commission.findMany({ where: { orderId: order.id } });
    expect(commissions).toHaveLength(1);
    expect(commissions[0]?.amountCents).toBe(2998);
    expect(commissions[0]?.status).toBe("PENDING");
    expect(commissions[0]?.availableAt.toISOString()).toBe(
      addHoldDays(paidAt, 7).toISOString(),
    );
    expect(commissions[0]?.rateValue).toBe(1500);

    // Mudar holdDays depois não altera availableAt existente.
    await db.setting.update({ where: { id: 1 }, data: { holdDays: 1 } });
    const again = await createCommissionForOrder(order, db);
    expect(again?.availableAt.toISOString()).toBe(addHoldDays(paidAt, 7).toISOString());
  });

  it("reverseCommission: PENDING → REVERSED; PAID → ajuste negativo", async () => {
    const product = await seedProduct();
    const affiliate = await seedAffiliate("a2@exemplo.test", "afftwo02");
    const order = await seedPaidOrder({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 10_000,
    });
    await onOrderPaid(order);

    await db.$transaction(async (tx) => {
      await reverseCommission(order, "Estorno teste", tx);
    });
    const reversed = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(reversed.status).toBe("REVERSED");

    const order2 = await seedPaidOrder({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 10_000,
    });
    await onOrderPaid(order2);
    await db.commission.update({
      where: { orderId: order2.id },
      data: { status: "PAID", paidAt: new Date() },
    });

    const { adjustment } = await db.$transaction(async (tx) => {
      return reverseCommission(order2, "Estorno pago", tx, "system");
    });
    expect(adjustment?.amountCents).toBe(-1500);
    expect(adjustment?.payoutId).toBeNull();

    const balances = await getBalances(affiliate.id);
    expect(balances.openAdjustmentsCents).toBe(-1500);
    expect(balances.availableCents).toBe(-1500);
  });

  it("venda manual com afiliado gera comissão; sem afiliado não; data futura rejeitada", async () => {
    const product = await seedProduct({ priceCents: 10_000 });
    const affiliate = await seedAffiliate("a3@exemplo.test", "affthr03");
    const admin = await seedAdmin();

    const withAff = await createManualOrder(
      {
        productId: product.id,
        amountCents: 10_000,
        paidAt: new Date("2026-09-01T03:00:00.000Z"),
        customerName: "Cliente Manual",
        customerEmail: "manual@exemplo.test",
        affiliateId: affiliate.id,
      },
      admin.id,
    );
    expect(withAff.commissionCents).toBe(1500);
    expect(withAff.publicCode).toMatch(/^IF-/);

    const without = await createManualOrder(
      {
        productId: product.id,
        amountCents: 10_000,
        paidAt: new Date("2026-09-01T03:00:00.000Z"),
        customerName: "Sem Afiliado",
        customerEmail: "sem@exemplo.test",
        affiliateId: null,
      },
      admin.id,
    );
    expect(without.commissionCents).toBeNull();
    const commission = await db.commission.findUnique({ where: { orderId: without.orderId } });
    expect(commission).toBeNull();

    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
    const { createManualOrderSchema } = await import("@/features/commissions/schemas");
    const parsed = createManualOrderSchema.safeParse({
      productId: product.id,
      amountCents: 1000,
      paidAt: tomorrow.toISOString().slice(0, 10),
      customerName: "Futuro",
      customerEmail: "futuro@exemplo.test",
    });
    expect(parsed.success).toBe(false);
  });

  it("cron libera PENDING com availableAt vencido", async () => {
    const product = await seedProduct();
    const affiliate = await seedAffiliate("a4@exemplo.test", "afffou04");
    const paidAt = new Date("2026-08-01T12:00:00.000Z");
    const order = await seedPaidOrder({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 10_000,
      paidAt,
    });
    await onOrderPaid(order);

    const before = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(before.status).toBe("PENDING");

    const summary = await runReleaseCommissions(new Date("2026-09-01T12:00:00.000Z"));
    expect(summary.releasedCount).toBe(1);

    const after = await db.commission.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(after.status).toBe("AVAILABLE");

    const balances = await getBalances(affiliate.id);
    expect(balances.availableCents).toBe(1500);
    expect(balances.pendingCents).toBe(0);
  });

  it("afiliado só vê as próprias vendas (posse)", async () => {
    const product = await seedProduct();
    const a = await seedAffiliate("ownera@exemplo.test", "ownera1");
    const b = await seedAffiliate("ownerb@exemplo.test", "ownerb2");
    const orderA = await seedPaidOrder({
      productId: product.id,
      affiliateId: a.id,
      amountCents: 5000,
    });
    const orderB = await seedPaidOrder({
      productId: product.id,
      affiliateId: b.id,
      amountCents: 8000,
    });
    await onOrderPaid(orderA);
    await onOrderPaid(orderB);

    const { listAffiliateOrders } = await import("@/features/commissions/queries");
    const listA = await listAffiliateOrders(a.id);
    const listB = await listAffiliateOrders(b.id);
    expect(listA.items.every((o) => o.affiliateId === a.id)).toBe(true);
    expect(listB.items.every((o) => o.affiliateId === b.id)).toBe(true);
    expect(listA.items.map((o) => o.id)).toContain(orderA.id);
    expect(listA.items.map((o) => o.id)).not.toContain(orderB.id);
  });
});
