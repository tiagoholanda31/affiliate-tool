import { NextResponse } from "next/server";

import { REF_COOKIE_NAME, refCookieOptions, signRef } from "@/lib/attribution";
import { getClientIp } from "@/lib/http";
import { getSettings } from "@/lib/settings";
import {
  prepareClick,
  resolveRedirectTarget,
  shouldTrackAffiliate,
} from "@/features/tracking/service";
import { APP_URL } from "@/lib/env";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ code: string; slug?: string[] }>;
};

async function handle(request: Request, context: RouteContext): Promise<NextResponse> {
  const { code: rawCode, slug: slugParts } = await context.params;
  const code = decodeURIComponent(rawCode).trim().toLowerCase();
  const slug = slugParts?.[0] ? decodeURIComponent(slugParts[0]).trim() : undefined;

  const resolved = await resolveRedirectTarget(code, slug);
  const destination = new URL(resolved.destination, APP_URL);

  const track =
    resolved.affiliate !== null && shouldTrackAffiliate(resolved.affiliate.status);

  if (!track || !resolved.affiliate) {
    return NextResponse.redirect(destination, 302);
  }

  const settings = await getSettings();
  const ip = getClientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  const referer = request.headers.get("referer");

  const { clickId } = await prepareClick({
    affiliateId: resolved.affiliate.id,
    productId: resolved.productId,
    ip,
    userAgent,
    referer,
  });

  const token = await signRef(
    { a: resolved.affiliate.id, c: clickId },
    settings.attributionDays,
  );

  const response = NextResponse.redirect(destination, 302);
  const maxAge = settings.attributionDays * 24 * 60 * 60;
  response.cookies.set(REF_COOKIE_NAME, token, refCookieOptions(maxAge));
  return response;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  return handle(request, context);
}
