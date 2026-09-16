/**
 * Schemas do checkout (comprador anônimo).
 */
import { z } from "zod";

import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/masks";

export const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, FIELD_ERRORS.minLength(3))
    .max(120, FIELD_ERRORS.maxLength(120)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email(FIELD_ERRORS.email)),
  phone: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine(isValidPhone, FIELD_ERRORS.phone),
  document: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((d) => (d.length === 11 ? isValidCpf(d) : isValidCnpj(d)), {
      message: "CPF ou CNPJ inválido.",
    }),
});

export const billingAddressSchema = z.object({
  line1: z.string().trim().min(3, FIELD_ERRORS.minLength(3)).max(200),
  line2: z.string().trim().max(100).optional(),
  zipCode: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((d) => d.length === 8, { message: "CEP inválido." }),
  city: z.string().trim().min(2).max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .refine((s) => /^[A-Z]{2}$/.test(s), { message: "UF inválida." }),
});

const honeypotAndTiming = {
  /** Honeypot: bots preenchem; humanos deixam vazio. */
  website: z.string().max(0).optional().default(""),
  /** Timestamp do carregamento do form (ms). Mínimo 3 s. */
  formStartedAt: z.number().int().positive(),
};

export const createCheckoutOrderSchema = z.discriminatedUnion("method", [
  z.object({
    productId: z.string().min(1),
    method: z.literal("pix"),
    customer: customerSchema,
    /** Ignorado — preço vem do servidor. */
    amountCents: z.number().int().positive().optional(),
    ...honeypotAndTiming,
  }),
  z.object({
    productId: z.string().min(1),
    method: z.literal("card"),
    customer: customerSchema,
    cardToken: z.string().min(8).max(120),
    installments: z.number().int().min(1).max(12),
    billingAddress: billingAddressSchema,
    amountCents: z.number().int().positive().optional(),
    ...honeypotAndTiming,
  }),
]);

export type CreateCheckoutOrderInput = z.infer<typeof createCheckoutOrderSchema>;
