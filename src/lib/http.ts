/**
 * Helpers de Route Handler.
 *
 * Padroniza respostas JSON e a leitura do IP real, que em produção chega pelo
 * Traefik (EasyPanel) no `x-forwarded-for`.
 */
import { AppError, GENERIC_ERROR_MESSAGE, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export function json(data: unknown, init?: ResponseInit): Response {
  return Response.json(data, init);
}

export function ok(data: unknown): Response {
  return json(data, { status: 200 });
}

export function badRequest(error = "Requisição inválida.", details?: unknown): Response {
  return json({ ok: false, error, details }, { status: 400 });
}

export function unauthorized(error = "Não autenticado."): Response {
  return json({ ok: false, error }, { status: 401 });
}

export function forbidden(error = "Sem permissão."): Response {
  return json({ ok: false, error }, { status: 403 });
}

export function notFound(error = "Não encontrado."): Response {
  return json({ ok: false, error }, { status: 404 });
}

export function tooManyRequests(resetAt: Date): Response {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
  return json(
    { ok: false, error: "Muitas tentativas. Aguarde um instante." },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

export function serverError(error = GENERIC_ERROR_MESSAGE): Response {
  return json({ ok: false, error }, { status: 500 });
}

/**
 * Converte qualquer erro em resposta HTTP: `AppError` exposto vira a própria
 * mensagem; o resto é logado e devolve texto genérico.
 */
export function errorResponse(error: unknown, context?: Record<string, unknown>): Response {
  if (isAppError(error) && error.expose) {
    return json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }

  logger.error(
    {
      ...context,
      ...(isAppError(error) ? { code: error.code, meta: error.meta } : {}),
      err: error,
    },
    "Erro não tratado em route handler",
  );

  return serverError();
}

/**
 * IP do cliente. Confia no primeiro endereço de `x-forwarded-for` porque quem
 * escreve esse header aqui é o Traefik, na frente do container.
 * Se o Cloudflare entrar como proxy, passar a ler `cf-connecting-ip` (ver spec 08).
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

/** Lê o `Authorization: Bearer <token>` de uma requisição de cron ou webhook. */
export function getBearerToken(headers: Headers): string | null {
  const authorization = headers.get("authorization");
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token === "" ? null : token;
}

/** Faz o parse do corpo JSON, transformando corpo inválido em `AppError`. */
export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch (cause) {
    throw new AppError("VALIDATION", "Corpo da requisição não é um JSON válido.", { cause });
  }
}
