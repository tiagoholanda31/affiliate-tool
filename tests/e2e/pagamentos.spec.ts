import { expect, test } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb } from "../helpers/e2e-db";

/**
 * Fatia 07: admin gera lote → revela Pix → marca pago → afiliado vê lote/comprovante.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_EMAIL = "afiliado.aprovado@exemplo.test";
const AFFILIATE_PASSWORD = "afiliado-teste-2026";

test.describe("pagamentos de comissão", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("fluxo draft → pago e extrato no painel do afiliado", async ({ page, context }, testInfo) => {
    const affiliate = await e2eDb.affiliate.findFirst({
      where: { user: { email: AFFILIATE_EMAIL } },
      select: { id: true, code: true },
    });
    expect(affiliate).toBeTruthy();
    if (!affiliate) throw new Error("Afiliado seed não encontrado.");

    const product = await e2eDb.product.findFirst({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, priceCents: true },
    });
    expect(product).toBeTruthy();
    if (!product) throw new Error("Produto seed não encontrado.");

    // Limpa lotes DRAFT deste afiliado para o teste ficar isolado.
    const drafts = await e2eDb.payout.findMany({
      where: { affiliateId: affiliate.id, status: "DRAFT" },
      select: { id: true },
    });
    for (const d of drafts) {
      await e2eDb.commission.updateMany({ where: { payoutId: d.id }, data: { payoutId: null } });
      await e2eDb.commissionAdjustment.updateMany({
        where: { payoutId: d.id },
        data: { payoutId: null },
      });
      await e2eDb.payout.delete({ where: { id: d.id } });
    }

    const publicCode = `IF-E2E${testInfo.project.name.slice(0, 1)}${String(Date.now()).slice(-5)}`;
    const order = await e2eDb.order.create({
      data: {
        publicCode,
        accessTokenHash: `e2e-payout-${testInfo.project.name}-${String(Date.now())}`,
        source: "MANUAL",
        status: "PAID",
        productId: product.id,
        productNameSnap: product.name,
        affiliateId: affiliate.id,
        customerName: "Comprador E2E Payout",
        customerEmail: `e2e-payout-${String(Date.now())}@exemplo.test`,
        amountCents: product.priceCents,
        paymentMethod: "PIX",
        paidAt: new Date(),
      },
    });

    await e2eDb.commission.create({
      data: {
        orderId: order.id,
        affiliateId: affiliate.id,
        amountCents: 2500,
        baseAmountCents: product.priceCents,
        rateType: "FIXED",
        rateValue: 2500,
        status: "AVAILABLE",
        availableAt: new Date(),
      },
    });

    await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);

    await page.goto("/admin/pagamentos");
    await expect(page.getByRole("heading", { name: "Pagamentos" })).toBeVisible();

    const row = page.locator("tr").filter({ hasText: affiliate.code ?? "" }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });
    await row.getByRole("button", { name: "Gerar lote" }).click();
    await expect(page).toHaveURL(/\/admin\/pagamentos\//, { timeout: 15_000 });

    await page.getByRole("button", { name: "Revelar" }).click();
    await expect(page.getByText(/Chave Pix revelada|copiar chave/i).first()).toBeVisible({
      timeout: 10_000,
    });

    const payoutUrl = page.url();
    const payoutId = payoutUrl.split("/").pop();
    if (!payoutId) throw new Error("payoutId ausente");

    await page.getByLabel("Referência Pix (E2E/ID)").fill(`E2E-PAY-${String(Date.now())}`);
    await page.getByRole("button", { name: "Marcar como pago" }).click();
    await page.getByRole("button", { name: "Confirmar pagamento" }).click();
    await expect(page.getByText(/Lote pago|imutável/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const paid = await e2eDb.payout.findUnique({ where: { id: payoutId } });
    expect(paid?.status).toBe("PAID");

    const audit = await e2eDb.auditLog.findFirst({
      where: { action: "pix.reveal", entityId: affiliate.id },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeTruthy();

    await context.clearCookies();
    await signInAs(page, AFFILIATE_EMAIL, AFFILIATE_PASSWORD, /\/painel/);

    await page.goto("/painel/comissoes");
    await expect(page.getByRole("heading", { name: "Pagamentos recebidos" })).toBeVisible();
    await expect(page.getByText(/Mês \d{4}-\d{2}/).first()).toBeVisible({ timeout: 10_000 });
  });
});
