import { NextResponse } from "next/server";

import { getOrderStatus } from "@/features/orders/queries";
import { consume } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ code: string }> };

/** Polling do status do pedido (Pix / antifraude). Rate-limited. */
export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  const { code } = await context.params;
  const url = new URL(request.url);
  const token = url.searchParams.get("t");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Token ausente." }, { status: 400 });
  }

  const ip = getClientIp(request.headers);
  const rl = consume("checkout", `status:${ip}`);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "Muitas tentativas." },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  const status = await getOrderStatus(code, token);
  if (!status) {
    return NextResponse.json({ ok: false, error: "Não encontrado." }, { status: 404 });
  }

  return NextResponse.json(status);
}
