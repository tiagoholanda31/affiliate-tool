import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/csp";

/**
 * Proxy (o antigo `middleware`, renomeado no Next 16).
 *
 * Roda antes de qualquer render. Aqui só entram decisões que precisam acontecer
 * **antes** da resposta começar a ser transmitida — depois que o streaming
 * começa, o status HTTP já não pode mudar.
 *
 * A única coisa que ele decide sobre autenticação é *presença de cookie de
 * sessão*: quem não tem cookie não chega a renderizar o painel. Papel e status
 * do afiliado ficam nos layouts, com `requireAdmin`/`requireAffiliate`, que
 * consultam o banco (docs/spec/02, Convenções; docs/spec/04, Autorização).
 *
 * A separação é deliberada: cookie presente não é prova de sessão válida — é só
 * um filtro barato para evitar render inútil. A prova acontece no servidor, a
 * cada render, com a sessão lida do banco.
 *
 * CSP: nonce por request (fatia 11). O Next lê o header da *request* e aplica o
 * nonce nos scripts que ele injeta. O mesmo valor vai no header da resposta.
 */
const PROTECTED_PREFIXES = ["/painel", "/admin"];

/**
 * Layouts não recebem o caminho como prop, e `requireAffiliate` precisa dele
 * para aplicar a matriz status → rota. O proxy carimba o caminho num header e o
 * layout o lê com `headers()`. É o único jeito de saber a rota dentro de um
 * layout sem transformar tudo em Client Component.
 */
export const PATHNAME_HEADER = "x-pathname";

function applyCsp(response: NextResponse, nonce: string): NextResponse {
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy(nonce, { isDev });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildContentSecurityPolicy(nonce, { isDev });

  // O catálogo de componentes e a pré-visualização de e-mails existem só em
  // desenvolvimento. Barrar aqui garante um 404 de verdade: dentro da página, o
  // `loading.tsx` já teria iniciado o streaming com status 200.
  if (process.env.NODE_ENV === "production" && pathname.startsWith("/dev")) {
    const blocked = new NextResponse(null, { status: 404 });
    return applyCsp(blocked, nonce);
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const requestHeaders = new Headers(request.headers);
  // Sobrescreve: o header pode vir de fora, e um valor forjado enganaria o
  // `requireAffiliate` sobre qual rota está sendo aberta.
  requestHeaders.set(PATHNAME_HEADER, pathname);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  if (isProtected && !getSessionCookie(request)) {
    const signIn = new URL("/entrar", request.url);
    signIn.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(signIn);
    return applyCsp(redirect, nonce);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return applyCsp(response, nonce);
}

export const config = {
  /**
   * Fora do proxy: assets do Next, arquivos estáticos e o favicon — passá-los
   * por aqui só gastaria CPU a cada requisição.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
