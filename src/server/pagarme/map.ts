/**
 * Mapeia status e códigos de recusa do Pagar.me para o domínio interno.
 */
import type { OrderStatus } from "@/generated/prisma/client";
import type { PagarmeOrder } from "@/server/pagarme/types";

/** Status normalizado a partir do pedido (e da charge, se houver). */
export type GatewayStatus =
  | "paid"
  | "failed"
  | "canceled"
  | "pending"
  | "processing"
  | "refunded"
  | "chargedback";

function normalize(raw: string | undefined | null): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * Deriva o status interno a partir do pedido retornado pela API.
 * Prefere o status da charge (refunded/chargedback) quando existir.
 */
export function mapGatewayStatus(order: PagarmeOrder): GatewayStatus {
  const charge = order.charges?.[0];
  const chargeStatus = normalize(charge?.status);
  const orderStatus = normalize(order.status);
  const txStatus = normalize(charge?.last_transaction?.status);

  if (chargeStatus === "chargedback" || orderStatus === "chargedback") {
    return "chargedback";
  }
  if (
    chargeStatus === "refunded" ||
    orderStatus === "refunded" ||
    chargeStatus === "partial_canceled"
  ) {
    return "refunded";
  }
  if (
    chargeStatus === "paid" ||
    orderStatus === "paid" ||
    txStatus === "paid" ||
    txStatus === "captured"
  ) {
    return "paid";
  }
  if (
    chargeStatus === "failed" ||
    orderStatus === "failed" ||
    orderStatus === "payment_failed" ||
    txStatus === "failed" ||
    txStatus === "not_authorized"
  ) {
    return "failed";
  }
  if (
    chargeStatus === "canceled" ||
    orderStatus === "canceled" ||
    orderStatus === "cancelled"
  ) {
    return "canceled";
  }
  if (
    chargeStatus === "processing" ||
    orderStatus === "processing" ||
    txStatus === "processing" ||
    txStatus === "waiting_capture"
  ) {
    return "processing";
  }

  return "pending";
}

/** GatewayStatus → OrderStatus interno (sem efeitos colaterais). */
export function gatewayStatusToOrderStatus(status: GatewayStatus): OrderStatus {
  switch (status) {
    case "paid":
      return "PAID";
    case "failed":
      return "FAILED";
    case "canceled":
      return "CANCELED";
    case "refunded":
      return "REFUNDED";
    case "chargedback":
      return "CHARGEDBACK";
    case "pending":
    case "processing":
      return "PENDING";
  }
}

const DECLINE_MESSAGES = {
  generic: "Cartão recusado pelo banco. Tente outro cartão ou Pix.",
  insufficient_funds: "Saldo ou limite insuficiente. Tente outro cartão ou Pix.",
  expired_card: "Cartão expirado. Confira a validade ou use outro cartão.",
  invalid_cvv: "Código de segurança (CVV) inválido. Confira e tente de novo.",
  blocked: "Cartão bloqueado. Contate o banco ou use outro cartão / Pix.",
  antifraud: "Pagamento não autorizado pelo antifraude. Tente Pix ou outro cartão.",
} as const;

/**
 * Traduz código/mensagem do adquirente para frase curta pt-BR.
 * O código original deve ir para `metadata.gatewayDeclineCode` (não exibir).
 */
export function mapCardDecline(
  code: string | null | undefined,
  message?: string | null,
): string {
  const raw = `${code ?? ""} ${message ?? ""}`.toLowerCase();

  if (/insufficient|saldo|limit|51\b|61\b/.test(raw)) {
    return DECLINE_MESSAGES.insufficient_funds;
  }
  if (/expir|54\b/.test(raw)) {
    return DECLINE_MESSAGES.expired_card;
  }
  if (/cvv|cvc|security|codigo de seg|n7\b|82\b/.test(raw)) {
    return DECLINE_MESSAGES.invalid_cvv;
  }
  if (/block|bloque|stolen|lost|43\b|41\b|04\b|07\b/.test(raw)) {
    return DECLINE_MESSAGES.blocked;
  }
  if (/antifraud|fraud|risco|suspect/.test(raw)) {
    return DECLINE_MESSAGES.antifraud;
  }

  return DECLINE_MESSAGES.generic;
}

export { DECLINE_MESSAGES };
