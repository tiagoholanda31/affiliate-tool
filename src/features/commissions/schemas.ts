/**
 * Schemas de venda manual e filtros de comissão.
 */
import { z } from "zod";

import { emailSchema, nameSchema, phoneSchema } from "@/features/affiliates/schemas";
import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { partsInSaoPaulo, startOfDayInSaoPaulo } from "@/lib/dates";

const MIN_AMOUNT_CENTS = 100; // R$ 1,00

/** Data de pagamento ≤ hoje (fuso SP), parseada de `YYYY-MM-DD`. */
export const paidAtDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data no formato AAAA-MM-DD.")
  .transform((value, ctx) => {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    if (!y || !m || !d) {
      ctx.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    const paidAt = startOfDayInSaoPaulo(y, m, d);
    const today = partsInSaoPaulo(new Date());
    const endOfToday = startOfDayInSaoPaulo(today.year, today.month, today.day);
    // Compara só o dia civil: paidAt > hoje SP é rejeitado.
    if (paidAt.getTime() > endOfToday.getTime()) {
      ctx.addIssue({ code: "custom", message: "A data do pagamento não pode ser futura." });
      return z.NEVER;
    }
    return paidAt;
  });

export const createManualOrderSchema = z.object({
  productId: z.string().min(1, "Selecione um produto."),
  amountCents: z
    .number()
    .int()
    .min(MIN_AMOUNT_CENTS, "Valor mínimo é R$ 1,00."),
  paidAt: paidAtDateSchema,
  customerName: nameSchema,
  customerEmail: emailSchema,
  customerPhone: z
    .union([phoneSchema, z.literal(""), z.undefined()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value)),
  affiliateId: z.string().min(1).optional().nullable(),
  notes: z
    .string()
    .trim()
    .max(2000, FIELD_ERRORS.maxLength(2000))
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : value)),
  /** Só faz sentido para produto DIGITAL — envia e-mail com link de download. */
  sendDownloadLink: z.boolean().optional().default(false),
});

export type CreateManualOrderInput = {
  productId: string;
  amountCents: number;
  paidAt: Date;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  affiliateId?: string | null;
  notes?: string;
  sendDownloadLink?: boolean;
};

/** Preview sem persistir — mesmos campos do form, paidAt já como Date no client via string. */
export const previewManualCommissionSchema = z.object({
  productId: z.string().min(1),
  amountCents: z.number().int().min(MIN_AMOUNT_CENTS),
  paidAt: paidAtDateSchema,
  affiliateId: z.string().min(1).optional().nullable(),
});

export const commissionStatusSchema = z.enum([
  "PENDING",
  "AVAILABLE",
  "PAID",
  "REVERSED",
]);

export const listCommissionsSchema = z.object({
  status: commissionStatusSchema.optional(),
  affiliateId: z.string().min(1).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListCommissionsInput = z.infer<typeof listCommissionsSchema>;
