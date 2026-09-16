import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 11: axe sem violações serious/critical nas rotas públicas e autenticadas.
 * Teclado no checkout (Tab percorre os campos até o botão de pagar).
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

async function expectNoSeriousAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const bad = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
}

/** Dev no Windows às vezes entrega HTML vazio (ENOENT no manifest). */
async function gotoReady(page: Page, path: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  let lastTitle = "";
  while (Date.now() < deadline) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    lastTitle = await page.title();
    const lang = await page.locator("html").getAttribute("lang");
    if (lastTitle.length > 0 && lang) return;
    await page.waitForTimeout(1_000);
  }
  throw new Error(`Página ${path} não compilou (title="${lastTitle}").`);
}

test.describe("acessibilidade", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("rotas públicas sem violações serious/critical", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "axe completo só no desktop");

    for (const path of ["/", "/termos", "/privacidade", "/entrar", "/cadastro", "/p/consulta-avaliacao"]) {
      await gotoReady(page, path);
      await expectNoSeriousAxe(page);
    }
  });

  test("painel do afiliado e admin sem violações serious/critical", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "axe autenticado só no desktop");
    test.setTimeout(180_000);

    await signInAs(page, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    for (const path of [
      "/painel",
      "/painel/links",
      "/painel/vendas",
      "/painel/comissoes",
      "/painel/materiais",
      "/painel/perfil",
    ]) {
      await gotoReady(page, path);
      await expectNoSeriousAxe(page);
    }

    await page.getByRole("button", { name: /Conta de/ }).click();
    await page.getByRole("menuitem", { name: "Sair" }).click();

    await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);

    for (const path of [
      "/admin",
      "/admin/afiliados",
      "/admin/produtos",
      "/admin/vendas",
      "/admin/comissoes",
      "/admin/pagamentos",
      "/admin/materiais",
      "/admin/configuracoes",
      "/admin/sistema",
    ]) {
      await gotoReady(page, path);
      await expectNoSeriousAxe(page);
    }
  });

  test("checkout: Tab percorre nome, e-mail e chega ao botão Pix", async ({ page }) => {
    await page.goto("/p/consulta-avaliacao");
    await expect(page.getByLabel("Nome completo")).toBeVisible();

    await page.getByLabel("Nome completo").focus();
    await expect(page.getByLabel("Nome completo")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("E-mail")).toBeFocused();

    await page.getByRole("tab", { name: "Pix" }).click();
    const pay = page.getByRole("button", { name: /Gerar Pix/i });
    await pay.focus();
    await expect(pay).toBeFocused();
  });
});
