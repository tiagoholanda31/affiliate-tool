/**
 * Integração: grants, download, reenvio, revogação em estorno.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET as downloadGet } from "@/app/download/[token]/route";
import {
  countResendsToday,
  createGrant,
  resendGrant,
  revokeGrantsForOrder,
  validateAndConsume,
} from "@/features/delivery/service";
import { onOrderPaid, onOrderReversed } from "@/features/orders/hooks";
import { generatePublicCode } from "@/features/orders/public-code";
import { hashToken, randomToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { env } from "@/lib/env";
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

const PDF_BYTES = Buffer.from("%PDF-1.4 delivery-test\n%%EOF\n");

async function seedDigitalProduct() {
  const relative = `products/delivery-test-${randomToken(8)}.pdf`;
  const absolute = path.resolve(env.STORAGE_DIR, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, PDF_BYTES);

  const product = await db.product.create({
    data: {
      slug: `ebook-${String(Date.now())}-${Math.random().toString(36).slice(2, 6)}`,
      name: "Livro Teste Entrega",
      type: "DIGITAL",
      status: "ACTIVE",
      shortDescription: "Resumo",
      description: "Desc",
      priceCents: 4_900,
      commissionType: "FIXED",
      commissionValue: 500,
      allowPix: true,
      allowCard: true,
      digitalFile: {
        create: {
          storagePath: relative,
          originalName: "livro.pdf",
          mimeType: "application/pdf",
          sizeBytes: PDF_BYTES.byteLength,
          sha256: "a".repeat(64),
        },
      },
    },
  });
  return product;
}

async function seedPaidOrder(productId: string) {
  const accessToken = randomToken(32);
  const order = await db.order.create({
    data: {
      publicCode: generatePublicCode(),
      accessTokenHash: hashToken(accessToken),
      source: "CHECKOUT",
      status: "PAID",
      productId,
      productNameSnap: "Livro Teste Entrega",
      customerName: "Ana Costa",
      customerEmail: "ana-delivery@exemplo.test",
      amountCents: 4_900,
      paymentMethod: "PIX",
      paidAt: new Date(),
    },
  });
  return { order, accessToken };
}

describe("entrega digital", () => {
  beforeAll(async () => {
    await truncateAll();
  });

  beforeEach(async () => {
    await truncateAll();
    await seedSettings();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("validateAndConsume: ok, limite, expirado, revogado", async () => {
    const product = await seedDigitalProduct();
    const { order } = await seedPaidOrder(product.id);
    const { token, grant } = await createGrant(order.id);

    const ok = await validateAndConsume(token);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.grant.downloadCount).toBe(1);
      expect(ok.data.mimeType).toBe("application/pdf");
    }

    await db.downloadGrant.update({
      where: { id: grant.id },
      data: { downloadCount: grant.maxDownloads },
    });
    const limit = await validateAndConsume(token);
    expect(limit.ok).toBe(false);
    if (!limit.ok) expect(limit.reason).toBe("LIMIT");

    await db.downloadGrant.update({
      where: { id: grant.id },
      data: { downloadCount: 0, expiresAt: new Date(Date.now() - 60_000) },
    });
    const expired = await validateAndConsume(token);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.reason).toBe("EXPIRED");

    await db.downloadGrant.update({
      where: { id: grant.id },
      data: { expiresAt: new Date(Date.now() + 86_400_000), revokedAt: new Date() },
    });
    const revoked = await validateAndConsume(token);
    expect(revoked.ok).toBe(false);
    if (!revoked.ok) expect(revoked.reason).toBe("REVOKED");
  });

  it("rota GET /download: headers, contador e 404 genérico", async () => {
    const product = await seedDigitalProduct();
    const { order } = await seedPaidOrder(product.id);
    const { token } = await createGrant(order.id);

    const res = await downloadGet(
      new Request(`http://localhost/download/${encodeURIComponent(token)}`),
      { params: Promise.resolve({ token }) },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("Content-Disposition")).toContain("filename*=");
    expect(res.body).toBeTruthy();
    const bodyText = await res.text();
    expect(bodyText).toContain("%PDF");

    const grant = await db.downloadGrant.findFirst({ where: { orderId: order.id } });
    expect(grant?.downloadCount).toBe(1);

    const bad = await downloadGet(new Request("http://localhost/download/token-errado-xyz"), {
      params: Promise.resolve({ token: "token-errado-xyz" }),
    });
    expect(bad.status).toBe(404);
    const html = await bad.text();
    expect(html).toContain("não encontrado");
    expect(html).not.toContain(env.STORAGE_DIR);
    expect(html).not.toContain("products/");
  });

  it("reenvio limita a 3 por dia", async () => {
    const product = await seedDigitalProduct();
    const { order } = await seedPaidOrder(product.id);
    await createGrant(order.id);

    await resendGrant(order.id);
    await resendGrant(order.id);
    await resendGrant(order.id);
    expect(await countResendsToday(order.id)).toBe(3);

    await expect(resendGrant(order.id)).rejects.toBeInstanceOf(AppError);
    try {
      await resendGrant(order.id);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      if (error instanceof AppError) {
        expect(error.code).toBe("CONFLICT");
        expect(error.message).toMatch(/3 vezes/i);
      }
    }
  });

  it("estorno revoga grants; onOrderPaid cria grant DIGITAL", async () => {
    const product = await seedDigitalProduct();
    const { order } = await seedPaidOrder(product.id);

    const paid = await onOrderPaid(order);
    expect(paid && "download" in paid && paid.download).toBeTruthy();
    if (paid && "download" in paid && paid.download) {
      const token = paid.download.token;
      const ok = await validateAndConsume(token);
      expect(ok.ok).toBe(true);
    }

    const refunded = await db.order.update({
      where: { id: order.id },
      data: { status: "REFUNDED", refundedAt: new Date() },
    });
    await onOrderReversed(refunded);

    const active = await db.downloadGrant.count({
      where: { orderId: order.id, revokedAt: null },
    });
    expect(active).toBe(0);

    if (paid && "download" in paid && paid.download) {
      const after = await validateAndConsume(paid.download.token);
      expect(after.ok).toBe(false);
      if (!after.ok) expect(after.reason).toBe("REVOKED");
    }
  });

  it("revokeGrantsForOrder limpa token do metadata", async () => {
    const product = await seedDigitalProduct();
    const { order } = await seedPaidOrder(product.id);
    await createGrant(order.id);
    const before = await db.order.findUnique({ where: { id: order.id } });
    const meta = before?.metadata as Record<string, unknown>;
    expect(typeof meta.activeDownloadToken).toBe("string");

    await revokeGrantsForOrder(order.id);
    const after = await db.order.findUnique({ where: { id: order.id } });
    const metaAfter = after?.metadata as Record<string, unknown>;
    expect(metaAfter.activeDownloadToken).toBeUndefined();
  });
});
