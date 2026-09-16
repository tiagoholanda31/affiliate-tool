/**
 * Testes de abuso da fatia 11: auto-compra, preço, IDOR, upload malicioso, webhook forjado.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as webhookPost } from "@/app/api/webhooks/pagarme/route";
import { approveAffiliate } from "@/features/affiliates/admin-actions";
import { createCheckoutOrder } from "@/features/checkout/service";
import { listAffiliateOrders } from "@/features/commissions/queries";
import { getOrderForBuyer } from "@/features/orders/queries";
import { auth } from "@/lib/auth";
import { encrypt, hashToken, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { signRef } from "@/lib/attribution";
import { saveDigitalUpload } from "@/lib/uploads";
import { resetFakePagarmeStore, resetPagarmeCache } from "@/server/pagarme";
import {
  createCookieStore,
  requestContext,
  seedSettings,
  signInAndGetCookie,
  truncateAll,
} from "../helpers/integration";

const cookieStore = createCookieStore();
const jar = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => jar.get(name) ?? cookieStore.get(name),
      getAll: () => [
        ...[...jar].map(([name, value]) => ({ name, value: value.value })),
        ...cookieStore.getAll(),
      ],
      has: (name: string) => jar.has(name) || cookieStore.has(name),
      set: (name: string, value: string) => {
        cookieStore.set(name, value);
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
    }),
  headers: () => Promise.resolve(requestContext.headers),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  updateTag: () => undefined,
}));

const { registerAffiliate } = await import("@/features/affiliates/actions");

const PASSWORD = "trufaAzulNoTelhado";

const customer = {
  name: "Ana Costa",
  email: "ana@exemplo.test",
  phone: "11987654321",
  document: "39053344705",
};

async function seedProduct(priceCents = 20_000) {
  return db.product.create({
    data: {
      slug: `prod-abuse-${randomToken(6)}`,
      name: "Produto Abuso",
      type: "SERVICE",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents,
      commissionType: "PERCENT",
      commissionValue: 1500,
      allowPix: true,
      allowCard: true,
      maxInstallments: 1,
    },
  });
}

async function seedApprovedAffiliate(email: string, code: string) {
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
      code,
      status: "APPROVED",
      phone: "+5511999990001",
      socialNetwork: "INSTAGRAM",
      socialHandle: code,
      pixKeyType: "EMAIL",
      pixKeyEncrypted: encrypt(`${code}@pix.test`),
      pixKeyMasked: "af***@pix.test",
      termsVersion: "v1",
      termsAcceptedAt: new Date(),
      termsIp: "127.0.0.1",
    },
  });
}

describe("abuso", () => {
  beforeAll(async () => {
    resetPagarmeCache();
    await truncateAll();
  });

  beforeEach(async () => {
    jar.clear();
    cookieStore.jar.clear();
    requestContext.reset();
    resetFakePagarmeStore();
    resetPagarmeCache();
    await truncateAll();
    await seedSettings();
  });

  afterAll(async () => {
    await truncateAll();
  });

  it("recalcula o preço no servidor e ignora amountCents do client", async () => {
    const product = await seedProduct(20_000);
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
    expect(order.customerDocEnc).toBeTruthy();
    expect(order.customerDocEnc).not.toContain("39053344705");
  });

  it("bloqueia auto-compra (e-mail do afiliado = e-mail do comprador)", async () => {
    const affiliate = await seedApprovedAffiliate("aff@exemplo.test", "affabuse");
    const click = await db.click.create({
      data: {
        affiliateId: affiliate.id,
        ipHash: "abc",
        uaHash: "def",
        isUnique: true,
      },
    });
    const token = await signRef({ a: affiliate.id, c: click.id }, 30);
    jar.set("if_ref", { value: token });

    const product = await seedProduct();
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

  it("IDOR: afiliado A não vê pedidos de B; token de A não abre pedido de B", async () => {
    const a = await seedApprovedAffiliate("a@exemplo.test", "affaaa1");
    const b = await seedApprovedAffiliate("b@exemplo.test", "affbbb1");
    const product = await seedProduct();

    const tokenA = randomToken();
    const tokenB = randomToken();
    await db.order.create({
      data: {
        publicCode: "IF-AAAAAA",
        accessTokenHash: hashToken(tokenA),
        source: "CHECKOUT",
        status: "PAID",
        productId: product.id,
        productNameSnap: product.name,
        affiliateId: a.id,
        customerName: "Comprador A",
        customerEmail: "ca@exemplo.test",
        amountCents: product.priceCents,
        paymentMethod: "PIX",
        paidAt: new Date(),
      },
    });
    await db.order.create({
      data: {
        publicCode: "IF-BBBBBB",
        accessTokenHash: hashToken(tokenB),
        source: "CHECKOUT",
        status: "PAID",
        productId: product.id,
        productNameSnap: product.name,
        affiliateId: b.id,
        customerName: "Comprador B",
        customerEmail: "cb@exemplo.test",
        amountCents: product.priceCents,
        paymentMethod: "PIX",
        paidAt: new Date(),
      },
    });

    const listedA = await listAffiliateOrders(a.id);
    expect(listedA.items).toHaveLength(1);
    expect(listedA.items[0]?.publicCode).toBe("IF-AAAAAA");
    expect(listedA.items.some((o) => o.publicCode === "IF-BBBBBB")).toBe(false);

    await expect(getOrderForBuyer("IF-BBBBBB", tokenA)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const own = await getOrderForBuyer("IF-AAAAAA", tokenA);
    expect(own.publicCode).toBe("IF-AAAAAA");
  });

  it("afiliado não executa action de admin (aprovar outro)", async () => {
    await registerAffiliate({
      name: "Maria Souza",
      email: "idor.aff@teste.local",
      password: PASSWORD,
      phone: "11987654321",
      socialNetwork: "INSTAGRAM",
      socialHandle: "idor.aff",
      pixKeyType: "CPF",
      pixKey: "529.982.247-25",
      termsAccepted: true,
      website: "",
      startedAt: Date.now() - 10_000,
    });
    const user = await db.user.findUnique({
      where: { email: "idor.aff@teste.local" },
      include: { affiliate: true },
    });
    if (!user?.affiliate) throw new Error("Afiliado não criado");
    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const cookie = await signInAndGetCookie(auth, "idor.aff@teste.local", PASSWORD);
    requestContext.setCookie(cookie);

    const result = await approveAffiliate({ affiliateId: user.affiliate.id });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("permissão");
  });

  it("rejeita upload de executável disfarçado de PDF", async () => {
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, ...Buffer.alloc(60)]);
    await expect(saveDigitalUpload(exe, "malware.pdf")).rejects.toThrow(/inválido/i);
  });

  it("webhook forjado (sem Basic Auth ou senha errada) responde 401 e não muda pedido", async () => {
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
    const before = await db.order.findUniqueOrThrow({
      where: { publicCode: created.publicCode },
    });
    expect(before.status).toBe("PENDING");

    const body = JSON.stringify({
      id: "evt_forged",
      type: "order.paid",
      data: { id: before.gatewayOrderId, status: "paid" },
    });

    const noAuth = await webhookPost(
      new Request("http://localhost/api/webhooks/pagarme", { method: "POST", body }),
    );
    expect(noAuth.status).toBe(401);

    const bad = await webhookPost(
      new Request("http://localhost/api/webhooks/pagarme", {
        method: "POST",
        body,
        headers: {
          authorization: `Basic ${Buffer.from("intruso:senha-errada").toString("base64")}`,
        },
      }),
    );
    expect(bad.status).toBe(401);

    const after = await db.order.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("PENDING");
  });
});
