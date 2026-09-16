/**
 * Integração fatia 10: settings, reprocess webhook, busca ⌘K, aceite de termos.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createCheckoutOrder } from "@/features/checkout/service";
import { acceptTermsAction, updateSettingsAction } from "@/features/settings/actions";
import { globalSearchAction } from "@/features/search/actions";
import { reprocessWebhookAction } from "@/features/system/actions";
import { processPagarmeWebhook } from "@/features/orders/webhook";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { forceFakeOrderStatus, resetFakePagarmeStore, resetPagarmeCache } from "@/server/pagarme";
import {
  createCookieStore,
  requestContext,
  seedSettings,
  signInAndGetCookie,
  truncateAll,
} from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  revalidateTag: () => undefined,
}));

const { registerAffiliate } = await import("@/features/affiliates/actions");

const PASSWORD = "trufaAzulNoTelhado";

const customer = {
  name: "Cliente Teste",
  email: "cliente.sys@exemplo.test",
  phone: "11987654321",
  document: "52998224725",
};

async function createAdmin(email: string) {
  await auth.api.signUpEmail({
    body: {
      name: "Admin Teste",
      email,
      password: PASSWORD,
      callbackURL: "/verificar-email?status=ok",
    },
    headers: requestContext.headers,
  });
  await db.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  return { email, password: PASSWORD };
}

async function createAffiliate(email: string, handle = "sys.aff") {
  await registerAffiliate({
    name: "Afiliado Sistema",
    email,
    password: PASSWORD,
    phone: "11987654321",
    socialNetwork: "INSTAGRAM",
    socialHandle: handle,
    pixKeyType: "CPF",
    pixKey: "529.982.247-25",
    termsAccepted: true,
    website: "",
    startedAt: Date.now() - 10_000,
  });
  const user = await db.user.findUnique({ where: { email }, include: { affiliate: true } });
  if (!user?.affiliate) throw new Error("Afiliado não criado");
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return { affiliateId: user.affiliate.id, userId: user.id, email };
}

async function seedProduct() {
  return db.product.create({
    data: {
      slug: `sys-${String(Date.now())}`,
      name: "Produto Sistema",
      type: "SERVICE",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: 15_000,
      commissionType: "PERCENT",
      commissionValue: 1500,
      allowPix: true,
      allowCard: true,
      maxInstallments: 3,
    },
  });
}

const settingsInput = {
  payoutDay: 10,
  attributionDays: 30,
  pixExpirationMinutes: 30,
  downloadGrantDays: 7,
  downloadMaxCount: 5,
  adminNotifyEmail: "admin@teste.local",
  supportWhatsapp: "11912345678",
};

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v1");
  requestContext.reset();
  cookieStore.jar.clear();
  resetFakePagarmeStore();
  resetPagarmeCache();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("settings", () => {
  it("rejeita holdDays 91; exige nova versão ao mudar termos; holdDays 10 grava", async () => {
    const admin = await createAdmin(`admin-set-${String(Date.now())}@teste.local`);
    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const bad = await updateSettingsAction({
      ...settingsInput,
      holdDays: 91,
      termsVersion: "v1",
      termsMarkdown: "Termos de teste com texto suficiente para o mínimo.",
    });
    expect(bad.ok).toBe(false);

    const sameVersion = await updateSettingsAction({
      ...settingsInput,
      holdDays: 10,
      termsVersion: "v1",
      termsMarkdown: "Texto dos termos totalmente novo e longo o bastante.",
    });
    expect(sameVersion.ok).toBe(false);

    const ok = await updateSettingsAction({
      ...settingsInput,
      holdDays: 10,
      termsVersion: "v2",
      termsMarkdown: "Texto dos termos totalmente novo e longo o bastante.",
    });
    expect(ok.ok).toBe(true);

    const setting = await db.setting.findUniqueOrThrow({ where: { id: 1 } });
    expect(setting.holdDays).toBe(10);
    expect(setting.termsVersion).toBe("v2");

    const audit = await db.auditLog.findFirst({ where: { action: "settings.update" } });
    expect(audit?.before).toBeTruthy();
    expect(audit?.after).toBeTruthy();
  });
});

describe("webhook reprocess", () => {
  it("reprocessar paid não duplica comissão", async () => {
    const admin = await createAdmin(`admin-wh-${String(Date.now())}@teste.local`);
    const product = await seedProduct();
    const created = await createCheckoutOrder(
      {
        productId: product.id,
        method: "pix",
        customer,
        website: "",
        formStartedAt: Date.now() - 5_000,
      },
      "203.0.113.40",
    );
    const order = await db.order.findUniqueOrThrow({
      where: { publicCode: created.publicCode },
    });
    expect(order.gatewayOrderId).toBeTruthy();
    const gatewayOrderId = order.gatewayOrderId;
    if (!gatewayOrderId) throw new Error("gatewayOrderId ausente");
    forceFakeOrderStatus(gatewayOrderId, "paid");

    const eventId = `evt_reprocess_${String(Date.now())}`;
    const envelope = {
      id: eventId,
      type: "order.paid",
      data: {
        id: gatewayOrderId,
        status: "paid",
        metadata: { orderId: order.id },
      },
    };

    expect((await processPagarmeWebhook(envelope)).ok).toBe(true);
    const afterPaid = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterPaid.status).toBe("PAID");

    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));
    const re = await reprocessWebhookAction({ eventId });
    expect(re.ok).toBe(true);

    expect(await db.commission.count({ where: { orderId: order.id } })).toBeLessThanOrEqual(1);
    expect(await db.downloadGrant.count({ where: { orderId: order.id } })).toBe(0);
  });
});

describe("busca ⌘K", () => {
  it("encontra pedido por IF-XXXXXX, e-mail parcial e afiliado por @handle", async () => {
    const admin = await createAdmin(`admin-busca-${String(Date.now())}@teste.local`);
    const aff = await createAffiliate(`aff-busca-${String(Date.now())}@teste.local`, "maria.afiliada");
    await db.affiliate.update({
      where: { id: aff.affiliateId },
      data: { status: "APPROVED", code: "busca01" },
    });
    const product = await seedProduct();
    const order = await db.order.create({
      data: {
        publicCode: "IF-424242",
        accessTokenHash: `hash-${String(Date.now())}`,
        source: "MANUAL",
        status: "PAID",
        productId: product.id,
        productNameSnap: product.name,
        affiliateId: aff.affiliateId,
        customerName: "Cliente Busca",
        customerEmail: "parcial.email@dominio.test",
        amountCents: 5_000,
        paymentMethod: "MANUAL",
        paidAt: new Date(),
      },
    });

    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const byCode = await globalSearchAction({ q: "IF-424242" });
    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.orders.some((o) => o.id === order.id)).toBe(true);

    const byEmail = await globalSearchAction({ q: "parcial.email" });
    expect(byEmail.ok).toBe(true);
    if (byEmail.ok) expect(byEmail.data.orders.some((o) => o.id === order.id)).toBe(true);

    const byHandle = await globalSearchAction({ q: "@maria.afiliada" });
    expect(byHandle.ok).toBe(true);
    if (byHandle.ok) {
      expect(byHandle.data.affiliates.some((a) => a.id === aff.affiliateId)).toBe(true);
    }
  });
});

describe("aceite de termos", () => {
  it("afiliado atualiza termsVersion ao aceitar", async () => {
    await db.setting.update({
      where: { id: 1 },
      data: {
        termsVersion: "v2",
        termsMarkdown: "Novos termos com texto longo o suficiente para validar.",
      },
    });
    const aff = await createAffiliate(`aff-terms-${String(Date.now())}@teste.local`);
    await db.affiliate.update({
      where: { id: aff.affiliateId },
      data: { termsVersion: "v1", status: "APPROVED", code: "terms01" },
    });

    requestContext.setCookie(await signInAndGetCookie(auth, aff.email, PASSWORD));
    const result = await acceptTermsAction({ termsVersion: "v2" });
    expect(result.ok).toBe(true);

    const updated = await db.affiliate.findUniqueOrThrow({ where: { id: aff.affiliateId } });
    expect(updated.termsVersion).toBe("v2");
  });
});
