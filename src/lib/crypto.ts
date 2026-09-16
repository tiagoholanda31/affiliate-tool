/**
 * Criptografia e mascaramento.
 *
 * `encrypt`/`decrypt` protegem dados sensíveis em repouso (chave Pix do afiliado,
 * CPF do comprador) com AES-256-GCM — cifra autenticada, então adulterar o texto
 * cifrado faz o `decrypt` falhar em vez de devolver lixo.
 *
 * `mask*` produz a versão que pode aparecer na tela ou no log. Regra do CLAUDE.md:
 * nunca exponha chave Pix completa nem CPF completo no client.
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96 bits: tamanho recomendado para GCM
const AUTH_TAG_BYTES = 16;
const PAYLOAD_VERSION = "v1";

function parseKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY deve ter 32 bytes em base64.");
  }
  return key;
}

/**
 * Cifra um texto com uma chave explícita.
 * Formato: `v1.<iv>.<tag>.<cifra>`, tudo em base64url.
 * Usado pela rotação (`scripts/rotate-encryption-key.ts`).
 */
export function encryptWithKey(plainText: string, keyBase64: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, parseKey(keyBase64), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    PAYLOAD_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Decifra com uma chave explícita. Lança se o payload foi adulterado. */
export function decryptWithKey(payload: string, keyBase64: string): string {
  const parts = payload.split(".");
  if (parts.length !== 4) {
    throw new Error("Payload cifrado em formato inválido.");
  }

  const [version, ivPart, tagPart, dataPart] = parts as [string, string, string, string];
  if (version !== PAYLOAD_VERSION) {
    throw new Error(`Versão de criptografia não suportada: ${version}`);
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(tagPart, "base64url");
  if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
    throw new Error("Payload cifrado em formato inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, parseKey(keyBase64), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Cifra um texto. Formato: `v1.<iv>.<tag>.<cifra>`, tudo em base64url.
 * O prefixo de versão permite trocar de algoritmo depois sem quebrar o que já
 * está no banco (ver scripts/rotate-encryption-key.ts).
 */
export function encrypt(plainText: string): string {
  return encryptWithKey(plainText, env.ENCRYPTION_KEY);
}

/** Decifra o formato produzido por `encrypt`. Lança se o payload foi adulterado. */
export function decrypt(payload: string): string {
  return decryptWithKey(payload, env.ENCRYPTION_KEY);
}

/** SHA-256 em hexadecimal. */
export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Token aleatório em base64url — links de download, verificação de e-mail. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/**
 * Hash do token para guardar no banco. Guardamos o hash, não o token: quem lê o
 * banco não consegue usar o link. Não precisa de salt — o token já é aleatório.
 */
export function hashToken(token: string): string {
  return sha256(token);
}

/** Comparação em tempo constante, para não vazar o segredo pelo tempo de resposta. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/** Tipos de chave Pix aceitos (espelha o enum `PixKeyType` do Prisma). */
export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM";

/**
 * Versão exibível de uma chave Pix — o suficiente para o afiliado reconhecer a
 * própria chave, insuficiente para alguém copiar.
 *
 * CPF    `123.456.789-09` → `***.456.789-**`
 * CNPJ   `12345678000190` → `**.345.678/0001-**`
 * E-mail `maria@exemplo.com` → `ma***@exemplo.com`
 * Fone   `+5511987654321` → `(11) *****-4321`
 * Aleat. `uuid` → `9f2c…a17b`
 */
export function maskPixKey(key: string, type: PixKeyType): string {
  const digits = key.replace(/\D/g, "");

  switch (type) {
    case "CPF": {
      if (digits.length !== 11) return maskGeneric(key);
      return `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`;
    }
    case "CNPJ": {
      if (digits.length !== 14) return maskGeneric(key);
      return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
    }
    case "EMAIL": {
      return maskEmail(key);
    }
    case "PHONE": {
      if (digits.length < 10) return maskGeneric(key);
      const local = digits.slice(-11);
      const ddd = local.slice(0, 2);
      const last4 = local.slice(-4);
      return `(${ddd}) *****-${last4}`;
    }
    case "RANDOM": {
      return maskGeneric(key);
    }
  }
}

/** `123.456.789-09` → `***.456.789-**`. Nunca exiba CPF inteiro no client. */
export function maskCpf(cpf: string): string {
  return maskPixKey(cpf, "CPF");
}

/** `maria@exemplo.com` → `ma***@exemplo.com`. */
export function maskEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return maskGeneric(email);

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

/** Mostra só as pontas: `9f2c…a17b`. */
function maskGeneric(value: string): string {
  if (value.length <= 8) return "*".repeat(Math.max(value.length, 4));
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
