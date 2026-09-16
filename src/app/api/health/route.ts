import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { json } from "@/lib/http";
import { logger } from "@/lib/logger";

/**
 * Health check consumido pelo HEALTHCHECK do Docker, pelo EasyPanel e pelo
 * monitor externo. Responde 200 apenas quando o banco também responde — um app
 * de pé sem banco não serve para nada e deve reiniciar.
 *
 * Forma estável (docs/spec/04 / fatia 11): `{ ok, db, version }`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  let database = false;

  try {
    await db.$queryRaw`SELECT 1`;
    database = true;
  } catch (error) {
    logger.error({ err: error }, "Health check: banco indisponível");
  }

  return json(
    {
      ok: database,
      db: database,
      version: env.BUILD_SHA ?? "dev",
    },
    {
      status: database ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
