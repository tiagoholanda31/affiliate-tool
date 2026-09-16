/**
 * Armazenamento de arquivos em disco.
 *
 * Raiz em `STORAGE_DIR` (em produção, o volume montado em `/data/storage`).
 * Subpastas: `products/` (livros digitais), `materials/` (peças de divulgação),
 * `proofs/` (comprovantes de pagamento).
 *
 * Regras de segurança (docs/spec/04):
 * - o nome do arquivo é um UUID gerado aqui; o nome enviado pelo usuário nunca
 *   vira caminho;
 * - nada é servido estaticamente: o download passa por Route Handler com token;
 * - o caminho absoluto nunca é exposto ao client — guardamos o caminho relativo.
 */
import { createReadStream, type ReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";

export const STORAGE_BUCKETS = ["products", "materials", "proofs"] as const;
export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

export type StoredFile = {
  /** Caminho relativo à raiz do storage, ex. `products/9f2c….pdf`. */
  path: string;
  sha256: string;
  size: number;
};

/** Raiz absoluta do storage. */
export function storageRoot(): string {
  return path.resolve(env.STORAGE_DIR);
}

/** Caminho absoluto de um arquivo, validando que ele não escapa da raiz. */
export function resolveStoragePath(relativePath: string): string {
  const root = storageRoot();
  const absolute = path.resolve(root, relativePath);

  // Defesa contra path traversal (`../../etc/passwd`) vindo de dado do banco.
  const relative = path.relative(root, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new AppError("FORBIDDEN", "Caminho de arquivo inválido.", { expose: false });
  }

  return absolute;
}

/**
 * Grava um arquivo e devolve caminho relativo, hash e tamanho.
 * A extensão é normalizada: só letras e números, no máximo 8 caracteres.
 */
export async function saveFile(
  content: Buffer,
  options: { bucket: StorageBucket; ext: string },
): Promise<StoredFile> {
  const ext = normalizeExtension(options.ext);
  const relativePath = path.posix.join(options.bucket, `${randomUUID()}${ext}`);
  const absolute = resolveStoragePath(relativePath);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, content);

  return {
    path: relativePath,
    sha256: sha256(content),
    size: content.byteLength,
  };
}

/** Stream de leitura — usado pelo Route Handler de download, sem carregar tudo na RAM. */
export function openStream(relativePath: string): ReadStream {
  return createReadStream(resolveStoragePath(relativePath));
}

/** Remove um arquivo; não falha se ele já não existir. */
export async function deleteFile(relativePath: string): Promise<void> {
  await rm(resolveStoragePath(relativePath), { force: true });
}

/** Tamanho em bytes, ou `null` se o arquivo sumiu do volume. */
export async function fileSize(relativePath: string): Promise<number | null> {
  try {
    const stats = await stat(resolveStoragePath(relativePath));
    return stats.size;
  } catch {
    return null;
  }
}

/** Garante que as subpastas existem (chamado no boot e no entrypoint). */
export async function ensureStorageDirs(): Promise<void> {
  for (const bucket of STORAGE_BUCKETS) {
    await mkdir(path.join(storageRoot(), bucket), { recursive: true });
  }
}

function normalizeExtension(ext: string): string {
  const cleaned = ext
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .slice(0, 8);
  return cleaned === "" ? "" : `.${cleaned}`;
}
