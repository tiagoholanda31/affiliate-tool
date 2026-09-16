import { expect, test } from "@playwright/test";

import { e2eDb, getVerificationLink, removeUserByEmail } from "../helpers/e2e-db";

/**
 * Fluxo completo da fatia 01, do jeito que o afiliado vive:
 * cadastro em dois passos → link de confirmação lido do `EmailLog` → login →
 * tela "Cadastro em análise".
 *
 * Roda em desktop e no celular (390 px) — o painel do afiliado é usado
 * majoritariamente pelo telefone (docs/spec/05).
 */

/** E-mail único por execução e por projeto, para os dois navegadores não brigarem. */
function uniqueEmail(project: string): string {
  return `e2e.${project}.${String(Date.now())}@exemplo.test`;
}

const PASSWORD = "trufaAzulNoTelhado";

test.describe("cadastro de afiliado", () => {
  test.afterAll(async () => {
    await e2eDb.$disconnect();
  });

  test("cadastra, confirma o e-mail, entra e cai na tela de análise", async ({
    page,
  }, testInfo) => {
    const email = uniqueEmail(testInfo.project.name);

    try {
      await page.goto("/cadastro");

      // ── Passo 1: dados ────────────────────────────────────────────────────
      await expect(page.getByRole("heading", { name: "Criar sua conta" })).toBeVisible();

      await page.getByLabel("Nome completo").fill("Maria Souza");
      await page.getByLabel("E-mail").fill(email);
      // Por papel: o "*" do obrigatório muda o label ("Senha*") e o botão
      // "Mostrar senha" também casa com "Senha" por getByLabel.
      await page.getByRole("textbox", { name: "Senha" }).fill(PASSWORD);
      await page.getByLabel("Celular").fill("11987654321");

      await page.getByLabel("Rede social").click();
      await page.getByRole("option", { name: "Instagram" }).click();

      await page.getByLabel("Seu @").fill("maria.afiliada");
      await page.getByRole("button", { name: "Continuar" }).click();

      // ── Passo 2: Pix e termos ─────────────────────────────────────────────
      await page.getByLabel("Tipo da chave Pix").click();
      await page.getByRole("option", { name: "CPF", exact: true }).click();

      // Por papel: o label "Tipo da chave Pix*" também casa com "Chave Pix".
      await page.getByRole("textbox", { name: "Chave Pix" }).fill("52998224725");
      // A máscara é aplicada enquanto se digita.
      await expect(page.getByRole("textbox", { name: "Chave Pix" })).toHaveValue("529.982.247-25");

      const terms = page.getByRole("link", { name: /Termos do Programa/ });
      await expect(terms).toHaveAttribute("href", "/termos");
      await page.getByRole("checkbox").check();

      // O anti-bot exige um tempo mínimo de preenchimento (docs/spec/04) e o
      // Playwright preenche rápido demais — espera o mínimo passar.
      await page.waitForTimeout(3_200);

      await page.getByRole("button", { name: "Criar minha conta" }).click();

      // ── Confirmação de e-mail ─────────────────────────────────────────────
      await expect(page.getByRole("heading", { name: "Confira seu e-mail" })).toBeVisible();
      await expect(page.getByText(email)).toBeVisible();

      // Antes de confirmar, o login precisa recusar (docs/spec/04).
      await page.goto("/entrar");
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("textbox", { name: "Senha" }).fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();
      // O anunciador de rotas do Next também tem role="alert"; filtra pelo texto.
      await expect(
        page.getByRole("alert").filter({ hasText: "Confirme seu e-mail" }),
      ).toBeVisible();

      // O link vem do EmailLog, como manda a spec 07 para o driver `log`.
      // O mais recente é o reenviado pela tentativa de login acima — e mesmo
      // ele precisa terminar na tela de confirmação (regressão: callbackURL=/).
      await page.goto(await getVerificationLink(email));
      await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();

      // ── Login e tela de status ────────────────────────────────────────────
      await page.getByRole("link", { name: "Entrar na minha conta" }).click();
      await page.getByLabel("E-mail").fill(email);
      await page.getByRole("textbox", { name: "Senha" }).fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar" }).click();

      await expect(page).toHaveURL(/\/painel\/aguardando$/);
      await expect(page.getByRole("heading", { name: "Cadastro em análise" })).toBeVisible();

      // Os dados enviados aparecem para conferência, com a chave Pix mascarada.
      await expect(page.getByText("529.982.247-25")).toHaveCount(0);
      await expect(page.getByText("***.982.247-**")).toBeVisible();

      // Quem está em análise não entra na home do painel nem na área admin.
      // A tela de trabalho /painel/links ainda não existe nesta fatia; o
      // redirecionamento de rotas inexistentes é tratado pelo 404, não pela
      // regra de status.
      await page.goto("/painel");
      await expect(page).toHaveURL(/\/painel\/aguardando$/);

      await page.goto("/admin");
      await expect(page).toHaveURL(/\/painel\/aguardando$/);
    } finally {
      await removeUserByEmail(email);
    }
  });

  test("sem sessão, o painel manda para o login guardando o destino", async ({ page }) => {
    await page.goto("/painel/perfil");

    await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fperfil$/);
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  });

  test("cadastro válida os campos antes de deixar avançar", async ({ page }) => {
    await page.goto("/cadastro");

    await page.getByRole("button", { name: "Continuar" }).click();

    // Continua no passo 1, com o resumo de erros no topo. O anunciador de
    // rotas do Next também tem role="alert", então filtra pelo texto.
    await expect(
      page.getByRole("alert").filter({ hasText: "Confira os campos abaixo" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  });
});
