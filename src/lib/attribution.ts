/**
 * Cookie de atribuição `if_ref` (JWT HS256).
 *
 * Usado pelo redirect `/r/...` (fatia 04) e pelo checkout (fatia 05). Não é
 * prova de dinheiro — só aponta o afiliado e o clique de origem. Cookie
 * adulterado ou expirado → `null`, sem erro na UI.
 */
import { SignJWT, jwtVerify } from "jose";

import { env, isProduction } from "@/lib/env";

export const REF_COOKIE_NAME = "if_ref";

export type RefPayload = {
  /** affiliateId */
  a: string;
  /** clickId */
  c: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.REF_COOKIE_SECRET);
}

/** Assina o JWT `{ a, c }` com expiração em `attributionDays` dias. */
export async function signRef(
  payload: RefPayload,
  attributionDays: number,
): Promise<string> {
  const days = Math.min(90, Math.max(1, attributionDays));
  return new SignJWT({ a: payload.a, c: payload.c })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${String(days)}d`)
    .sign(secretKey());
}

/**
 * Verifica assinatura e expiração. Qualquer falha → `null` (sem throw).
 * Aceita o valor cru do cookie ou um store com `.get(name)`.
 */
export async function readRef(
  cookies: { get: (name: string) => { value: string } | undefined } | string | null | undefined,
): Promise<RefPayload | null> {
  const token =
    typeof cookies === "string" || cookies == null
      ? cookies
      : cookies.get(REF_COOKIE_NAME)?.value;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    const a = payload.a;
    const c = payload.c;
    if (typeof a !== "string" || typeof c !== "string" || !a || !c) {
      return null;
    }
    return { a, c };
  } catch {
    return null;
  }
}

/** Opções do `Set-Cookie` para `if_ref`. */
export function refCookieOptions(maxAgeSeconds: number): {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
