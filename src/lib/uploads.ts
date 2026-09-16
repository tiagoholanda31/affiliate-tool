/**
 * Validação de uploads e processamento de capa (sharp).
 *
 * Magic bytes via `file-type` — extensão sozinha não basta (docs/spec/04).
 * Capas saem como WebP sem EXIF, em três tamanhos 4:3.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

import { sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { resolveStoragePath, type StoredFile } from "@/lib/storage";
import {
  COVER_MAX_BYTES,
  DIGITAL_MAX_BYTES,
  MATERIAL_IMAGE_MAX_BYTES,
  MATERIAL_PDF_MAX_BYTES,
} from "@/lib/upload-limits";

export {
  COVER_MAX_BYTES,
  DIGITAL_MAX_BYTES,
  MATERIAL_IMAGE_MAX_BYTES,
  MATERIAL_PDF_MAX_BYTES,
} from "@/lib/upload-limits";

const DIGITAL_MIME = {
  "application/pdf": "pdf",
  "application/epub+zip": "epub",
} as const;

const COVER_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type DigitalUploadResult = StoredFile & {
  mime: string;
  originalName: string;
};

export type CoverUploadResult = {
  /** Caminho da variante média (`-md.webp`) — gravado em `Product.coverImagePath`. */
  path: string;
  paths: { sm: string; md: string; lg: string };
  sha256: string;
  size: number;
  mime: "image/webp";
};

const COVER_SIZES = {
  sm: { width: 400, height: 300 },
  md: { width: 800, height: 600 },
  lg: { width: 1200, height: 900 },
} as const;

export async function saveDigitalUpload(
  buffer: Buffer,
  originalName: string,
): Promise<DigitalUploadResult> {
  if (buffer.byteLength > DIGITAL_MAX_BYTES) {
    throw new AppError(
      "VALIDATION",
      `Arquivo muito grande. O limite é ${String(DIGITAL_MAX_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !(detected.mime in DIGITAL_MIME)) {
    throw new AppError(
      "VALIDATION",
      "Arquivo inválido. Envie um PDF ou EPUB (o conteúdo precisa bater com a extensão).",
    );
  }

  const mime = detected.mime as keyof typeof DIGITAL_MIME;
  const ext = DIGITAL_MIME[mime];
  const relativePath = path.posix.join("products", `${randomUUID()}.${ext}`);
  const absolute = resolveStoragePath(relativePath);

  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);

  return {
    path: relativePath,
    sha256: sha256(buffer),
    size: buffer.byteLength,
    mime,
    originalName: sanitizeOriginalName(originalName, ext),
  };
}

export async function saveCoverUpload(buffer: Buffer): Promise<CoverUploadResult> {
  if (buffer.byteLength > COVER_MAX_BYTES) {
    throw new AppError("VALIDATION", "Imagem de capa muito grande. O limite é 8 MB.");
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !(detected.mime in COVER_MIME)) {
    throw new AppError("VALIDATION", "Capa inválida. Use JPEG, PNG ou WebP.");
  }

  const id = randomUUID();
  const paths = {
    sm: path.posix.join("products", "covers", `${id}-sm.webp`),
    md: path.posix.join("products", "covers", `${id}-md.webp`),
    lg: path.posix.join("products", "covers", `${id}-lg.webp`),
  };

  // `rotate()` aplica orientação EXIF; o WebP de saída não leva metadados.
  const base = sharp(buffer).rotate();

  const encoded: Record<keyof typeof COVER_SIZES, Buffer> = {
    sm: await base
      .clone()
      .resize(COVER_SIZES.sm.width, COVER_SIZES.sm.height, { fit: "cover", position: "centre" })
      .webp({ quality: 82 })
      .toBuffer(),
    md: await base
      .clone()
      .resize(COVER_SIZES.md.width, COVER_SIZES.md.height, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer(),
    lg: await base
      .clone()
      .resize(COVER_SIZES.lg.width, COVER_SIZES.lg.height, { fit: "cover", position: "centre" })
      .webp({ quality: 88 })
      .toBuffer(),
  };

  for (const [size, content] of Object.entries(encoded) as [keyof typeof paths, Buffer][]) {
    const absolute = resolveStoragePath(paths[size]);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }

  return {
    path: paths.md,
    paths,
    sha256: sha256(encoded.md),
    size: encoded.md.byteLength,
    mime: "image/webp",
  };
}

/** Deriva `-sm`/`-lg` a partir do caminho médio gravado no produto. */
export function coverVariantPath(mdPath: string, size: "sm" | "md" | "lg"): string {
  if (size === "md") return mdPath;
  return mdPath.replace(/-md\.webp$/i, `-${size}.webp`);
}

const MATERIAL_IMAGE_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type MaterialFileUploadResult = {
  path: string;
  thumbPath?: string;
  sha256: string;
  size: number;
  mime: string;
  originalName: string;
};

/**
 * Material IMAGE: guarda o original (qualidade para o afiliado) + thumb WebP 800×600.
 */
export async function saveMaterialImageUpload(
  buffer: Buffer,
  originalName: string,
): Promise<MaterialFileUploadResult> {
  if (buffer.byteLength > MATERIAL_IMAGE_MAX_BYTES) {
    throw new AppError("VALIDATION", "Imagem muito grande. O limite é 10 MB.");
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !(detected.mime in MATERIAL_IMAGE_MIME)) {
    throw new AppError("VALIDATION", "Imagem inválida. Use JPEG, PNG ou WebP.");
  }

  const mime = detected.mime as keyof typeof MATERIAL_IMAGE_MIME;
  const ext = MATERIAL_IMAGE_MIME[mime];
  const id = randomUUID();
  const relativePath = path.posix.join("materials", `${id}.${ext}`);
  const thumbPath = path.posix.join("materials", `${id}-thumb.webp`);

  const absolute = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);

  const thumb = await sharp(buffer)
    .rotate()
    .resize(800, 600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await writeFile(resolveStoragePath(thumbPath), thumb);

  return {
    path: relativePath,
    thumbPath,
    sha256: sha256(buffer),
    size: buffer.byteLength,
    mime,
    originalName: sanitizeOriginalName(originalName, ext),
  };
}

/** Material PDF — original intacto sob `materials/`. */
export async function saveMaterialPdfUpload(
  buffer: Buffer,
  originalName: string,
): Promise<MaterialFileUploadResult> {
  if (buffer.byteLength > MATERIAL_PDF_MAX_BYTES) {
    throw new AppError("VALIDATION", "PDF muito grande. O limite é 20 MB.");
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (detected?.mime !== "application/pdf") {
    throw new AppError("VALIDATION", "Arquivo inválido. Envie um PDF.");
  }

  const relativePath = path.posix.join("materials", `${randomUUID()}.pdf`);
  const absolute = resolveStoragePath(relativePath);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, buffer);

  return {
    path: relativePath,
    sha256: sha256(buffer),
    size: buffer.byteLength,
    mime: "application/pdf",
    originalName: sanitizeOriginalName(originalName, "pdf"),
  };
}

/**
 * Detecta IMAGE vs PDF e aplica o limite correto.
 * Usado pelo Route Handler `kind=material`.
 */
export async function saveMaterialUpload(
  buffer: Buffer,
  originalName: string,
): Promise<MaterialFileUploadResult> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected) {
    throw new AppError("VALIDATION", "Arquivo inválido. Envie uma imagem ou PDF.");
  }
  if (detected.mime === "application/pdf") {
    return saveMaterialPdfUpload(buffer, originalName);
  }
  if (detected.mime in MATERIAL_IMAGE_MIME) {
    return saveMaterialImageUpload(buffer, originalName);
  }
  throw new AppError("VALIDATION", "Tipo não suportado. Use JPEG, PNG, WebP ou PDF.");
}

function sanitizeOriginalName(name: string, ext: string): string {
  const base = path.basename(name).replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  if (base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base || "arquivo"}.${ext}`;
}
