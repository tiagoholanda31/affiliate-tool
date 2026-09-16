/**
 * Operações de pedido/cobrança no Pagar.me (driver real).
 */
import { pagarmeFetch } from "@/server/pagarme/client";
import {
  pagarmeOrderSchema,
  type CreateCardOrderInput,
  type CreatePixOrderInput,
  type PagarmeCharge,
  type PagarmeGateway,
  type PagarmeOrder,
} from "@/server/pagarme/types";

function metadataOf(input: {
  orderId: string;
  publicCode: string;
  affiliateId?: string | null;
}): Record<string, string> {
  const meta: Record<string, string> = {
    orderId: input.orderId,
    publicCode: input.publicCode,
  };
  if (input.affiliateId) meta.affiliateId = input.affiliateId;
  return meta;
}

function parseOrder(raw: unknown): PagarmeOrder {
  return pagarmeOrderSchema.parse(raw);
}

export function createRealPagarmeGateway(): PagarmeGateway {
  return {
    async createPixOrder(input: CreatePixOrderInput): Promise<PagarmeOrder> {
      const raw = await pagarmeFetch<unknown>({
        method: "POST",
        path: "/orders",
        body: {
          code: input.publicCode,
          customer: input.customer,
          items: [
            {
              amount: input.amountCents,
              description: input.description.slice(0, 256),
              quantity: 1,
              code: input.productId,
            },
          ],
          payments: [
            {
              payment_method: "pix",
              pix: { expires_in: input.expiresInSeconds },
            },
          ],
          metadata: metadataOf(input),
        },
      });
      return parseOrder(raw);
    },

    async createCardOrder(input: CreateCardOrderInput): Promise<PagarmeOrder> {
      const raw = await pagarmeFetch<unknown>({
        method: "POST",
        path: "/orders",
        body: {
          code: input.publicCode,
          customer: input.customer,
          items: [
            {
              amount: input.amountCents,
              description: input.description.slice(0, 256),
              quantity: 1,
              code: input.productId,
            },
          ],
          payments: [
            {
              payment_method: "credit_card",
              credit_card: {
                installments: input.installments,
                statement_descriptor: "AFFILIATE",
                card_token: input.cardToken,
                card: { billing_address: input.billingAddress },
              },
            },
          ],
          metadata: metadataOf(input),
        },
      });
      return parseOrder(raw);
    },

    async getOrder(gatewayOrderId: string): Promise<PagarmeOrder> {
      const raw = await pagarmeFetch<unknown>({
        method: "GET",
        path: `/orders/${encodeURIComponent(gatewayOrderId)}`,
      });
      return parseOrder(raw);
    },

    async cancelCharge(gatewayChargeId: string): Promise<PagarmeCharge> {
      return pagarmeFetch<PagarmeCharge>({
        method: "DELETE",
        path: `/charges/${encodeURIComponent(gatewayChargeId)}`,
      });
    },
  };
}
