import "dotenv/config";

import { defineConfig } from "prisma/config";

/**
 * Configuração do CLI do Prisma (migrate, generate, studio, seed).
 *
 * A URL só é usada pelos comandos que falam com o banco. No `docker build` não
 * existe banco algum — por isso o fallback vazio em vez de `env()`, que
 * explodiria durante o `prisma generate`. Em runtime, o `migrate deploy` do
 * entrypoint recebe a URL real e o Prisma reclama sozinho se ela faltar.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
