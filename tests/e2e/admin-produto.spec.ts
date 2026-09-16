import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Admin cria livro digital com PDF → aparece na vitrine → `/p/[slug]` renderiza.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";

const SLUG = `ebook-e2e-${String(Date.now())}`;
const PRODUCT_NAME = `E-book E2E ${String(Date.now())}`;

test.describe("admin cria produto digital", () => {
  test.afterAll(async () => {
    await e2eDb.product.deleteMany({ where: { slug: SLUG } });
    await e2eDb.$disconnect();
  });

  test("cria livro com PDF e publica na vitrine", async ({ page }) => {
    test.setTimeout(60_000);
    const pdfPath = path.join(test.info().outputDir, "livro-e2e.pdf");
    await mkdir(path.dirname(pdfPath), { recursive: true });
    await writeFile(
      pdfPath,
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
    );

    await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);

    await page.goto("/admin/produtos/novo");
    await page.getByLabel("Nome").fill(PRODUCT_NAME);
    await page.getByLabel("Slug").fill(SLUG);
    await page.locator("#type").click();
    await page.getByRole("option", { name: "Livro digital" }).click();
    await page.getByLabel("Descrição curta").fill("Material digital criado no teste ponta a ponta.");
    await page.getByLabel("Descrição (markdown)").fill(
      "## Conteúdo\n\nTexto de exemplo com o suficiente para validar o formulário.",
    );

    // Preço: MaskedInput money — digita centavos da direita para a esquerda.
    await page.locator("#priceCents").fill("4900");
    await page.getByLabel("Comissão (%)").fill("15");

    const digitalZone = page.getByLabel("Arraste o PDF ou EPUB");
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      digitalZone.click(),
    ]);
    await fileChooser.setFiles(pdfPath);
    await expect(page.getByText("livro-e2e.pdf")).toBeVisible({ timeout: 15_000 });

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Publicado" }).click();

    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible({ timeout: 15_000 });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();

    await page.getByRole("link", { name: new RegExp(PRODUCT_NAME) }).click();
    await expect(page).toHaveURL(new RegExp(`/p/${SLUG}`));
    await expect(page.getByRole("heading", { name: PRODUCT_NAME })).toBeVisible();
    await expect(page.getByRole("button", { name: /Gerar Pix|Pagar com cartão/i })).toBeVisible();
  });
});
