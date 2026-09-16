/**
 * Driver fake do Pagar.me — mesmo contrato do real, em memória.
 * Usado em testes, e2e e `PAGARME_DRIVER=fake`. O painel `/dev/pagarme`
 * força paid/failed/refunded sem chamar a API.
 */
import { randomBytes } from "node:crypto";

import {
  PagarmeError,
  type CreateCardOrderInput,
  type CreatePixOrderInput,
  type PagarmeCharge,
  type PagarmeGateway,
  type PagarmeOrder,
} from "@/server/pagarme/types";

type FakeStore = {
  orders: Map<string, PagarmeOrder>;
  /** Tokens de cartão especiais para e2e: `tok_decline_*` → failed. */
};

const globalStore = globalThis as typeof globalThis & {
  __pagarmeFakeStore?: FakeStore;
};

function store(): FakeStore {
  globalStore.__pagarmeFakeStore ??= { orders: new Map() };
  return globalStore.__pagarmeFakeStore;
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function buildCharge(
  status: string,
  paymentMethod: "pix" | "credit_card",
  extras?: {
    qr?: { code: string; url: string; expiresAt: string };
    card?: { brand: string; last4: string };
    declineCode?: string;
  },
): PagarmeCharge {
  const id = newId("ch");
  return {
    id,
    status,
    payment_method: paymentMethod,
    last_transaction: {
      status,
      success: status === "paid",
      acquirer_return_code: extras?.declineCode ?? null,
      acquirer_message: extras?.declineCode ? "Not authorized" : null,
      qr_code: extras?.qr?.code ?? null,
      qr_code_url: extras?.qr?.url ?? null,
      expires_at: extras?.qr?.expiresAt ?? null,
      card: extras?.card
        ? { brand: extras.card.brand, last_four_digits: extras.card.last4 }
        : null,
    },
  };
}

function buildOrder(
  input: { publicCode: string; orderId: string; amountCents: number; affiliateId?: string | null },
  status: string,
  charge: PagarmeCharge,
): PagarmeOrder {
  const id = newId("or");
  const order: PagarmeOrder = {
    id,
    code: input.publicCode,
    status,
    amount: input.amountCents,
    currency: "BRL",
    charges: [charge],
    metadata: {
      orderId: input.orderId,
      publicCode: input.publicCode,
      ...(input.affiliateId ? { affiliateId: input.affiliateId } : {}),
    },
  };
  store().orders.set(id, order);
  return order;
}

/** Cartões de teste do fake: token contendo `decline` → recusa. */
function shouldDeclineCard(cardToken: string): boolean {
  return /decline|fail|recus/i.test(cardToken);
}

export function createFakePagarmeGateway(): PagarmeGateway {
  return {
    createPixOrder(input: CreatePixOrderInput): Promise<PagarmeOrder> {
      const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
      const qrCode = `00020126580014br.gov.bcb.pix0136${input.publicCode}520400005303986540${(input.amountCents / 100).toFixed(2)}5802BR5911AFFILIATE6009SAO PAULO62070503***6304ABCD`;
      const charge = buildCharge("pending", "pix", {
        qr: {
          code: qrCode,
          url: `https://api.pagar.me/fake/qr/${input.publicCode}.png`,
          expiresAt,
        },
      });
      return Promise.resolve(buildOrder(input, "pending", charge));
    },

    createCardOrder(input: CreateCardOrderInput): Promise<PagarmeOrder> {
      if (shouldDeclineCard(input.cardToken)) {
        const charge = buildCharge("failed", "credit_card", {
          card: { brand: "Visa", last4: "0002" },
          declineCode: "51",
        });
        return Promise.resolve(buildOrder(input, "failed", charge));
      }

      if (/pending|analis|process/i.test(input.cardToken)) {
        const charge = buildCharge("processing", "credit_card", {
          card: { brand: "Mastercard", last4: "4444" },
        });
        return Promise.resolve(buildOrder(input, "pending", charge));
      }

      const charge = buildCharge("paid", "credit_card", {
        card: { brand: "Visa", last4: "1111" },
      });
      return Promise.resolve(buildOrder(input, "paid", charge));
    },

    getOrder(gatewayOrderId: string): Promise<PagarmeOrder> {
      const order = store().orders.get(gatewayOrderId);
      if (!order) {
        return Promise.reject(new PagarmeError("404", `Pedido fake ${gatewayOrderId} não encontrado.`));
      }
      return Promise.resolve(structuredClone(order));
    },

    cancelCharge(gatewayChargeId: string): Promise<PagarmeCharge> {
      for (const order of store().orders.values()) {
        const charge = order.charges?.find((c) => c.id === gatewayChargeId);
        if (!charge) continue;

        charge.status = "refunded";
        if (charge.last_transaction) {
          charge.last_transaction.status = "refunded";
          charge.last_transaction.success = true;
        }
        order.status = "canceled";
        return Promise.resolve(structuredClone(charge));
      }
      return Promise.reject(new PagarmeError("404", `Cobrança fake ${gatewayChargeId} não encontrada.`));
    },
  };
}

/** Força status de um pedido fake (painel `/dev/pagarme` e testes). */
export function forceFakeOrderStatus(
  gatewayOrderId: string,
  status: "paid" | "failed" | "refunded" | "chargedback",
): PagarmeOrder {
  const order = store().orders.get(gatewayOrderId);
  if (!order) {
    throw new PagarmeError("404", `Pedido fake ${gatewayOrderId} não encontrado.`);
  }

  const charge = order.charges?.[0];
  if (!charge) {
    throw new PagarmeError("INVALID", "Pedido fake sem charge.");
  }

  if (status === "paid") {
    order.status = "paid";
    charge.status = "paid";
    charge.paid_at = new Date().toISOString();
    if (charge.last_transaction) {
      charge.last_transaction.status = "paid";
      charge.last_transaction.success = true;
    }
  } else if (status === "failed") {
    order.status = "failed";
    charge.status = "failed";
    if (charge.last_transaction) {
      charge.last_transaction.status = "failed";
      charge.last_transaction.success = false;
      charge.last_transaction.acquirer_return_code = "05";
    }
  } else if (status === "refunded") {
    order.status = "canceled";
    charge.status = "refunded";
    if (charge.last_transaction) {
      charge.last_transaction.status = "refunded";
      charge.last_transaction.success = true;
    }
  } else {
    order.status = "canceled";
    charge.status = "chargedback";
    if (charge.last_transaction) {
      charge.last_transaction.status = "chargedback";
    }
  }

  return structuredClone(order);
}

/** Lista pedidos fake (painel de desenvolvimento). */
export function listFakeOrders(): PagarmeOrder[] {
  return [...store().orders.values()].map((o) => structuredClone(o));
}

/** Limpa o store — só para testes. */
export function resetFakePagarmeStore(): void {
  store().orders.clear();
}
