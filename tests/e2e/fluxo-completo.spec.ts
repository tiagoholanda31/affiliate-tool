import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb, getVerificationLink, removeUserByEmail, waitForOrderStatus } from "../helpers/e2e-db";

/**
 * Fatia 11: fluxo ponta a ponta com gateway fake.
 * Cadastro → verificação → admin aprova → link → clique → Pix pago →
 * comissão pendente → cron libera → lote → pago → extrato.
 * Também: cartão recusado, estorno reverte, download com limite.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_PASSWORD = "trufaAzulNoTelhado";

function uniqueEmail(tag: string): string {
  return `e2e.fluxo.${tag}.${String(Date.now())}@exemplo.test`;
}

async function fillCheckoutPix(page: Page, email: string, name: string): Promise<void> {
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Celular").fill("11999887766");
  await page.getByLabel("CPF ou CNPJ").fill("39053344705");
  await page.getByRole("tab", { name: "Pix" }).click();
  await page.waitForTimeout(3200);
  await page.getByRole("button", { name: /Gerar Pix/i }).click();
}

async function forcePaid(page: Page, publicCode: string): Promise<void> {
  await page.goto("/dev/pagarme");
  const row = page.locator("li").filter({ hasText: publicCode }).first();
  await row.getByRole("button", { name: "paid" }).click();
  await waitForOrderStatus(publicCode, "PAID");
}

test.describe("fluxo completo", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("cadastro até extrato pago", async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "fluxo longo só no desktop");
    const email = uniqueEmail("main");

    try {
      await page.goto("/cadastro");
      await page.getByLabel("Nome completo").fill("Fluxo Completo");
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("textbox", { name: "Senha" }).fill(AFFILIATE_PASSWORD);
      await page.getByLabel("Celular").fill("11987654321");
      await page.getByLabel("Rede social").click();
      await page.getByRole("option", { name: "Instagram" }).click();
      await page.getByLabel("Seu @").fill(`fluxo.${String(Date.now()).slice(-6)}`);
      await page.getByRole("button", { name: "Continuar" }).click();

      await page.getByLabel("Tipo da chave Pix").click();
      await page.getByRole("option", { name: "CPF", exact: true }).click();
      await page.getByRole("textbox", { name: "Chave Pix" }).fill("52998224725");
      await page.getByRole("checkbox").check();
      await page.waitForTimeout(3_200);
      await page.getByRole("button", { name: "Criar minha conta" }).click();
      await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();

      await page.goto(await getVerificationLink(email));
      await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();

      await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);
      await page.goto("/admin/afiliados?status=PENDING");
      await page.getByLabel("Buscar afiliados").fill(email);
      const row = page.getByRole("row", { name: new RegExp(email) });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Aprovar" }).click();
      await page.waitForTimeout(800);

      await page.getByRole("button", { name: /Conta de/ }).click();
      await page.getByRole("menuitem", { name: "Sair" }).click();

      await signInAs(page, email, AFFILIATE_PASSWORD, /\/painel/);

      await page.goto("/painel/links");
      const affiliate = await e2eDb.affiliate.findFirst({
        where: { user: { email } },
        select: { id: true, code: true },
      });
      expect(affiliate?.code).toBeTruthy();
      if (!affiliate?.code) throw new Error("Código do afiliado ausente após aprovação.");

      await context.clearCookies();
      await page.goto(`/r/${affiliate.code}/consulta-avaliacao`);
      await expect(page).toHaveURL(/\/p\/consulta-avaliacao/);

      const buyerEmail = uniqueEmail("buyer");
      await fillCheckoutPix(page, buyerEmail, "Comprador Fluxo");
      await expect(page.getByText(/Pedido IF-/i)).toBeVisible({ timeout: 15_000 });
      const orderUrl = page.url();
      const match = /pedido\/(IF-[A-Z0-9]+)/.exec(orderUrl);
      const code = match?.[1];
      expect(code).toBeTruthy();
      if (!code) throw new Error("Código do pedido não encontrado.");

      await forcePaid(page, code);

      const order = await e2eDb.order.findUnique({
        where: { publicCode: code },
        include: { commission: true },
      });
      expect(order?.affiliateId).toBe(affiliate.id);
      expect(order?.status).toBe("PAID");
      expect(order?.commission?.status).toBe("PENDING");
      if (!order?.commission) throw new Error("Comissão não criada.");

      await e2eDb.commission.update({
        where: { id: order.commission.id },
        data: { availableAt: new Date(Date.now() - 1000) },
      });

      const cronSecret = process.env.CRON_SECRET;
      expect(cronSecret).toBeTruthy();
      const cronRes = await page.request.post("/api/cron/release-commissions", {
        headers: { Authorization: `Bearer ${cronSecret ?? ""}` },
      });
      expect(cronRes.ok()).toBe(true);

      const released = await e2eDb.commission.findUnique({ where: { id: order.commission.id } });
      expect(released?.status).toBe("AVAILABLE");

      await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin/);
      await page.goto("/admin/pagamentos");
      const payoutRow = page.locator("tr").filter({ hasText: affiliate.code }).first();
      await expect(payoutRow).toBeVisible({ timeout: 10_000 });
      await payoutRow.getByRole("button", { name: "Gerar lote" }).click();
      await expect(page).toHaveURL(/\/admin\/pagamentos\//, { timeout: 15_000 });

      await page.getByRole("button", { name: "Revelar" }).click();
      await expect(page.getByText(/Chave Pix revelada|copiar chave/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.getByLabel("Referência Pix (E2E/ID)").fill(`E2E-FLUXO-${String(Date.now())}`);
      await page.getByRole("button", { name: "Marcar como pago" }).click();
      await page.getByRole("button", { name: "Confirmar pagamento" }).click();
      await expect(page.getByText(/Lote pago|imutável/i).first()).toBeVisible({
        timeout: 15_000,
      });

      await context.clearCookies();
      await signInAs(page, email, AFFILIATE_PASSWORD, /\/painel/);
      await page.goto("/painel/comissoes");
      await expect(page.getByRole("heading", { name: "Pagamentos recebidos" })).toBeVisible();
      await expect(page.getByText(/Mês \d{4}-\d{2}/).first()).toBeVisible({ timeout: 10_000 });
    } finally {
      await removeUserByEmail(email);
    }
  });

  test("cartão recusado mostra mensagem", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "já coberto no desktop");
    await page.goto("/p/consulta-avaliacao");
    await page.getByLabel("Nome completo").fill("Cartão Recusa");
    await page.getByLabel("E-mail").fill(uniqueEmail("card"));
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
  });

  test("estorno reverte comissão", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "já coberto no desktop");
    const affiliate = await e2eDb.affiliate.findFirst({
      where: { user: { email: "afiliado.aprovado@exemplo.test" } },
      select: { id: true, code: true },
    });
    expect(affiliate?.code).toBeTruthy();
    if (!affiliate?.code) throw new Error("Afiliado seed não encontrado.");

    await page.goto(`/r/${affiliate.code}/consulta-avaliacao`);
    const buyerEmail = uniqueEmail("refund");
    await fillCheckoutPix(page, buyerEmail, "Comprador Estorno");
    await expect(page.getByText(/Pedido IF-/i)).toBeVisible({ timeout: 15_000 });
    const match = /pedido\/(IF-[A-Z0-9]+)/.exec(page.url());
    const code = match?.[1];
    expect(code).toBeTruthy();
    if (!code) throw new Error("Código do pedido não encontrado.");

    await forcePaid(page, code);
    await page.goto("/dev/pagarme");
    const row = page.locator("li").filter({ hasText: code }).first();
    await row.getByRole("button", { name: "refunded" }).click();
    await waitForOrderStatus(code, "REFUNDED");

    const order = await e2eDb.order.findUnique({
      where: { publicCode: code },
      include: { commission: true },
    });
    expect(order?.status).toBe("REFUNDED");
    expect(order?.commission?.status).toBe("REVERSED");
  });

  test("download respeita o limite do grant", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "já coberto no desktop");
    const slug = `ebook-limite-${String(Date.now())}`;
    const storageDir = process.env.STORAGE_DIR ?? "./storage";
    const relative = `products/e2e-${slug}.pdf`;
    const absolute = path.resolve(storageDir, relative);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, Buffer.from("%PDF-1.4 e2e-limit\n%%EOF\n"));

    const product = await e2eDb.product.create({
      data: {
        slug,
        name: "E-book Limite E2E",
        type: "DIGITAL",
        status: "ACTIVE",
        shortDescription: "Limite de download",
        description: "Teste",
        priceCents: 1900,
        commissionType: "FIXED",
        commissionValue: 200,
        allowPix: true,
        allowCard: true,
        maxInstallments: 1,
        digitalFile: {
          create: {
            storagePath: relative,
            originalName: "ebook-limite.pdf",
            mimeType: "application/pdf",
            sizeBytes: 24,
            sha256: "c".repeat(64),
          },
        },
      },
    });

    try {
      await page.goto(`/p/${slug}`);
      await fillCheckoutPix(page, uniqueEmail("dl"), "Comprador Limite");
      await expect(page.getByText(/Pedido IF-/i)).toBeVisible({ timeout: 15_000 });
      const match = /pedido\/(IF-[A-Z0-9]+)/.exec(page.url());
      const code = match?.[1];
      expect(code).toBeTruthy();
      if (!code) throw new Error("Código do pedido não encontrado.");

      await forcePaid(page, code);

      await expect
        .poll(async () =>
          e2eDb.downloadGrant.findFirst({ where: { order: { publicCode: code } } }),
        )
        .toBeTruthy();
      const grant = await e2eDb.downloadGrant.findFirst({
        where: { order: { publicCode: code } },
      });
      expect(grant).toBeTruthy();
      if (!grant) throw new Error("Grant ausente.");

      await e2eDb.downloadGrant.update({
        where: { id: grant.id },
        data: { downloadCount: grant.maxDownloads },
      });

      const mail = await e2eDb.emailLog.findFirst({
        where: { template: "order-paid", to: { contains: "e2e.fluxo.dl." } },
        orderBy: { createdAt: "desc" },
        select: { preview: true },
      });
      const html = mail?.preview ?? "";
      const dl = /href="([^"]*\/download\/[^"]+)"/.exec(html);
      expect(dl?.[1]).toBeTruthy();
      const downloadUrl = (dl?.[1] ?? "").replaceAll("&amp;", "&");

      await page.goto(downloadUrl);
      await expect(page.getByRole("heading", { name: /Limite atingido/i })).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await e2eDb.downloadGrant.deleteMany({ where: { order: { productId: product.id } } });
      await e2eDb.order.deleteMany({ where: { productId: product.id } });
      await e2eDb.digitalFile.deleteMany({ where: { productId: product.id } });
      await e2eDb.product.deleteMany({ where: { id: product.id } });
    }
  });
});
