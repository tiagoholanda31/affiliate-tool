import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://localhost:${String(PORT)}`;

/**
 * E2E dos fluxos críticos. Nesta fatia só o smoke; o fluxo completo
 * (cadastro → aprovação → link → checkout → comissão → pagamento) entra nas
 * fatias seguintes, sempre com `PAGARME_DRIVER=fake`.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Um worker: o Turbopack no Windows perde build-manifest com compiles em paralelo.
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // O afiliado usa o painel majoritariamente pelo celular.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Sobe o app sozinho; reaproveita um `pnpm dev` já rodando na porta.
  webServer: {
    command: "pnpm dev",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PAGARME_DRIVER: "fake", NEXT_PUBLIC_PAGARME_PUBLIC_KEY: "" },
  },
});
