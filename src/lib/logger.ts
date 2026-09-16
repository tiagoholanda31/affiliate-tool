/**
 * Logger da aplicação (pino).
 *
 * JSON no stdout em produção — é o que o EasyPanel coleta. Em dev, `pino-pretty`
 * deixa legível. Nunca logue PII completa: use os helpers de máscara de
 * `src/lib/crypto.ts` antes de colocar CPF, e-mail ou chave Pix no contexto.
 */
import pino, { type Logger } from "pino";

import { env, isProduction, isTest } from "@/lib/env";

/** Campos que o pino apaga do log caso apareçam por engano. */
const REDACTED_PATHS = [
  "password",
  "*.password",
  "senha",
  "*.senha",
  "cpf",
  "*.cpf",
  "document",
  "*.document",
  "pixKey",
  "*.pixKey",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "card",
  "*.card",
];

export const logger: Logger = pino({
  level: isTest ? "silent" : isProduction ? "info" : "debug",
  redact: { paths: REDACTED_PATHS, censor: "[oculto]" },
  base: env.BUILD_SHA ? { build: env.BUILD_SHA } : undefined,
  ...(isProduction || isTest
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});

/**
 * Logger filho carimbado com o id da requisição, para correlacionar linhas
 * de um mesmo request nos logs do EasyPanel.
 */
export function requestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
