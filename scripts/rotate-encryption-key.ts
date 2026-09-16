/**
 * Re-encripta Pix e CPF/CNPJ com uma nova ENCRYPTION_KEY.
 *
 * Uso (app em manutenção):
 *   OLD_KEY=<atual> NEW_KEY=<nova> pnpm exec tsx scripts/rotate-encryption-key.ts
 *
 * Depois do sucesso, troque ENCRYPTION_KEY no EasyPanel para NEW_KEY e faça
 * redeploy. Não rode com o app escrevendo as mesmas colunas.
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { PrismaClient } from "../src/generated/prisma/client.js";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const BATCH = 100;

function parseKey(keyBase64: string, label: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(`${label} deve ter 32 bytes em base64.`);
  }
  return key;
}

function encryptWith(plainText: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptWith(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 4) {
    throw new Error("Payload cifrado em formato inválido.");
  }
  const [version, ivPart, tagPart, dataPart] = parts as [string, string, string, string];
  if (version !== "v1") {
    throw new Error(`Versão de criptografia não suportada: ${version}`);
  }
  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Payload cifrado em formato inválido.");
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL não definida.");
  }

  const oldKeyRaw = process.env.OLD_KEY ?? process.env.ENCRYPTION_KEY;
  const newKeyRaw = process.env.NEW_KEY;
  if (!oldKeyRaw || !newKeyRaw) {
    throw new Error("Defina OLD_KEY (ou ENCRYPTION_KEY) e NEW_KEY (32 bytes em base64).");
  }
  if (oldKeyRaw === newKeyRaw) {
    throw new Error("NEW_KEY precisa ser diferente de OLD_KEY.");
  }

  const oldKey = parseKey(oldKeyRaw, "OLD_KEY");
  const newKey = parseKey(newKeyRaw, "NEW_KEY");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

  try {
    let pixCount = 0;
    let lastPixId: string | undefined;
    for (;;) {
      const rows = await prisma.affiliate.findMany({
        take: BATCH,
        where: lastPixId ? { id: { gt: lastPixId } } : undefined,
        orderBy: { id: "asc" },
        select: { id: true, pixKeyEncrypted: true },
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!row.pixKeyEncrypted) continue;
        const plain = decryptWith(row.pixKeyEncrypted, oldKey);
        await prisma.affiliate.update({
          where: { id: row.id },
          data: { pixKeyEncrypted: encryptWith(plain, newKey) },
        });
        pixCount += 1;
      }
      lastPixId = rows[rows.length - 1]?.id;
      if (rows.length < BATCH) break;
    }

    let docCount = 0;
    let lastOrderId: string | undefined;
    for (;;) {
      const rows = await prisma.order.findMany({
        take: BATCH,
        where: lastOrderId ? { id: { gt: lastOrderId } } : undefined,
        orderBy: { id: "asc" },
        select: { id: true, customerDocEnc: true },
      });
      if (rows.length === 0) break;

      for (const row of rows) {
        if (!row.customerDocEnc) continue;
        const plain = decryptWith(row.customerDocEnc, oldKey);
        await prisma.order.update({
          where: { id: row.id },
          data: { customerDocEnc: encryptWith(plain, newKey) },
        });
        docCount += 1;
      }
      lastOrderId = rows[rows.length - 1]?.id;
      if (rows.length < BATCH) break;
    }

    console.log(`Rotação ok: ${String(pixCount)} chaves Pix, ${String(docCount)} documentos.`);
    console.log("Agora defina ENCRYPTION_KEY=NEW_KEY no EasyPanel e faça redeploy.");
  } finally {
    await prisma.$disconnect();
  }
}

await main();
