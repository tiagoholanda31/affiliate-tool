import { expect, test } from "@playwright/test";

import { signInAs } from "../helpers/e2e-auth";
import { e2eDb, getVerificationLink, removeUserByEmail } from "../helpers/e2e-db";

/**
 * Admin aprova afiliado pendente e o afiliado passa a acessar o painel.
 *
 * Usa o admin criado pelo seed (`ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`) e um
 * afiliado novo cadastrado pelo próprio fluxo de cadastro.
 */
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "admin-seed-2026-mudar";
const AFFILIATE_PASSWORD = "trufaAzulNoTelhado";

function uniqueEmail(): string {
  return `e2e.aprovacao.${String(Date.now())}@exemplo.test`;
}

test.describe("admin aprova afiliado", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("admin aprova cadastro e afiliado vê o painel", async ({ page }) => {
    const email = uniqueEmail();

    try {
      // ── Cadastro do afiliado ──────────────────────────────────────────────
      await page.goto("/cadastro");
      await page.getByLabel("Nome completo").fill("Maria Souza");
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("textbox", { name: "Senha" }).fill(AFFILIATE_PASSWORD);
      await page.getByLabel("Celular").fill("11987654321");
      await page.getByLabel("Rede social").click();
      await page.getByRole("option", { name: "Instagram" }).click();
      await page.getByLabel("Seu @").fill("maria.afiliada");
      await page.getByRole("button", { name: "Continuar" }).click();

      await page.getByLabel("Tipo da chave Pix").click();
      await page.getByRole("option", { name: "CPF", exact: true }).click();
      await page.getByRole("textbox", { name: "Chave Pix" }).fill("52998224725");
      await page.getByRole("checkbox").check();
      await page.waitForTimeout(3_200);
      await page.getByRole("button", { name: "Criar minha conta" }).click();

      await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();

      // Confirma e-mail para criar o cadastro pendente.
      await page.goto(await getVerificationLink(email));
      await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();

      // ── Login do admin ────────────────────────────────────────────────────
      await signInAs(page, ADMIN_EMAIL, ADMIN_PASSWORD, /\/admin$/);

      // ── Aprovação ─────────────────────────────────────────────────────────
      await page.goto("/admin/afiliados?status=PENDING");
      await expect(page.getByRole("heading", { name: "Afiliados" })).toBeVisible();
      await page.getByLabel("Buscar afiliados").fill(email);
      const row = page.getByRole("row", { name: new RegExp(email) });
      await expect(row).toBeVisible();
      await row.getByRole("button", { name: "Aprovar" }).click();

      // Aguarda a revalidação e o e-mail de aprovação.
      await page.waitForTimeout(800);
      await expect(page.getByRole("row", { name: /Maria Souza/ })).not.toBeVisible();

      // Sai da conta admin para poder entrar como afiliado.
      await page.getByRole("button", { name: /Conta de/ }).click();
      await page.getByRole("menuitem", { name: "Sair" }).click();
      await expect(page).toHaveURL(/\/entrar/);

      // ── Afiliado loga e vê o painel ───────────────────────────────────────
      await signInAs(page, email, AFFILIATE_PASSWORD, /\/painel$/);
      await expect(page.getByRole("heading", { name: /Olá,/ })).toBeVisible();
    } finally {
      await removeUserByEmail(email);
    }
  });
});
