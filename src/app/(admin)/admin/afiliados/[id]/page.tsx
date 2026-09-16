import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AffiliateDetailPage } from "./detail-page";

import { getAffiliateAuditLog, getAffiliateDetailForAdmin } from "@/features/affiliates/admin-queries";
import {
  listAffiliateCommissionsForAdmin,
  listAffiliateOrdersForAdmin,
} from "@/features/commissions/queries";
import { getBalances } from "@/features/commissions/service";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Afiliado ${id}` };
}

export default async function AffiliateDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const affiliate = await getAffiliateDetailForAdmin(id);
  if (!affiliate) notFound();

  const [auditLog, orders, commissions, balances, payouts] = await Promise.all([
    getAffiliateAuditLog(id),
    listAffiliateOrdersForAdmin(id),
    listAffiliateCommissionsForAdmin(id),
    getBalances(id),
    db.payout.findMany({
      where: { affiliateId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        totalCents: true,
        referenceMonth: true,
        paidAt: true,
        createdAt: true,
        proofPath: true,
      },
    }),
  ]);

  return (
    <AffiliateDetailPage
      affiliate={affiliate}
      auditLog={auditLog}
      orders={orders}
      commissions={commissions}
      balances={balances}
      payouts={payouts}
    />
  );
}
