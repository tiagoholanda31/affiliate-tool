/**
 * Código público legível do pedido: `IF-` + 6 chars `[A-Z0-9]`.
 */
import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/0/1

export function generatePublicCode(): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (let i = 0; i < 6; i += 1) {
    const byte = bytes[i] ?? 0;
    const char = ALPHABET[byte % ALPHABET.length] ?? "A";
    suffix += char;
  }
  return `IF-${suffix}`;
}

export function isValidPublicCode(code: string): boolean {
  return /^IF-[A-Z0-9]{6}$/.test(code);
}
