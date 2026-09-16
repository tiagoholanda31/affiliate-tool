/**
 * Integração: lotes de pagamento (draft → paid), ajustes e reserva de saldo.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getBalances } from "@/features/commissions/service";
import {
  buildPayoutDraft,
  createManualAdjustment,
  discardDraft,
  markPayoutPaid,
} from "@/features/payouts/service";
import { notifyPayoutPaid } from "@/features/payouts/notify";
import { generatePublicCode } from "@/features/orders/public-code";
import { encrypt, hashToken, randomToken } from "@/lib/crypto";
import { startOfDayInSaoPaulo, toIsoDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { centsToCsv, toCsv } from "@/lib/export";
import { seedSettings, truncateAll } from "../helpers/integration";

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ get: () => undefined }),
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.10" })),
}));

vi.mock("@/lib/mail", () => ({
  sendMail: vi.fn(() => Promise.resolve({ ok: true, emailLogId: "log", deferred: false })),
}));

vi.mock("@/server/n8n", () => ({
  emit: vi.fn(() => Promise.resolve(undefined)),
}));

async function seedProduct() {
  return db.product.create({
    data: {
      slug: `prod-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      name: "Produto Payout",
      type: "SERVICE",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: 10_000,
      commissionType: "PERCENT",
      commissionValue: 1000,
      allowPix: true,
      allowCard: true,
    },
  });
}

async function seedAffiliate(email: string, code: string) {
  const user = await db.user.create({
    data: {
      name: "Afiliado Payout",
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
      phone: "+5511999990002",
      socialNetwork: "INSTAGRAM",
      socialHandle: "pay",
      pixKeyType: "EMAIL",
      pixKeyEncrypted: encrypt("pay@pix.test"),
      pixKeyMasked: "pa***@pix.test",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsIp: "127.0.0.1",
    },
  });
}

async function seedAdmin() {
  return db.user.create({
    data: {
      name: "Admin Payout",
      email: `admin-pay-${String(Date.now())}@teste.local`,
      emailVerified: true,
      role: "ADMIN",
    },
  });
}

async function seedAvailableCommission(opts: {
  productId: string;
  affiliateId: string;
  amountCents: number;
}) {
  const order = await db.order.create({
    data: {
      publicCode: generatePublicCode(),
      accessTokenHash: hashToken(randomToken(16)),
      source: "CHECKOUT",
      status: "PAID",
      productId: opts.productId,
      productNameSnap: "Produto Payout",
      affiliateId: opts.affiliateId,
      customerName: "Comprador",
      customerEmail: `buyer-pay-${String(Date.now())}@exemplo.test`,
      amountCents: 10_000,
      paymentMethod: "PIX",
      paidAt: new Date(),
    },
  });
  return db.commission.create({
    data: {
      orderId: order.id,
      affiliateId: opts.affiliateId,
      amountCents: opts.amountCents,
      baseAmountCents: 10_000,
      rateType: "PERCENT",
      rateValue: 1000,
      status: "AVAILABLE",
      availableAt: new Date(),
    },
  });
}

describe("payouts integration", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSettings();
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("buildPayoutDraft reserva comissões e abate o disponível; discard devolve", async () => {
    const product = await seedProduct();
    const affiliate = await seedAffiliate("pay1@exemplo.test", "payaff01");
    const admin = await seedAdmin();
    await seedAvailableCommission({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 1500,
    });
    await seedAvailableCommission({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 500,
    });

    const before = await getBalances(affiliate.id);
    expect(before.availableCents).toBe(2000);

    const draft = await db.$transaction((tx) =>
      buildPayoutDraft(affiliate.id, {}, admin.id, tx),
    );
    expect(draft.status).toBe("DRAFT");
    expect(draft.totalCents).toBe(2000);

    const reserved = await getBalances(affiliate.id);
    expect(reserved.availableCents).toBe(0);

    const linked = await db.commission.count({
      where: { affiliateId: affiliate.id, payoutId: draft.id },
    });
    expect(linked).toBe(2);

    await db.$transaction((tx) => discardDraft(draft.id, tx));
    const after = await getBalances(affiliate.id);
    expect(after.availableCents).toBe(2000);
    expect(await db.payout.count({ where: { id: draft.id } })).toBe(0);
  });

  it("rejeita total zero por ajuste negativo e exige comprovação ao pagar", async () => {
    const product = await seedProduct();
    const affiliate = await seedAffiliate("pay2@exemplo.test", "payaff02");
    const admin = await seedAdmin();
    await seedAvailableCommission({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 1000,
    });
    await createManualAdjustment(affiliate.id, -1000, "Abate total", admin.id);

    await expect(
      db.$transaction((tx) => buildPayoutDraft(affiliate.id, {}, admin.id, tx)),
    ).rejects.toBeInstanceOf(AppError);

    await createManualAdjustment(affiliate.id, 200, "Crédito parcial", admin.id);
    // 1000 - 1000 + 200 = 200
    const draft = await db.$transaction((tx) =>
      buildPayoutDraft(affiliate.id, {}, admin.id, tx),
    );
    expect(draft.totalCents).toBe(200);

    await expect(
      db.$transaction((tx) =>
        markPayoutPaid(draft.id, { paidAt: new Date(), proofReference: null, proofPath: null }, tx),
      ),
    ).rejects.toBeInstanceOf(AppError);

    const paid = await db.$transaction((tx) =>
      markPayoutPaid(
        draft.id,
        {
          paidAt: startOfDayInSaoPaulo(2026, 9, 9),
          proofReference: "E2E-TEST-001",
        },
        tx,
        startOfDayInSaoPaulo(2026, 9, 10),
      ),
    );
    expect(paid.status).toBe("PAID");

    const commissions = await db.commission.findMany({ where: { payoutId: paid.id } });
    expect(commissions.every((c) => c.status === "PAID")).toBe(true);

    await expect(
      db.$transaction((tx) =>
        markPayoutPaid(paid.id, { paidAt: new Date(), proofReference: "x" }, tx),
      ),
    ).rejects.toBeInstanceOf(AppError);

    await notifyPayoutPaid(paid.id);
    const { sendMail } = await import("@/lib/mail");
    expect(sendMail).toHaveBeenCalled();
  });

  it("ajuste negativo aberto reduz o próximo lote", async () => {
    const product = await seedProduct();
    const affiliate = await seedAffiliate("pay3@exemplo.test", "payaff03");
    const admin = await seedAdmin();
    await seedAvailableCommission({
      productId: product.id,
      affiliateId: affiliate.id,
      amountCents: 3000,
    });
    await createManualAdjustment(affiliate.id, -800, "Estorno anterior", admin.id);

    const balances = await getBalances(affiliate.id);
    expect(balances.availableCents).toBe(2200);
    expect(balances.openAdjustmentsCents).toBe(-800);

    const draft = await db.$transaction((tx) =>
      buildPayoutDraft(affiliate.id, {}, admin.id, tx),
    );
    expect(draft.totalCents).toBe(2200);

    const adjs = await db.commissionAdjustment.findMany({ where: { payoutId: draft.id } });
    expect(adjs).toHaveLength(1);
    expect(adjs[0]?.amountCents).toBe(-800);
  });

  it("CSV tem BOM e separador ; com decimais pt-BR", () => {
    const csv = toCsv(
      [
        {
          key: "v",
          header: "Valor (R$)",
          csv: (r: { cents: number }) => centsToCsv(r.cents),
          xlsx: (r) => r.cents / 100,
        },
      ],
      [{ cents: 123_456 }],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("Valor (R$)");
    expect(csv).toContain("1.234,56");
    expect(toIsoDate(new Date("2026-09-10T15:00:00.000Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
