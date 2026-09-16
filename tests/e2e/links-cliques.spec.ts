import { expect, test } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 04: afiliado copia link → visita anônima → cookie `if_ref` → KPI atualiza.
 *
 * Usa o afiliado aprovado do seed (`afiliado.aprovado@exemplo.test`).
 */
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

test.describe("links e cliques", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("copia link, visita anônima gera cookie e KPI sobe", async ({ page, browser }) => {
    await signInAs(page, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    await page.goto("/painel/links");
    await expect(page.getByRole("heading", { name: "Seus links" })).toBeVisible();

    const linkInput = page.getByLabel("Seu link").first();
    const url = await linkInput.inputValue();
    expect(url).toMatch(/\/r\//);

    const affiliate = await e2eDb.affiliate.findFirst({
      where: { user: { email: AFFILIATE_EMAIL } },
      select: { id: true, code: true },
    });
    expect(affiliate?.code).toBeTruthy();
    if (!affiliate) throw new Error("Afiliado seed não encontrado.");

    const before = await e2eDb.click.count({
      where: { affiliateId: affiliate.id, isBot: false },
    });

    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    const response = await anonPage.goto(url, { waitUntil: "networkidle" });
    expect(response?.status()).toBeLessThan(400);

    const cookies = await anon.cookies();
    const ref = cookies.find((c) => c.name === "if_ref");
    expect(ref).toBeTruthy();
    expect(ref?.httpOnly).toBe(true);
    expect(ref?.sameSite).toBe("Lax");

    await anon.close();

    await expect
      .poll(async () => e2eDb.click.count({ where: { affiliateId: affiliate.id, isBot: false } }), {
        timeout: 5_000,
      })
      .toBeGreaterThan(before);

    await page.goto("/painel");
    await expect(page.getByText("Cliques (30 dias)")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
  });
});
