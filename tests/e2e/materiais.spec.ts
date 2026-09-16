import { expect, test } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 09: admin cadastra texto com {{link}} → afiliado copia e recebe o link próprio.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

const TITLE = `Copy E2E ${String(Date.now())}`;

test.describe("materiais de divulgação", () => {
  test.afterAll(async () => {
    await e2eDb.material.deleteMany({ where: { title: TITLE } });
    await e2eDb.$disconnect();
  });

  test("admin cria TEXT com {{link}} e afiliado copia o link próprio", async ({ page, browser }) => {
    await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);

    await page.goto("/admin/materiais");
    await page.getByRole("button", { name: "Novo material" }).click();
    await expect(page.getByRole("heading", { name: "Novo material" })).toBeVisible();

    await page.getByLabel("Título").fill(TITLE);
    await page.getByLabel("Tipo").click();
    await page.getByRole("option", { name: "Texto" }).click();
    await page.locator("#material-text").fill("Olha este material: {{link}}");
    await page.getByRole("button", { name: "Salvar material" }).click();

    await expect(page.getByText(TITLE)).toBeVisible({ timeout: 15_000 });

    const affiliate = await e2eDb.affiliate.findFirst({
      where: { user: { email: AFFILIATE_EMAIL } },
      select: { code: true },
    });
    expect(affiliate?.code).toBeTruthy();
    if (!affiliate?.code) throw new Error("Código do afiliado seed não encontrado.");

    const affContext = await browser.newContext();
    const affPage = await affContext.newPage();
    await signInAs(affPage, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    await affPage.goto("/painel/materiais");
    await expect(async () => {
      await affPage.reload();
      await expect(affPage.getByText(TITLE).first()).toBeVisible({ timeout: 4_000 });
    }).toPass({ timeout: 20_000 });

    await affPage.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await affPage.getByRole("button", { name: "Copiar texto" }).click();
    await expect(affPage.getByText(/copiado/i).first()).toBeVisible({ timeout: 5_000 });

    const copied = await affPage.evaluate(async () => navigator.clipboard.readText());
    expect(copied).toContain(`/r/${affiliate.code}`);
    expect(copied).not.toContain("{{link}}");

    await affContext.close();
  });
});
