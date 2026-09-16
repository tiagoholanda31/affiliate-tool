/**
 * Cliente Prisma singleton.
 *
 * Em dev o Next recarrega módulos a cada edição; sem o cache em `globalThis` cada
 * recarga abriria um novo pool de conexões até estourar `max_connections`.
 *
 * Prisma 7 exige um driver adapter — usamos `@prisma/adapter-pg` (node-postgres).
 */
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
import { env, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";

/** Consultas acima disto viram alerta no log de desenvolvimento. */
const SLOW_QUERY_MS = 300;

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  const client = new PrismaClient({
    adapter,
    log: isProduction
      ? [{ emit: "event", level: "error" }]
      : [
          { emit: "event", level: "query" },
          { emit: "event", level: "error" },
        ],
  });

  client.$on("error", (event) => {
    logger.error({ target: event.target }, event.message);
  });

  if (!isProduction) {
    client.$on("query", (event) => {
      if (event.duration >= SLOW_QUERY_MS) {
        logger.warn({ durationMs: event.duration, query: event.query }, "Consulta lenta no banco");
      }
    });
  }

  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = db;
}
