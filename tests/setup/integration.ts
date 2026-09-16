/**
 * Ambiente dos testes de integração.
 *
 * Roda antes de qualquer import do app, então é aqui que `DATABASE_URL` passa a
 * apontar para o banco descartável — `src/lib/env.ts` lê `process.env` no
 * momento em que é importado, e depois disso não há como trocar.
 */
// Sem isto o arquivo seria um script global e `TEST_ENV` colidiria com o de
// `node.ts`, que declara a mesma constante.
export {};

const TEST_ENV: Record<string, string> = {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.DATABASE_URL_TEST ??
    "postgresql://affiliate:affiliate@localhost:5434/affiliate_test?schema=public",
  APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  ADMIN_EMAIL: "admin@teste.local",
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  REF_COOKIE_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  CRON_SECRET: "chave-de-teste-com-mais-de-32-caracteres!!",
  // Nada sai para a internet: o driver `log` só grava em `EmailLog`.
  MAIL_DRIVER: "log",
  PAGARME_DRIVER: "fake",
  STORAGE_DIR: process.env.STORAGE_DIR ?? "./storage-test",
};

// `DATABASE_URL` é sobrescrita de propósito: um `.env` apontando para o banco de
// desenvolvimento não pode vazar para cá e apagar dados reais no `truncateAll`.
process.env.DATABASE_URL = TEST_ENV.DATABASE_URL;

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
