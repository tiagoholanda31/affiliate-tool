/**
 * Tipos e schemas Zod das respostas Pagar.me Core API v5 usadas no checkout.
 * Nomes de campos seguem a doc atual (orders, charges, last_transaction).
 */
import { z } from "zod";

export const pagarmeCustomerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  document: z.string().min(11).max(14),
  type: z.enum(["individual", "company"]),
  phones: z
    .object({
      mobile_phone: z
        .object({
          country_code: z.string().default("55"),
          area_code: z.string().min(2).max(2),
          number: z.string().min(8).max(9),
        })
        .optional(),
    })
    .optional(),
});

export type PagarmeCustomer = z.infer<typeof pagarmeCustomerSchema>;

export const pagarmeBillingAddressSchema = z.object({
  line_1: z.string().min(1),
  line_2: z.string().optional(),
  zip_code: z.string().min(8).max(8),
  city: z.string().min(1),
  state: z.string().length(2),
  country: z.string().length(2).default("BR"),
});

export type PagarmeBillingAddress = z.infer<typeof pagarmeBillingAddressSchema>;

const lastTransactionSchema = z
  .object({
    status: z.string().optional(),
    success: z.boolean().optional(),
    acquirer_return_code: z.string().nullable().optional(),
    acquirer_message: z.string().nullable().optional(),
    qr_code: z.string().nullable().optional(),
    qr_code_url: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    card: z
      .object({
        brand: z.string().nullable().optional(),
        last_four_digits: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .loose();

const chargeSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    payment_method: z.string().optional(),
    amount: z.number().int().optional(),
    paid_at: z.string().nullable().optional(),
    canceled_at: z.string().nullable().optional(),
    last_transaction: lastTransactionSchema.nullable().optional(),
  })
  .loose();

export const pagarmeOrderSchema = z
  .object({
    id: z.string(),
    code: z.string().optional(),
    status: z.string(),
    amount: z.number().int().optional(),
    currency: z.string().optional(),
    closed: z.boolean().optional(),
    charges: z.array(chargeSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .loose();

export type PagarmeOrder = z.infer<typeof pagarmeOrderSchema>;
export type PagarmeCharge = z.infer<typeof chargeSchema>;
export type PagarmeLastTransaction = z.infer<typeof lastTransactionSchema>;

export type CreatePixOrderInput = {
  amountCents: number;
  description: string;
  productId: string;
  publicCode: string;
  orderId: string;
  affiliateId?: string | null;
  customer: PagarmeCustomer;
  expiresInSeconds: number;
};

export type CreateCardOrderInput = {
  amountCents: number;
  description: string;
  productId: string;
  publicCode: string;
  orderId: string;
  affiliateId?: string | null;
  customer: PagarmeCustomer;
  cardToken: string;
  installments: number;
  billingAddress: PagarmeBillingAddress;
};

export type PagarmeGateway = {
  createPixOrder: (input: CreatePixOrderInput) => Promise<PagarmeOrder>;
  createCardOrder: (input: CreateCardOrderInput) => Promise<PagarmeOrder>;
  getOrder: (gatewayOrderId: string) => Promise<PagarmeOrder>;
  cancelCharge: (gatewayChargeId: string) => Promise<PagarmeCharge>;
};

export class PagarmeError extends Error {
  readonly code: string;
  readonly raw: unknown;

  constructor(code: string, message: string, raw?: unknown) {
    super(message);
    this.name = "PagarmeError";
    this.code = code;
    this.raw = raw;
  }
}
