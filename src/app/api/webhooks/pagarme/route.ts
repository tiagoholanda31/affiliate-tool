import { NextResponse } from "next/server";

import {
  processPagarmeWebhook,
  verifyWebhookBasicAuth,
  webhookEnvelopeSchema,
} from "@/features/orders/webhook";
import { consume } from "@/lib/rate-limit";
import { getClientIp, readJson } from "@/lib/http";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<NextResponse> {
  if (!verifyWebhookBasicAuth(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const ip = getClientIp(request.headers);
  const rl = consume("webhook", ip);
  if (!rl.ok) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = webhookEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Envelope inválido" }, { status: 400 });
  }

  const result = await processPagarmeWebhook(parsed.data);

  if (result.ok && result.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (!result.ok) {
    logger.warn({ error: result.error }, "Webhook Pagar.me retornou falha");
    return NextResponse.json({ ok: false }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
