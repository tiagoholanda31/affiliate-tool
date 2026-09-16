/**
 * Cria (ou confirma) o admin + a linha de Setting, sem dados de exemplo.
 *
 * Uso local: `pnpm exec tsx scripts/create-admin.ts`
 * Produção: apontar DATABASE_URL para o banco da VPS (app em manutenção se
 * já houver tráfego). Senha: SEED_ADMIN_PASSWORD (≥ 14 chars).
 *
 * Não rode o seed completo em produção — este script não cria afiliados nem
 * produtos de exemplo.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";

import { PrismaClient } from "../src/generated/prisma/client.js";

const CREDENTIAL_PROVIDER = "credential";

const TERMS_PLACEHOLDER = `# Termos do Programa de Afiliados

> Texto provisório. Substitua em /admin/configuracoes.

Ao participar do programa, você concorda em divulgar os serviços e materiais do
Affiliate Tool de forma honesta, sem prometer resultados que o produto não oferece.
`;

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida.");
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL não definida.");
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("SEED_ADMIN_PASSWORD não definida.");
  }
  if (adminPassword.length < 14) {
    throw new Error("SEED_ADMIN_PASSWORD precisa de pelo menos 14 caracteres.");
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  const issuer = createLocalAccountIssuer(CREDENTIAL_PROVIDER);

  try {
    await prisma.setting.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        termsMarkdown: TERMS_PLACEHOLDER,
        adminNotifyEmail: adminEmail,
        supportWhatsapp: "+5511912345678",
      },
    });
    console.log("Setting ok.");

    const existing = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true, role: true },
    });

    if (existing) {
      if (existing.role !== "ADMIN") {
        throw new Error(
          `O e-mail ${adminEmail} já existe com papel ${existing.role}. Recuse continuar.`,
        );
      }
      console.log(`Admin já existe (${adminEmail}). Senha não foi alterada.`);
      return;
    }

    const user = await prisma.user.create({
      data: {
        email: adminEmail,
        name: "Affiliate Tool Admin",
        role: "ADMIN",
        emailVerified: true,
      },
      select: { id: true },
    });

    await prisma.account.create({
      data: {
        userId: user.id,
        issuer,
        accountId: user.id,
        providerId: CREDENTIAL_PROVIDER,
        password: await hashPassword(adminPassword),
      },
    });

    console.log(`Admin criado (${adminEmail}). Troque a senha no primeiro login.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
