import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Preenche depois da hidratação do React Hook Form. Sem isso o `fill` cai no
 * HTML do servidor e o client reset com `defaultValues` vazio.
 */
export async function fillHydrated(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value);
  }).toPass({ timeout: 10_000 });
}

export async function signInAs(
  page: Page,
  email: string,
  password: string,
  dest: RegExp,
): Promise<void> {
  await page.goto("/entrar");
  await fillHydrated(page.getByLabel("E-mail"), email);
  await fillHydrated(page.getByRole("textbox", { name: "Senha" }), password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(dest, { timeout: 20_000 });
}
