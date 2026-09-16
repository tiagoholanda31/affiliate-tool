import { expect, test } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb, waitForOrderStatus } from "../helpers/e2e-db";

/**
 * Fatia 06: checkout com cookie de afiliado → pago (fake) → afiliado vê venda e saldo pendente.
 */
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

test.describe("comissões após checkout", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("venda atribuída aparece no painel com comissão pendente", async ({ page, context }) => {
    const affiliate = await e2eDb.affiliate.findFirst({
      where: { user: { email: AFFILIATE_EMAIL } },
      select: { id: true, code: true },
    });
    expect(affiliate?.code).toBeTruthy();
    if (!affiliate?.code) throw new Error("Afiliado seed não encontrado.");

    // Atribuição via /r/<code> (cookie if_ref).
    await page.goto(`/r/${affiliate.code}/consulta-avaliacao`);
    await expect(page).toHaveURL(/\/p\/consulta-avaliacao/);

    const email = `comprador-com-${String(Date.now())}@exemplo.test`;
    await page.getByLabel("Nome completo").fill("Comprador Comissão");
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
    await waitForOrderStatus(code, "PAID");

    const order = await e2eDb.order.findUnique({
      where: { publicCode: code },
      include: { commission: true },
    });
    expect(order?.affiliateId).toBe(affiliate.id);
    expect(order?.status).toBe("PAID");
    expect(order?.commission?.status).toBe("PENDING");
    expect(order?.commission?.amountCents).toBeGreaterThan(0);
    if (!order) throw new Error("Pedido não encontrado após pagamento.");

    await context.clearCookies();
    await signInAs(page, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    await page.goto("/painel/vendas");
    await expect(page.getByText(order.productNameSnap).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Pendente/i).first()).toBeVisible();

    await page.goto("/painel/comissoes");
    await expect(page.getByText(/Pendente/i).first()).toBeVisible();
  });
});
