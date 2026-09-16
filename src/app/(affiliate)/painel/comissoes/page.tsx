import type { CommissionStatus } from "@/generated/prisma/enums";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { listAffiliateCommissions } from "@/features/commissions/queries";
import { AffiliatePayoutLots } from "@/features/payouts/components/affiliate-payout-lots";
import { listAffiliatePayouts } from "@/features/payouts/queries";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { StatusBadge } from "@/components/data-display/status-badge";
import { MoneyText } from "@/components/data-display/money-text";
import { KpiCard } from "@/components/data-display/kpi-card";
import { DateText } from "@/components/data-display/date-text";
import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { requireAffiliate } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { labelFor } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Comissões" };

type SearchParams = Promise<{ status?: string; page?: string }>;

function toneFor(status: string) {
  switch (status) {
    case "AVAILABLE":
    case "PAID":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "REVERSED":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default async function AffiliateComissoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await requireAffiliate(AFFILIATE_ROUTES.home);
  const sp = await searchParams;
  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!affiliate) {
    return <EmptyState title="Perfil incompleto" description="Não encontramos seus dados." />;
  }

  const page = Number(sp.page ?? "1") || 1;
  const [result, payouts] = await Promise.all([
    listAffiliateCommissions(affiliate.id, {
      status: sp.status as CommissionStatus | undefined,
      page,
    }),
    listAffiliatePayouts(affiliate.id),
  ]);
  const { balances } = result;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comissões"
        description="Saldos, extrato de comissões e lotes de pagamento recebidos."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pendente" value={formatBRL(balances.pendingCents)} hint="Em carência" />
        <KpiCard
          label="Disponível"
          value={formatBRL(balances.availableCents)}
          variant="gold"
          icon={Wallet}
          hint={`Próximo pagamento previsto: ${formatDate(balances.nextPayoutDate)}`}
        />
        <KpiCard label="Já pago" value={formatBRL(balances.paidCents)} />
        <KpiCard
          label="Ajustes abertos"
          value={formatBRL(balances.openAdjustmentsCents)}
          hint="Abatidos no próximo lote"
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-navy-900">Pagamentos recebidos</h2>
        <AffiliatePayoutLots lots={payouts} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-navy-900">Extrato de comissões</h2>

        <form className="flex flex-wrap gap-3" method="get">
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            aria-label="Status da comissão"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Todos os status</option>
            {["PENDING", "AVAILABLE", "PAID", "REVERSED"].map((s) => (
              <option key={s} value={s}>
                {labelFor("commissionStatus", s)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
          >
            Filtrar
          </button>
        </form>

        {result.items.length === 0 ? (
          <EmptyState
            title="Nenhuma comissão"
            description="Quando uma venda for paga pelo seu link, a comissão aparece aqui."
            action={
              <Link href="/painel/vendas" className="text-teal-800 underline-offset-2 hover:underline">
                Ver vendas
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-mist-200 bg-mist-100/80 text-xs uppercase text-navy-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Pedido</th>
                  <th className="px-3 py-2 font-medium">Produto</th>
                  <th className="px-3 py-2 font-medium">Valor</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Libera em</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((c) => (
                  <tr key={c.id} className="border-b border-mist-100">
                    <td className="px-3 py-2 font-medium">{c.order.publicCode}</td>
                    <td className="px-3 py-2">{c.order.productNameSnap}</td>
                    <td className="px-3 py-2">
                      <MoneyText cents={c.amountCents} />
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge
                        label={labelFor("commissionStatus", c.status)}
                        tone={toneFor(c.status)}
                        hint={
                          c.status === "PENDING"
                            ? `Libera em ${formatDate(c.availableAt)}`
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <DateText date={c.availableAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          {result.total} comissão(ões) · página {result.page}
        </p>
      </section>
    </div>
  );
}
