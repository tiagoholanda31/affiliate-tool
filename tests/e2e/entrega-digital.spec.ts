import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 08: checkout fake de livro → e-mail com link → download → contador 1.
 */
test.describe("entrega digital", () => {
  const slug = `ebook-e2e-${String(Date.now())}`;
  let productId: string | null = null;

  test.afterAll(async () => {
    if (productId) {
      await e2eDb.downloadGrant.deleteMany({
        where: { order: { productId } },
      });
      await e2eDb.order.deleteMany({ where: { productId } });
      await e2eDb.digitalFile.deleteMany({ where: { productId } });
      await e2eDb.product.deleteMany({ where: { id: productId } });
    }
    await e2eDb.$disconnect();
  });

  test("Pix livro → e-mail → download incrementa contador", async ({ page }) => {
    const storageDir = process.env.STORAGE_DIR ?? "./storage";
    const relative = `products/e2e-${slug}.pdf`;
    const absolute = path.resolve(storageDir, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from("%PDF-1.4 e2e-digital\n%%EOF\n"));

    const product = await e2eDb.product.create({
      data: {
        slug,
        name: "E-book E2E Entrega",
        type: "DIGITAL",
        status: "ACTIVE",
        shortDescription: "Livro de teste e2e",
        description: "Conteúdo de teste",
        priceCents: 1900,
        commissionType: "FIXED",
        commissionValue: 200,
        allowPix: true,
        allowCard: true,
        maxInstallments: 1,
        digitalFile: {
          create: {
            storagePath: relative,
            originalName: "ebook-e2e.pdf",
            mimeType: "application/pdf",
            sizeBytes: 24,
            sha256: "b".repeat(64),
          },
        },
      },
    });
    productId = product.id;

    const email = `digital-e2e-${String(Date.now())}@exemplo.test`;

    await page.goto(`/p/${slug}`);
    await page.getByLabel("Nome completo").fill("Comprador Digital");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Celular").fill("11999887766");
    await page.getByLabel("CPF ou CNPJ").fill("39053344705");
    await page.getByRole("tab", { name: "Pix" }).click();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: /Gerar Pix/i }).click();

    await expect(page.getByText(/Pedido IF-/i)).toBeVisible({ timeout: 15_000 });
    const url = page.url();
    const match = /pedido\/(IF-[A-Z0-9]+)/.exec(url);
    const code = match?.[1];
    expect(code).toBeTruthy();
    if (!code) throw new Error("Código do pedido não encontrado.");

    await page.goto("/dev/pagarme");
    const row = page.locator("li").filter({ hasText: code }).first();
    await row.getByRole("button", { name: "paid" }).click();

    let html = "";
    await expect
      .poll(async () => {
        const mail = await e2eDb.emailLog.findFirst({
          where: { to: email, template: "order-paid" },
          orderBy: { createdAt: "desc" },
          select: { preview: true },
        });
        html = mail?.preview ?? "";
        return html.includes("/download/");
      }, { timeout: 15_000 })
      .toBe(true);

    const dl = /href="([^"]*\/download\/[^"]+)"/.exec(html);
    expect(dl?.[1]).toBeTruthy();
    const downloadUrl = (dl?.[1] ?? "").replaceAll("&amp;", "&");

    const downloadPromise = page.waitForEvent("download");
    await page.goto(downloadUrl).catch(() => undefined);
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const grant = await e2eDb.downloadGrant.findFirst({
      where: { order: { publicCode: code } },
      orderBy: { createdAt: "desc" },
    });
    expect(grant?.downloadCount).toBe(1);

    await page.goto(url);
    await expect(page.getByText(/Pagamento confirmado/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: /Baixar livro/i })).toBeVisible();
  });
});
