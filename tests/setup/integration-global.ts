/**
 * Prepara o banco dos testes de integração.
 *
 * Roda uma vez por execução: aplica as migrations no `db_test`
 * (`docker compose up -d db_test`, porta 5434). Usamos `migrate deploy` e não
 * `db push` — o CLAUDE.md proíbe `db push`, e rodar as migrations de verdade
 * também garante que elas funcionam num banco vazio.
 */
import { execSync } from "node:child_process";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL_TEST ??
  "postgresql://affiliate:affiliate@localhost:5434/affiliate_test?schema=public";

export function setup(): void {
  // Comando fixo, sem entrada externa: `execSync` via shell resolve o `pnpm`
  // tanto no Windows (.cmd) quanto no Linux, sem o DEP0190 de args + shell.
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
