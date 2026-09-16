/**
 * Limites de upload — constantes puras, seguras para schemas no client.
 * A I/O (sharp, fs) fica em `uploads.ts`.
 */
export const DIGITAL_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const COVER_MAX_BYTES = 8 * 1024 * 1024; // 8 MB (antes do re-encode)
/** Materiais IMAGE — limite do original (thumb é gerado à parte). */
export const MATERIAL_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
/** Materiais PDF. */
export const MATERIAL_PDF_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
