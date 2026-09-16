/**
 * Seleciona o driver Pagar.me (`fake` | `real`) via `PAGARME_DRIVER`.
 */
import { env } from "@/lib/env";
import { createFakePagarmeGateway } from "@/server/pagarme/fake";
import { createRealPagarmeGateway } from "@/server/pagarme/orders";
import type { PagarmeGateway } from "@/server/pagarme/types";

let cached: PagarmeGateway | null = null;

export function getPagarme(): PagarmeGateway {
  if (cached) return cached;
  cached = env.PAGARME_DRIVER === "real" ? createRealPagarmeGateway() : createFakePagarmeGateway();
  return cached;
}

/** Só para testes — troca o driver em memória. */
export function resetPagarmeCache(): void {
  cached = null;
}

export type { PagarmeGateway } from "@/server/pagarme/types";
export { PagarmeError } from "@/server/pagarme/types";
export { mapGatewayStatus, mapCardDecline, gatewayStatusToOrderStatus } from "@/server/pagarme/map";
export {
  forceFakeOrderStatus,
  listFakeOrders,
  resetFakePagarmeStore,
} from "@/server/pagarme/fake";
