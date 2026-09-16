// Config do Prisma usada **apenas dentro do container**.
//
// O `prisma.config.ts` da raiz é TypeScript e a imagem de produção não tem
// transpilador; esta versão em JavaScript puro é o que o `migrate deploy` do
// entrypoint carrega. Fica ao lado do CLI isolado (/app/migrator) para que o
// import de "prisma/config" resolva.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "/app/prisma/schema.prisma",
  migrations: {
    path: "/app/prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
