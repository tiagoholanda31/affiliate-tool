import { z } from "zod";

import { emailSchema, phoneSchema } from "@/features/affiliates/schemas";
import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";

/** Limites de Setting (docs/spec/01 §9). */
export const SETTINGS_LIMITS = {
  holdDays: { min: 0, max: 90 },
  payoutDay: { min: 1, max: 28 },
  attributionDays: { min: 1, max: 90 },
  pixExpirationMinutes: { min: 10, max: 120 },
  downloadGrantDays: { min: 1, max: 30 },
  downloadMaxCount: { min: 1, max: 20 },
} as const;

const intInRange = (min: number, max: number, label: string) =>
  z
    .number()
    .int(`${label} deve ser um número inteiro.`)
    .min(min, `${label} deve ser no mínimo ${String(min)}.`)
    .max(max, `${label} deve ser no máximo ${String(max)}.`);

/**
 * Formulário de configurações.
 * Se `termsMarkdown` mudar em relação ao valor atual, `termsVersion` é obrigatório
 * e deve ser diferente da versão vigente (validado no service).
 */
export const updateSettingsSchema = z.object({
  holdDays: intInRange(SETTINGS_LIMITS.holdDays.min, SETTINGS_LIMITS.holdDays.max, "Carência"),
  payoutDay: intInRange(SETTINGS_LIMITS.payoutDay.min, SETTINGS_LIMITS.payoutDay.max, "Dia de pagamento"),
  attributionDays: intInRange(
    SETTINGS_LIMITS.attributionDays.min,
    SETTINGS_LIMITS.attributionDays.max,
    "Atribuição",
  ),
  pixExpirationMinutes: intInRange(
    SETTINGS_LIMITS.pixExpirationMinutes.min,
    SETTINGS_LIMITS.pixExpirationMinutes.max,
    "Expiração do Pix",
  ),
  downloadGrantDays: intInRange(
    SETTINGS_LIMITS.downloadGrantDays.min,
    SETTINGS_LIMITS.downloadGrantDays.max,
    "Validade do download",
  ),
  downloadMaxCount: intInRange(
    SETTINGS_LIMITS.downloadMaxCount.min,
    SETTINGS_LIMITS.downloadMaxCount.max,
    "Máximo de downloads",
  ),
  termsVersion: z
    .string()
    .trim()
    .min(1, FIELD_ERRORS.required)
    .max(32, FIELD_ERRORS.maxLength(32))
    .regex(/^v\d+$/i, "Use o formato v1, v2, v3…"),
  termsMarkdown: z
    .string()
    .trim()
    .min(20, FIELD_ERRORS.minLength(20))
    .max(50_000, FIELD_ERRORS.maxLength(50_000)),
  adminNotifyEmail: emailSchema,
  supportWhatsapp: phoneSchema,
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export const acceptTermsSchema = z.object({
  termsVersion: z.string().trim().min(1).max(32),
});

export type AcceptTermsInput = z.infer<typeof acceptTermsSchema>;
