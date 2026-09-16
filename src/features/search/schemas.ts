import { z } from "zod";

import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";

/** Entrada da busca global ⌘K (admin). */
export const globalSearchSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, FIELD_ERRORS.minLength(1))
    .max(80, FIELD_ERRORS.maxLength(80)),
});

export type GlobalSearchInput = z.infer<typeof globalSearchSchema>;
