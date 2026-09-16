/**
 * Wrappers de Server Action.
 *
 * Regra do CLAUDE.md: toda Server Action passa por aqui. Cada wrapper faz, nesta
 * ordem, o que a action não deveria precisar repetir:
 *
 *   1. **autentica** (e confere o papel, no caso de `adminAction`);
 *   2. **valida** a entrada com Zod — nunca confiando no que veio do client;
 *   3. chama o handler;
 *   4. **audita**, quando a ação pede;
 *   5. converte o que der errado em `ActionResult`.
 *
 * A ordem importa: validar antes de autenticar diria a um anônimo quais campos
 * a ação espera. Erro de negócio (`AppError` exposto) chega ao usuário como
 * mensagem; qualquer outro vira log com contexto e mensagem genérica.
 *
 * Uma Server Action é um endpoint POST público — dá para chamá-la sem passar
 * pela tela. É por isso que a checagem mora aqui, e não no layout.
 */
import { headers as nextHeaders } from "next/headers";
import type { z } from "zod";

import type { Role } from "@/generated/prisma/enums";
import { recordAudit, type AuditEntry } from "@/lib/audit";
import { getSession, type AppSession } from "@/lib/auth";
import { AppError, isAppError, toUserMessage, type ActionResult } from "@/lib/errors";
import { getClientIp } from "@/lib/http";
import { logger } from "@/lib/logger";

export type { ActionResult };

/** O que o handler recebe além da entrada já validada. */
export type ActionContext = {
  session: AppSession;
  /** IP do cliente, para rate limit e auditoria. */
  ip: string;
  headers: Headers;
};

/** Contexto de uma action pública (sem sessão). */
export type PublicActionContext = Omit<ActionContext, "session">;

type AuditFactory<TInput, TOutput> = (
  result: TOutput,
  input: TInput,
  context: ActionContext,
) => Omit<AuditEntry, "actorId" | "actorRole" | "ip"> | null;

type DefineOptions<TSchema extends z.ZodType, TOutput> = {
  /** Nome curto para o log — `affiliate.changePix`. */
  name: string;
  schema: TSchema;
  handler: (input: z.output<TSchema>, context: ActionContext) => Promise<TOutput>;
  /**
   * Quando presente, grava `AuditLog` após o sucesso. Devolver `null` pula o
   * registro (útil quando a ação não mudou nada de fato).
   */
  audit?: AuditFactory<z.output<TSchema>, TOutput>;
};

type PublicDefineOptions<TSchema extends z.ZodType, TOutput> = {
  name: string;
  schema: TSchema;
  handler: (input: z.output<TSchema>, context: PublicActionContext) => Promise<TOutput>;
};

/** `fieldErrors` no formato que o react-hook-form consome via `setError`. */
function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".") || "_form";
    (fieldErrors[path] ??= []).push(issue.message);
  }

  return fieldErrors;
}

const VALIDATION_MESSAGE = "Confira os campos destacados.";

/** Converte qualquer exceção do handler em `ActionResult` de erro. */
function toFailure(name: string, error: unknown): ActionResult<never> {
  if (isAppError(error) && error.expose) {
    return { ok: false, error: error.message };
  }

  logger.error(
    { action: name, ...(isAppError(error) ? { code: error.code, meta: error.meta } : {}), err: error },
    "Erro não tratado em Server Action",
  );

  return { ok: false, error: toUserMessage(error) };
}

async function buildBaseContext(): Promise<PublicActionContext> {
  const headers = await nextHeaders();
  return { headers, ip: getClientIp(headers) };
}

/**
 * Action que exige apenas sessão (qualquer papel).
 * Use quando a autorização fina depende do recurso — a query filtra por posse.
 */
export function authedAction<TSchema extends z.ZodType, TOutput>(
  options: DefineOptions<TSchema, TOutput>,
) {
  return createAction(options, null);
}

/** Action restrita a `ADMIN`. Audita por padrão o que o `audit` descrever. */
export function adminAction<TSchema extends z.ZodType, TOutput>(
  options: DefineOptions<TSchema, TOutput>,
) {
  return createAction(options, "ADMIN");
}

/**
 * Action sem sessão — cadastro, login, recuperação de senha.
 *
 * Não é "sem proteção": quem usa isto é responsável pelo rate limit e pelas
 * checagens anti-abuso, porque é justamente o caminho que um anônimo alcança.
 */
export function publicAction<TSchema extends z.ZodType, TOutput>({
  name,
  schema,
  handler,
}: PublicDefineOptions<TSchema, TOutput>) {
  return async (rawInput: z.input<TSchema>): Promise<ActionResult<TOutput>> => {
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return { ok: false, error: VALIDATION_MESSAGE, fieldErrors: toFieldErrors(parsed.error) };
    }

    try {
      const context = await buildBaseContext();
      return { ok: true, data: await handler(parsed.data, context) };
    } catch (error) {
      return toFailure(name, error);
    }
  };
}

function createAction<TSchema extends z.ZodType, TOutput>(
  { name, schema, handler, audit }: DefineOptions<TSchema, TOutput>,
  requiredRole: Role | null,
) {
  return async (rawInput: z.input<TSchema>): Promise<ActionResult<TOutput>> => {
    try {
      const session = await getSession();
      if (!session) {
        throw new AppError("UNAUTHENTICATED", "Sua sessão expirou. Entre novamente.");
      }
      if (requiredRole && session.user.role !== requiredRole) {
        throw new AppError("FORBIDDEN", "Você não tem permissão para esta ação.");
      }

      const parsed = schema.safeParse(rawInput);
      if (!parsed.success) {
        return { ok: false, error: VALIDATION_MESSAGE, fieldErrors: toFieldErrors(parsed.error) };
      }

      const base = await buildBaseContext();
      const context: ActionContext = { ...base, session };
      const input = parsed.data;
      const data = await handler(input, context);

      if (audit) {
        const entry = audit(data, input, context);
        if (entry) {
          await recordAudit({
            ...entry,
            actorId: session.user.id,
            actorRole: session.user.role,
            ip: context.ip,
          });
        }
      }

      return { ok: true, data };
    } catch (error) {
      return toFailure(name, error);
    }
  };
}
