import { expect, test } from "@playwright/test";

import { fillHydrated, signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 10: admin altera termos → afiliado vê banner → aceita → banner some.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

test.describe("termos — re-aceite", () => {
  test.afterAll(async () => {
    await e2eDb.setting.update({
      where: { id: 1 },
      data: {
        termsVersion: "v1",
        termsMarkdown: `# Termos do Programa de Afiliados

> Texto provisório restaurado pelo e2e.
`,
      },
    });
    await e2eDb.affiliate.updateMany({
      where: { user: { email: AFFILIATE_EMAIL } },
      data: { termsVersion: "v1" },
    });
    await e2eDb.$disconnect();
  });

  test("admin muda termos e afiliado aceita banner", async ({ page, browser }) => {
    const version = `v${String(Date.now()).slice(-6)}`;

    await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);

    await page.goto("/admin/configuracoes");
    await fillHydrated(page.getByLabel("Versão"), version);
    await page.getByLabel("WhatsApp de suporte").fill("11987654321");
    await fillHydrated(
      page.getByLabel("Texto (markdown)"),
      `# Termos E2E ${version}\n\nConteúdo novo dos termos para o teste ponta a ponta.`,
    );
    await page.getByRole("button", { name: "Salvar configurações" }).click();
    await expect(page.getByText("Configurações salvas.")).toBeVisible({ timeout: 15_000 });

    const affiliateCtx = await browser.newContext();
    const affiliatePage = await affiliateCtx.newPage();
    await signInAs(affiliatePage, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    await expect(
      affiliatePage.getByText(`Atualizamos os termos do programa (${version})`),
    ).toBeVisible({ timeout: 15_000 });

    await affiliatePage.getByRole("button", { name: "Aceitar termos" }).click();
    await expect(affiliatePage.getByText("Termos aceitos")).toBeVisible({ timeout: 15_000 });
    await expect(
      affiliatePage.getByText(`Atualizamos os termos do programa (${version})`),
    ).toHaveCount(0);

    await affiliateCtx.close();
  });
});
