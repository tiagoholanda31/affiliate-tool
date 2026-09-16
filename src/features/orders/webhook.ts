/**
 * Processamento do webhook Pagar.me (auth, idempotência, re-consulta, transição).
 */
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { applyGatewayStatus } from "@/features/orders/service";
import { APP_URL, env } from "@/lib/env";
import { safeCompare } from "@/lib/crypto";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { logger } from "@/lib/logger";
import { notFound } from "@/lib/errors";
import { getPagarme } from "@/server/pagarme";

const HANDLED_TYPES = new Set([
  "order.paid",
  "order.payment_failed",
  "order.canceled",
  "charge.paid",
  "charge.payment_failed",
  "charge.refunded",
  "charge.chargedback",
  "charge.pending",
]);

export const webhookEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  account: z.unknown().optional(),
  created_at: z.string().optional(),
});

export type WebhookEnvelope = z.infer<typeof webhookEnvelopeSchema>;

export function verifyWebhookBasicAuth(authorizationHeader: string | null): boolean {
  const user = env.PAGARME_WEBHOOK_USER;
  const password = env.PAGARME_WEBHOOK_PASSWORD;
  if (!user || !password) {
    // Em fake/dev sem credenciais: aceita só se driver fake e header ausente? Spec: 401 se inválido.
    // Sem user/password configurados, rejeita tudo (exceto testes que setam env).
    return false;
  }
  if (!authorizationHeader?.toLowerCase().startsWith("basic ")) return false;
  const decoded = Buffer.from(authorizationHeader.slice(6).trim(), "base64").toString("utf8");
  const expected = `${user}:${password}`;
  return safeCompare(decoded, expected);
}

function extractGatewayOrderId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  if (typeof data.id === "string" && (data.charges || data.code || data.status)) {
    // Pode ser order ou charge. Se tem `order` aninhado, preferir.
    const nested = data.order;
    if (nested && typeof nested === "object" && "id" in nested) {
      const id = (nested as { id?: unknown }).id;
      if (typeof id === "string") return id;
    }
    // charge.* events: data.id é charge; order_id ou order.id
    if (typeof data.order_id === "string") return data.order_id;
    // order.* events: data.id é o order
    if (Array.isArray(data.charges) || typeof data.code === "string") {
      return data.id;
    }
  }
  if (typeof data.order_id === "string") return data.order_id;
  return typeof data.id === "string" ? data.id : null;
}

function extractMetadataOrderId(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const meta = data.metadata;
  if (meta && typeof meta === "object" && "orderId" in meta) {
    const id = (meta as { orderId?: unknown }).orderId;
    if (typeof id === "string") return id;
  }
  return null;
}

export type ProcessWebhookResult =
  | { ok: true; duplicate?: boolean; ignored?: boolean; duplicateProcessed?: boolean }
  | { ok: false; status: number; error: string };

/**
 * Corpo compartilhado: resolve pedido, reconsulta gateway, aplica status.
 * Não cria WebhookEvent — usado por process e reprocess.
 */
export async function handleWebhookPayload(
  eventRowId: string,
  envelope: WebhookEnvelope,
): Promise<ProcessWebhookResult> {
  if (!HANDLED_TYPES.has(envelope.type)) {
    await db.webhookEvent.update({
      where: { id: eventRowId },
      data: { status: "IGNORED", processedAt: new Date(), error: null },
    });
    return { ok: true, ignored: true };
  }

  try {
    const data = envelope.data;
    const gatewayOrderId = extractGatewayOrderId(data);
    const metadataOrderId = extractMetadataOrderId(data);

    let order = gatewayOrderId
      ? await db.order.findUnique({ where: { gatewayOrderId } })
      : null;

    if (!order && metadataOrderId) {
      order = await db.order.findUnique({ where: { id: metadataOrderId } });
    }

    if (!order) {
      await db.webhookEvent.update({
        where: { id: eventRowId },
        data: {
          status: "FAILED",
          error: "Pedido desconhecido",
          processedAt: new Date(),
        },
      });
      await alertUnknownOrder(envelope.type, gatewayOrderId);
      return { ok: true };
    }

    if (!order.gatewayOrderId) {
      await db.webhookEvent.update({
        where: { id: eventRowId },
        data: {
          status: "FAILED",
          error: "Pedido sem gatewayOrderId",
          processedAt: new Date(),
        },
      });
      return { ok: false, status: 500, error: "Pedido sem gatewayOrderId" };
    }

    const wasPaid = order.status === "PAID";
    const remote = await getPagarme().getOrder(order.gatewayOrderId);

    try {
      await applyGatewayStatus(order, remote);
    } catch (error) {
      // Transição inválida: idempotente, marca PROCESSED
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Não é possível mudar")) {
        logger.warn({ orderId: order.id, err: error }, "Webhook: transição inválida ignorada");
      } else {
        throw error;
      }
    }

    await db.webhookEvent.update({
      where: { id: eventRowId },
      data: { status: "PROCESSED", processedAt: new Date(), error: null },
    });

    // applyGatewayStatus / transitionOrder só disparam hooks em mudança real —
    // reprocessar PAID→PAID é no-op (sem duplicar comissão/grant).
    return { ok: true, duplicateProcessed: wasPaid };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.webhookEvent.update({
      where: { id: eventRowId },
      data: { status: "FAILED", error: message.slice(0, 500), processedAt: new Date() },
    });
    logger.error({ eventId: envelope.id, err: error }, "Falha ao processar webhook Pagar.me");
    await alertWebhookFailed(envelope.type, message);
    return { ok: false, status: 500, error: "Falha ao processar webhook" };
  }
}

/**
 * Pipeline completo do webhook. Chamado pelo Route Handler.
 */
export async function processPagarmeWebhook(
  envelope: WebhookEnvelope,
): Promise<ProcessWebhookResult> {
  const existing = await db.webhookEvent.findUnique({ where: { eventId: envelope.id } });
  if (existing) {
    return { ok: true, duplicate: true };
  }

  const event = await db.webhookEvent.create({
    data: {
      provider: "pagarme",
      eventId: envelope.id,
      type: envelope.type,
      payload: envelope as Prisma.InputJsonValue,
      status: "RECEIVED",
    },
  });

  return handleWebhookPayload(event.id, envelope);
}

/**
 * Reprocessa um WebhookEvent existente (admin / sistema).
 * Reseta para RECEIVED e reexecuta o handler sem criar nova linha.
 */
export async function reprocessWebhookEvent(
  eventId: string,
): Promise<ProcessWebhookResult> {
  const row = await db.webhookEvent.findUnique({ where: { eventId } });
  if (!row) {
    throw notFound("Webhook não encontrado.");
  }

  const parsed = webhookEnvelopeSchema.safeParse(row.payload);
  if (!parsed.success) {
    await db.webhookEvent.update({
      where: { id: row.id },
      data: {
        status: "FAILED",
        error: "Payload inválido para reprocessamento",
        processedAt: new Date(),
      },
    });
    return { ok: false, status: 500, error: "Payload inválido" };
  }

  await db.webhookEvent.update({
    where: { id: row.id },
    data: { status: "RECEIVED", error: null, processedAt: null },
  });

  return handleWebhookPayload(row.id, parsed.data);
}

async function alertUnknownOrder(type: string, gatewayOrderId: string | null): Promise<void> {
  const settings = await getSettings();
  await sendMail({
    to: settings.adminNotifyEmail,
    template: "admin-alert",
    props: {
      title: "Webhook Pagar.me — pedido desconhecido",
      message: "Recebemos um evento sem pedido correspondente no sistema.",
      details: [
        { label: "Tipo", value: type },
        { label: "Gateway order", value: gatewayOrderId ?? "—" },
      ],
      actionUrl: `${APP_URL}/admin/sistema`,
      actionLabel: "Ver sistema",
    },
  });
}

async function alertWebhookFailed(type: string, error: string): Promise<void> {
  const settings = await getSettings();
  await sendMail({
    to: settings.adminNotifyEmail,
    template: "admin-alert",
    props: {
      title: "Webhook Pagar.me falhou",
      message: "O processamento de um webhook retornou erro; o Pagar.me pode reenviar.",
      details: [
        { label: "Tipo", value: type },
        { label: "Erro", value: error.slice(0, 200) },
      ],
      actionUrl: `${APP_URL}/admin/sistema`,
      actionLabel: "Ver sistema",
    },
  });
}
