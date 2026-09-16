import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getBearerToken } from "@/lib/http";
import { purgeOldClicks } from "@/features/tracking/service";

export const runtime = "nodejs";

/** Retenção: apaga cliques com mais de 13 meses. Auth: Bearer CRON_SECRET. */
export async function POST(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request.headers);
  if (!token || token !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const job = await db.jobRun.create({
    data: { name: "purge-clicks" },
  });

  try {
    const deleted = await purgeOldClicks();
    const summary = { deleted };

    await db.jobRun.update({
      where: { id: job.id },
      data: {
        finishedAt: new Date(),
        ok: true,
        summary,
      },
    });

    await recordAudit({
      actorId: null,
      actorRole: "SYSTEM",
      action: "cron.purge_clicks",
      entity: "System",
      entityId: "cron",
      after: summary,
    });

    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: false, error: message.slice(0, 500) },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
