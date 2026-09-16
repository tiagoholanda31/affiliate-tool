/**
 * Seed de volume para EXPLAIN ANALYZE das queries do dashboard (fatia 10).
 *
 * Uso: `pnpm exec tsx scripts/seed-volume.ts`
 * Requer DATABASE_URL apontando para um banco de desenvolvimento/teste.
 * NÃO rode em produção.
 *
 * Gera ~200 afiliados, ~20k cliques, ~3k pedidos (parcialmente pagos).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, randomBytes } from "node:crypto";

import { PrismaClient } from "../src/generated/prisma/client.js";

const AFFILIATES = 200;
const CLICKS = 20_000;
const ORDERS = 3_000;

function encrypt(plainText: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function publicCode(n: number): string {
  return `IF-${String(n).padStart(6, "0")}`;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-volume é só para desenvolvimento. Recusado em produção.");
  }

  const url = process.env.DATABASE_URL;
  const encKey = process.env.ENCRYPTION_KEY;
  if (!url || !encKey) {
    throw new Error("DATABASE_URL e ENCRYPTION_KEY são obrigatórios.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const started = Date.now();

  console.log("Seed volume: limpando tabelas de tráfego…");
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DownloadGrant", "CommissionAdjustment", "Commission", "Payout",
      "WebhookEvent", "Order", "Click", "Material"
    RESTART IDENTITY CASCADE
  `);

  let product = await prisma.product.findFirst({ where: { status: "ACTIVE" } });
  if (!product) {
    product = await prisma.product.create({
      data: {
        slug: "volume-seed-produto",
        name: "Produto Volume",
        type: "SERVICE",
        status: "ACTIVE",
        shortDescription: "Seed",
        description: "Seed volume",
        priceCents: 19_900,
        commissionType: "PERCENT",
        commissionValue: 1500,
        allowPix: true,
        allowCard: true,
      },
    });
  }

  console.log(`Criando ${String(AFFILIATES)} afiliados…`);
  const affiliateIds: string[] = [];
  for (let i = 0; i < AFFILIATES; i++) {
    const email = `vol.aff.${String(i)}@seed.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        name: `Afiliado Volume ${String(i)}`,
        email,
        emailVerified: true,
        role: "AFFILIATE",
      },
    });
    const aff = await prisma.affiliate.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        code: `vol${String(i).padStart(3, "0")}`,
        status: i % 20 === 0 ? "PENDING" : "APPROVED",
        phone: `+55119${String(10000000 + i).slice(0, 8)}`,
        socialNetwork: "INSTAGRAM",
        socialHandle: `volaff${String(i)}`,
        pixKeyType: "EMAIL",
        pixKeyEncrypted: encrypt(email, encKey),
        pixKeyMasked: `vo***@seed.test`,
        termsVersion: "v1",
        termsAcceptedAt: new Date(),
        termsIp: "127.0.0.1",
      },
    });
    affiliateIds.push(aff.id);
  }

  console.log(`Criando ${String(CLICKS)} cliques…`);
  const now = Date.now();
  const clickBatch = 500;
  for (let offset = 0; offset < CLICKS; offset += clickBatch) {
    const rows = Array.from({ length: Math.min(clickBatch, CLICKS - offset) }, (_, j) => {
      const n = offset + j;
      const affiliateId = affiliateIds[n % affiliateIds.length]!;
      return {
        affiliateId,
        productId: n % 3 === 0 ? product.id : null,
        ipHash: hashish(`ip-${String(n % 800)}`),
        uaHash: hashish(`ua-${String(n % 40)}`),
        isUnique: n % 3 === 0,
        isBot: n % 17 === 0,
        createdAt: new Date(now - (n % 90) * 86_400_000 - (n % 86_400_000)),
      };
    });
    await prisma.click.createMany({ data: rows });
  }

  console.log(`Criando ${String(ORDERS)} pedidos…`);
  const orderBatch = 200;
  for (let offset = 0; offset < ORDERS; offset += orderBatch) {
    const slice = Array.from({ length: Math.min(orderBatch, ORDERS - offset) }, (_, j) => {
      const n = offset + j;
      const paid = n % 5 !== 0;
      const affiliateId = affiliateIds[n % affiliateIds.length]!;
      const paidAt = paid ? new Date(now - (n % 60) * 86_400_000) : null;
      return {
        publicCode: publicCode(100_000 + n),
        accessTokenHash: hashish(`tok-${String(n)}`),
        status: paid ? ("PAID" as const) : ("PENDING" as const),
        source: "CHECKOUT" as const,
        paymentMethod: "PIX" as const,
        amountCents: 19_900,
        productId: product.id,
        productNameSnap: product.name,
        affiliateId,
        customerName: `Cliente ${String(n)}`,
        customerEmail: `cliente${String(n)}@seed.test`,
        customerPhone: "+5511987654321",
        paidAt,
        createdAt: paidAt ?? new Date(now - (n % 30) * 86_400_000),
      };
    });
    await prisma.order.createMany({ data: slice });
  }

  const paidOrders = await prisma.order.findMany({
    where: { status: "PAID", affiliateId: { not: null } },
    select: { id: true, affiliateId: true, amountCents: true, paidAt: true },
    take: 2_500,
  });

  console.log(`Criando ${String(paidOrders.length)} comissões…`);
  await prisma.commission.createMany({
    data: paidOrders.map((o) => ({
      orderId: o.id,
      affiliateId: o.affiliateId!,
      amountCents: Math.round(o.amountCents * 0.15),
      baseAmountCents: o.amountCents,
      rateType: "PERCENT" as const,
      rateValue: 1500,
      status: "PENDING" as const,
      availableAt: new Date((o.paidAt ?? new Date()).getTime() + 7 * 86_400_000),
      createdAt: o.paidAt ?? new Date(),
    })),
    skipDuplicates: true,
  });

  const elapsed = Date.now() - started;
  console.log(`OK em ${String(elapsed)} ms.`);
  await prisma.$disconnect();
}

function hashish(input: string): string {
  // sha256-like hex placeholder — Click.ipHash is String, length free.
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return `vol${h.toString(16).padStart(8, "0")}${Buffer.from(input).toString("hex").slice(0, 56)}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
