/**
 * Schemas de lotes de pagamento e ajustes manuais.
 */
import { z } from "zod";

import { paidAtDateSchema } from "@/features/commissions/schemas";
import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";

const referenceMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês de referência inválido (YYYY-MM).");

export const buildPayoutDraftSchema = z.object({
  affiliateId: z.string().min(1, FIELD_ERRORS.required),
  commissionIds: z.array(z.string().min(1)).max(500).optional(),
  referenceMonth: referenceMonthSchema.optional(),
});

export type BuildPayoutDraftInput = z.infer<typeof buildPayoutDraftSchema>;

export const markPayoutPaidSchema = z
  .object({
    payoutId: z.string().min(1, FIELD_ERRORS.required),
    paidAt: paidAtDateSchema,
    proofReference: z
      .string()
      .trim()
      .max(120)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    proofPath: z
      .string()
      .trim()
      .max(500)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .nullable()
      .transform((v) => (v && v.length > 0 ? v : null)),
  })
  .superRefine((data, ctx) => {
    if (!data.proofReference && !data.proofPath) {
      ctx.addIssue({
        code: "custom",
        message: "Informe a referência Pix ou anexe o comprovante.",
        path: ["proofReference"],
      });
    }
  });

export type MarkPayoutPaidInput = z.infer<typeof markPayoutPaidSchema>;

export const discardDraftSchema = z.object({
  payoutId: z.string().min(1, FIELD_ERRORS.required),
});

export const removeCommissionFromDraftSchema = z.object({
  payoutId: z.string().min(1, FIELD_ERRORS.required),
  commissionId: z.string().min(1, FIELD_ERRORS.required),
});

export const createManualAdjustmentSchema = z.object({
  affiliateId: z.string().min(1, FIELD_ERRORS.required),
  amountCents: z
    .number({ message: FIELD_ERRORS.required })
    .int()
    .refine((n) => n !== 0, "O valor do ajuste não pode ser zero."),
  reason: z.string().trim().min(3, "Informe o motivo (mínimo 3 caracteres).").max(500),
});

export type CreateManualAdjustmentInput = z.infer<typeof createManualAdjustmentSchema>;

export const listPayoutsSchema = z.object({
  status: z.enum(["DRAFT", "PAID"]).optional(),
  affiliateId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListPayoutsInput = z.infer<typeof listPayoutsSchema>;
