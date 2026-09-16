import { NextResponse } from "next/server";

import { anonymizeAffiliate } from "@/features/affiliates/admin-service";
import { db } from "@/lib/db";
import { getBearerToken } from "@/lib/http";
import { logger } from "@/lib/logger";
import { recordAudit } from "@/lib/audit";
import { env } from "@/lib/env";

const DAYS_TO_ANONYMIZE = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const token = getBearerToken(request.headers);
  if (!token || token !== env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const job = await db.jobRun.create({
    data: { name: "anonymize-removed" },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_TO_ANONYMIZE);

  try {
    const candidates = await db.affiliate.findMany({
      where: {
        status: "REMOVED",
        anonymizedAt: null,
        statusChangedAt: { lt: cutoff },
      },
      select: { id: true },
    });

    let processed = 0;
    let failed = 0;

    for (const candidate of candidates) {
      try {
        await db.$transaction(async (tx) => {
          return anonymizeAffiliate(candidate.id, null, tx);
        });
        processed += 1;
      } catch (error) {
        failed += 1;
        logger.error(
          { affiliateId: candidate.id, err: error },
          "Falha ao anonimizar afiliado no cron",
        );
      }
    }

    const summary = { processed, failed, cutoff: cutoff.toISOString() };

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
      action: "cron.anonymize_removed",
      entity: "System",
      entityId: "cron",
      after: summary,
    });

    return NextResponse.json({ ok: true, processed, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.jobRun.update({
      where: { id: job.id },
      data: { finishedAt: new Date(), ok: false, error: message.slice(0, 500) },
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
