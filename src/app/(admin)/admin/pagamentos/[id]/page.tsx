import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PayoutDetailClient } from "@/features/payouts/components/payout-detail-client";
import { getPayoutDetail } from "@/features/payouts/queries";
import { StatusBadge } from "@/components/data-display/status-badge";
import { MoneyText } from "@/components/data-display/money-text";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { labelFor } from "@/lib/i18n/pt-BR";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Lote ${id.slice(0, 8)}` };
}

export default async function AdminPayoutDetailPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  const payout = await getPayoutDetail(id);
  if (!payout) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Lote · ${payout.affiliate.user.name}`}
        description={`Mês ${payout.referenceMonth} · ${payout.affiliate.code ?? "sem código"}`}
        actions={
          <Link href="/admin/pagamentos" className="text-sm text-teal-700 hover:underline">
            ← Voltar
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <StatusBadge
          label={labelFor("payoutStatus", payout.status)}
          tone={payout.status === "PAID" ? "success" : "info"}
        />
        <span className="font-display text-2xl text-navy-900">
          <MoneyText cents={payout.totalCents} />
        </span>
        <span className="text-sm text-muted-foreground">
          {payout.commissions.length} comissão
          {payout.commissions.length === 1 ? "" : "ões"}
          {payout.adjustments.length > 0
            ? ` · ${String(payout.adjustments.length)} ajuste${payout.adjustments.length === 1 ? "" : "s"}`
            : ""}
        </span>
      </div>

      <PayoutDetailClient payout={payout} />
    </div>
  );
}
