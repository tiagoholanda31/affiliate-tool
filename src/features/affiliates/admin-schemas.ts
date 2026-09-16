import { z } from "zod";

import { reasonSchema } from "@/features/affiliates/schemas";
import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";

export const affiliateIdSchema = z.string().min(1, "Afiliado não informado.");

export const approveAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
});

export const rejectAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
  reason: reasonSchema,
});

export const suspendAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
  reason: reasonSchema,
});

export const reactivateAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
});

export const removeAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
  reason: reasonSchema,
});

export const bulkApproveAffiliatesSchema = z.object({
  ids: z.array(affiliateIdSchema).max(50, "Selecione no máximo 50 afiliados."),
});

export const updateAffiliateCodeSchema = z.object({
  affiliateId: affiliateIdSchema,
  code: z
    .string()
    .trim()
    .min(4, FIELD_ERRORS.minLength(4))
    .max(20, FIELD_ERRORS.maxLength(20))
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen."),
});

export const revealPixKeySchema = z.object({
  affiliateId: affiliateIdSchema,
});

export const anonymizeAffiliateSchema = z.object({
  affiliateId: affiliateIdSchema,
});
