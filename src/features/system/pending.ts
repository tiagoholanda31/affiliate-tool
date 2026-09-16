/**
 * Contagens leves para o sino de pendências do admin.
 * Só `count` / agregados — sem listagens pesadas.
 */
import { getPendingAffiliatesCount } from "@/features/affiliates/admin-queries";
import { getPayoutBellHint } from "@/features/payouts/queries";
import { db } from "@/lib/db";

const FAILED_JOBS_WINDOW_MS = 48 * 60 * 60 * 1000;

export type AdminPendingSummary = {
  pendingAffiliates: number;
  payoutAffiliates: number;
  payoutCents: number;
  showPayout: boolean;
  failedWebhooks: number;
  failedJobs: number;
  total: number;
};

export async function getAdminPendingSummary(
  now: Date = new Date(),
): Promise<AdminPendingSummary> {
  const since = new Date(now.getTime() - FAILED_JOBS_WINDOW_MS);

  const [pendingAffiliates, payoutHint, failedWebhooks, failedJobs] = await Promise.all([
    getPendingAffiliatesCount(),
    getPayoutBellHint(now),
    db.webhookEvent.count({ where: { status: "FAILED" } }),
    db.jobRun.count({
      where: {
        ok: false,
        startedAt: { gte: since },
      },
    }),
  ]);

  const showPayout = Boolean(payoutHint?.show);
  const payoutAffiliates = showPayout ? (payoutHint?.affiliatesWithBalance ?? 0) : 0;
  const payoutCents = showPayout ? (payoutHint?.totalAvailableCents ?? 0) : 0;

  const total =
    pendingAffiliates + payoutAffiliates + failedWebhooks + failedJobs;

  return {
    pendingAffiliates,
    payoutAffiliates,
    payoutCents,
    showPayout,
    failedWebhooks,
    failedJobs,
    total,
  };
}
