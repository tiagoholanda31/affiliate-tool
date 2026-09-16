import { expect, test } from "@playwright/test";

/**
 * Smoke da fatia 00: o app sobe, a vitrine renderiza com a identidade da marca
 * e o health check enxerga o banco. Se isto quebrar, nada mais importa.
 */

test("a vitrine carrega com a marca do programa", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Affiliate Tool/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Programa de Afiliados");
  await expect(page.getByRole("link", { name: "Affiliate Tool — página inicial" })).toBeVisible();

  // Selo do rodapé exigido pela spec para as telas públicas.
  await expect(page.getByText("Pagamento seguro via Pagar.me")).toBeVisible();
});

test("o health check responde com o banco de pé", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  const body = (await response.json()) as { ok: boolean; db: boolean; version: string };
  expect(body).toMatchObject({ ok: true, db: true });
  expect(typeof body.version).toBe("string");
});

test("endereço inexistente cai no 404 com identidade visual", async ({ page }) => {
  const response = await page.goto("/nao-existe-esta-rota");

  expect(response?.status()).toBe(404);
  await expect(page.getByText("Página não encontrada")).toBeVisible();
  await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
});

test("a navegação por teclado começa pelo link de pular conteúdo", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skip = page.getByRole("link", { name: "Pular para o conteúdo" });
  await expect(skip).toBeFocused();
});

test("as respostas trazem os cabeçalhos de segurança", async ({ request }) => {
  const response = await request.get("/api/health");
  const headers = response.headers();

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["content-security-policy"]).toMatch(/'nonce-[^']+'/);
  expect(headers["content-security-policy-report-only"]).toBeUndefined();
  expect(headers["strict-transport-security"]).toContain("preload");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();
});
