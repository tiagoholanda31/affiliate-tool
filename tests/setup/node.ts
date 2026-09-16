/**
 * Ambiente dos testes unitários de `src/lib` e services.
 *
 * Define variáveis mínimas para `src/lib/env.ts` validar sem um `.env` presente,
 * com valores fixos — a `ENCRYPTION_KEY` aqui é de teste e não protege nada.
 */
// Marca o arquivo como módulo: sem isto `TEST_ENV` seria uma variável global e
// colidiria com a homônima de `integration.ts`.
export {};

const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://affiliate:affiliate@localhost:5434/affiliate_test?schema=public",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ADMIN_EMAIL: "admin@teste.local",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  REF_COOKIE_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  CRON_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  MAIL_DRIVER: "log",
  PAGARME_DRIVER: "fake",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
