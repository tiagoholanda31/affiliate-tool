/**
 * Erros de domínio.
 *
 * Regra do CLAUDE.md: erro **esperado** vira `{ ok: false, error }` para a UI;
 * erro inesperado vai para o logger com contexto e chega ao usuário como
 * mensagem genérica. `expose` é o que decide de que lado o erro está.
 */

/** Códigos de erro de negócio conhecidos. Cada fatia acrescenta os seus. */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "RATE_LIMITED",
  "INVALID_TRANSITION",
  "CONFLICT",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

type AppErrorOptions = {
  /** HTTP a usar quando o erro sai por um Route Handler. */
  status?: number;
  /** `true` mostra a mensagem ao usuário; `false` troca por texto genérico. */
  expose?: boolean;
  /** Contexto para o log (nunca PII completa). */
  meta?: Record<string, unknown>;
  cause?: unknown;
};

const DEFAULT_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  INVALID_TRANSITION: 409,
  CONFLICT: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;
  readonly meta: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = options.status ?? DEFAULT_STATUS[code];
    // Erros internos nunca vazam detalhe por padrão.
    this.expose = options.expose ?? code !== "INTERNAL";
    this.meta = options.meta;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Mensagem segura para mostrar ao usuário final. */
export const GENERIC_ERROR_MESSAGE = "Algo deu errado. Tente novamente.";

export function toUserMessage(error: unknown): string {
  return isAppError(error) && error.expose ? error.message : GENERIC_ERROR_MESSAGE;
}

// Atalhos para os erros mais frequentes — evitam repetir código e mensagem.

export function unauthenticated(message = "Você precisa entrar para continuar."): AppError {
  return new AppError("UNAUTHENTICATED", message);
}

export function forbidden(message = "Você não tem permissão para esta ação."): AppError {
  return new AppError("FORBIDDEN", message);
}

export function notFound(message = "Não encontramos o que você procura."): AppError {
  return new AppError("NOT_FOUND", message);
}

export function validation(message: string, meta?: Record<string, unknown>): AppError {
  return new AppError("VALIDATION", message, { meta });
}

export function rateLimited(message = "Muitas tentativas. Aguarde um instante."): AppError {
  return new AppError("RATE_LIMITED", message);
}

export function invalidTransition(from: string, to: string): AppError {
  return new AppError("INVALID_TRANSITION", `Não é possível mudar de ${from} para ${to}.`, {
    meta: { from, to },
  });
}

export function conflict(message: string): AppError {
  return new AppError("CONFLICT", message);
}

export function internal(message: string, cause?: unknown): AppError {
  return new AppError("INTERNAL", message, { expose: false, cause });
}

/** Resultado padrão de toda Server Action (ver `src/lib/safe-action.ts`, fatia 01). */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
