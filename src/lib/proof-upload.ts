/**
 * Comprovante de pagamento Pix (imagem ou PDF ≤ 5 MB) em `proofs/`.
 */
import { fileTypeFromBuffer } from "file-type";

import { AppError } from "@/lib/errors";
import { saveFile, type StoredFile } from "@/lib/storage";

export const PROOF_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const PROOF_MIME = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type ProofUploadResult = StoredFile & {
  mime: string;
  originalName: string;
};

export async function saveProofUpload(
  buffer: Buffer,
  originalName: string,
): Promise<ProofUploadResult> {
  if (buffer.byteLength > PROOF_MAX_BYTES) {
    throw new AppError("VALIDATION", "Comprovante muito grande. O limite é 5 MB.");
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !(detected.mime in PROOF_MIME)) {
    throw new AppError(
      "VALIDATION",
      "Comprovante inválido. Envie PDF, JPEG, PNG ou WebP.",
    );
  }

  const mime = detected.mime as keyof typeof PROOF_MIME;
  const ext = PROOF_MIME[mime];
  const stored = await saveFile(buffer, { bucket: "proofs", ext });

  return {
    ...stored,
    mime,
    originalName: sanitizeProofName(originalName, ext),
  };
}

function sanitizeProofName(name: string, ext: string): string {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80);
  const withoutExt = base.replace(/\.[^.]+$/, "");
  return `${withoutExt || "comprovante"}.${ext}`;
}
