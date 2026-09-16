/**
 * Emissor opcional para o n8n (Google Sheets / WhatsApp da equipe).
 * Fire-and-forget: falha só loga; nunca bloqueia o fluxo de negócio.
 */
import { createHmac } from "node:crypto";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type N8nEvent =
  | "affiliate.approved"
  | "order.paid"
  | "order.refunded"
  | "order.manual_created"
  | "commission.available"
  | "payout.paid";

const TIMEOUT_MS = 5_000;

export async function emit(event: N8nEvent, payload: Record<string, unknown>): Promise<void> {
  const url = env.N8N_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const body = JSON.stringify({ event, payload, at: new Date().toISOString() });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Event": event,
  };

  if (env.N8N_WEBHOOK_SECRET) {
    const signature = createHmac("sha256", env.N8N_WEBHOOK_SECRET).update(body).digest("hex");
    headers["X-Signature"] = signature;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn({ event, status: res.status }, "n8n emit respondeu com erro");
    }
  } catch (error) {
    logger.warn({ event, err: error }, "n8n emit falhou");
  } finally {
    clearTimeout(timer);
  }
}
