import { expect, test } from "@playwright/test";

import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 05: checkout Pix (fake → pago) e cartão (recusa / aprovação).
 * Produto seed: `/p/consulta-avaliacao`.
 */
test.describe("checkout fake", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("Pix → forçar pago → confirmado", async ({ page }) => {
    await page.goto("/p/consulta-avaliacao");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.getByLabel("Nome completo").fill("Comprador E2E");
    await page.getByLabel("E-mail").fill(`comprador-e2e-${String(Date.now())}@exemplo.test`);
    await page.getByLabel("Celular").fill("11999887766");
    await page.getByLabel("CPF ou CNPJ").fill("39053344705");
    await page.getByRole("tab", { name: "Pix" }).click();
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: /Gerar Pix/i }).click();

    await expect(page.getByText(/Pedido IF-/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("button", { name: /Copiar código Pix/i })).toBeVisible();

    const url = page.url();
    const match = /pedido\/(IF-[A-Z0-9]+)/.exec(url);
    const code = match?.[1];
    expect(code).toBeTruthy();
    if (!code) throw new Error("Código do pedido não encontrado na URL.");

    await page.goto("/dev/pagarme");
    const row = page.locator("li").filter({ hasText: code }).first();
    await row.getByRole("button", { name: "paid" }).click();

    await page.goto(url);
    await expect(page.getByText(/Pagamento confirmado/i)).toBeVisible({ timeout: 10_000 });
  });

  test("cartão recusado mostra mensagem; aprovado confirma", async ({ page }) => {
    await page.goto("/p/consulta-avaliacao");

    await page.getByLabel("Nome completo").fill("Cartão E2E");
    await page.getByLabel("E-mail").fill(`cartao-fail-${String(Date.now())}@exemplo.test`);
    await page.getByLabel("Celular").fill("11988776655");
    await page.getByLabel("CPF ou CNPJ").fill("39053344705");
    await page.getByRole("tab", { name: "Cartão" }).click();

    await page.getByLabel("Número do cartão").fill("4000000000000002");
    await page.getByLabel("Nome no cartão").fill("CARTAO E2E");
    await page.getByLabel("Mês").fill("12");
    await page.getByLabel("Ano").fill("30");
    await page.getByLabel("CVV").fill("123");
    await page.getByLabel("Endereço (cobrança)").fill("Av Paulista 1000");
    await page.getByLabel("CEP").fill("01310100");
    await page.getByLabel("Cidade").fill("Sao Paulo");
    await page.getByLabel("UF").fill("SP");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: /Pagar com cartão/i }).click();

    await expect(page.getByText(/recusado|Saldo|limite|não concluído/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.goto("/p/consulta-avaliacao");
    await page.getByLabel("Nome completo").fill("Cartão OK");
    await page.getByLabel("E-mail").fill(`cartao-ok-${String(Date.now())}@exemplo.test`);
    await page.getByLabel("Celular").fill("11988776655");
    await page.getByLabel("CPF ou CNPJ").fill("39053344705");
    await page.getByRole("tab", { name: "Cartão" }).click();
    await page.getByLabel("Número do cartão").fill("4111111111111111");
    await page.getByLabel("Nome no cartão").fill("CARTAO OK");
    await page.getByLabel("Mês").fill("12");
    await page.getByLabel("Ano").fill("30");
    await page.getByLabel("CVV").fill("123");
    await page.getByLabel("Endereço (cobrança)").fill("Av Paulista 1000");
    await page.getByLabel("CEP").fill("01310100");
    await page.getByLabel("Cidade").fill("Sao Paulo");
    await page.getByLabel("UF").fill("SP");
    await page.waitForTimeout(3200);
    await page.getByRole("button", { name: /Pagar com cartão/i }).click();
    await expect(page.getByText(/Pagamento confirmado/i)).toBeVisible({ timeout: 15_000 });
  });
});
