import type { Metadata } from "next";
import Link from "next/link";

import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { listAffiliateOrders } from "@/features/commissions/queries";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { labelFor } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Minhas vendas" };

type SearchParams = Promise<{
  status?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

function commissionTone(status: string) {
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

export default async function AffiliateVendasPage({
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
  const result = await listAffiliateOrders(affiliate.id, {
    status: sp.status,
    from: sp.from,
    to: sp.to,
    page,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas vendas"
        description="Pedidos atribuídos ao seu link. A comissão libera após a carência."
      />

      <form className="flex flex-wrap gap-3" method="get">
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          aria-label="Status do pedido"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {["PAID", "REFUNDED", "CHARGEDBACK", "PENDING", "FAILED", "EXPIRED"].map((s) => (
            <option key={s} value={s}>
              {labelFor("orderStatus", s)}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ""}
          aria-label="Data inicial"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ""}
          aria-label="Data final"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
        >
          Filtrar
        </button>
      </form>

      {result.items.length === 0 ? (
        <EmptyState
          title="Nenhuma venda ainda"
          description="Compartilhe seus links para começar a vender."
          action={
            <Link href="/painel/links" className="text-teal-800 underline-offset-2 hover:underline">
              Ver meus links
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-mist-200 bg-mist-100/80 text-xs uppercase text-navy-700">
              <tr>
                <th className="px-3 py-2 font-medium">Data</th>
                <th className="px-3 py-2 font-medium">Produto</th>
                <th className="px-3 py-2 font-medium">Valor</th>
                <th className="px-3 py-2 font-medium">Comissão</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((order) => (
                <tr key={order.id} className="border-b border-mist-100">
                  <td className="px-3 py-2">
                    <DateText date={order.paidAt ?? order.createdAt} />
                  </td>
                  <td className="px-3 py-2">{order.productNameSnap}</td>
                  <td className="px-3 py-2">
                    <MoneyText cents={order.amountCents} />
                  </td>
                  <td className="px-3 py-2">
                    {order.commission ? (
                      <div className="flex flex-col gap-1">
                        <MoneyText cents={order.commission.amountCents} />
                        <StatusBadge
                          label={labelFor("commissionStatus", order.commission.status)}
                          tone={commissionTone(order.commission.status)}
                          hint={
                            order.commission.status === "PENDING"
                              ? `Libera em ${formatDate(order.commission.availableAt)}`
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={labelFor("orderStatus", order.status)}
                      tone={
                        order.status === "PAID"
                          ? "success"
                          : order.status === "PENDING"
                            ? "warning"
                            : "danger"
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {result.total} venda(s) · página {result.page}
      </p>
    </div>
  );
}
