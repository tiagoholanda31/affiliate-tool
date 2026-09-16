import type { CommissionStatus } from "@/generated/prisma/enums";
import { labelFor } from "@/lib/i18n/pt-BR";
import { requireAdmin } from "@/lib/auth";
import { listAdminCommissions } from "@/features/commissions/queries";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data-display/status-badge";
import { MoneyText } from "@/components/data-display/money-text";
import { DateText } from "@/components/data-display/date-text";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Comissões" };

type SearchParams = Promise<{
  status?: string;
  affiliateId?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

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

export default async function AdminComissoesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const result = await listAdminCommissions({
    status: sp.status as CommissionStatus | undefined,
    affiliateId: sp.affiliateId,
    from: sp.from,
    to: sp.to,
    page,
    pageSize: 25,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comissões"
        description="Todas as comissões geradas por vendas pagas (checkout ou manuais)."
        actions={
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/admin/export/comissoes?format=csv${sp.status ? `&status=${sp.status}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}${sp.affiliateId ? `&affiliateId=${sp.affiliateId}` : ""}`}
              className="inline-flex h-9 items-center rounded-md border border-mist-300 px-3 text-sm text-navy-800 hover:bg-mist-100"
            >
              CSV
            </a>
            <a
              href={`/api/admin/export/comissoes?format=xlsx${sp.status ? `&status=${sp.status}` : ""}${sp.from ? `&from=${sp.from}` : ""}${sp.to ? `&to=${sp.to}` : ""}${sp.affiliateId ? `&affiliateId=${sp.affiliateId}` : ""}`}
              className="inline-flex h-9 items-center rounded-md border border-mist-300 px-3 text-sm text-navy-800 hover:bg-mist-100"
            >
              XLSX
            </a>
          </div>
        }
      />

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
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          aria-label="De"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ""}
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
          aria-label="Até"
        />
        <input
          name="affiliateId"
          defaultValue={sp.affiliateId ?? ""}
          placeholder="ID do afiliado"
          aria-label="ID do afiliado"
          className="h-9 min-w-[180px] rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-mist-200 bg-mist-100/80 text-xs uppercase text-navy-700">
            <tr>
              <th className="px-3 py-2 font-medium">Afiliado</th>
              <th className="px-3 py-2 font-medium">Pedido</th>
              <th className="px-3 py-2 font-medium">Base</th>
              <th className="px-3 py-2 font-medium">Taxa</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Libera em</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma comissão encontrada.
                </td>
              </tr>
            ) : (
              result.items.map((c) => (
                <tr key={c.id} className="border-b border-mist-100 hover:bg-mist-100/40">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/afiliados/${c.affiliateId}`}
                      className="text-teal-700 underline-offset-2 hover:underline"
                    >
                      {c.affiliate.code ? `@${c.affiliate.code}` : c.affiliate.user.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/vendas/${c.order.id}`}
                      className="font-medium text-teal-700 underline-offset-2 hover:underline"
                    >
                      {c.order.publicCode}
                    </Link>
                    <div className="text-xs text-muted-foreground">{c.order.productNameSnap}</div>
                  </td>
                  <td className="px-3 py-2">
                    <MoneyText cents={c.baseAmountCents} />
                  </td>
                  <td className="px-3 py-2">
                    {c.rateType === "PERCENT"
                      ? `${(c.rateValue / 100).toLocaleString("pt-BR")}%`
                      : <MoneyText cents={c.rateValue} />}
                  </td>
                  <td className="px-3 py-2">
                    <MoneyText cents={c.amountCents} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={labelFor("commissionStatus", c.status)}
                      tone={toneFor(c.status)}
                      hint={
                        c.status === "PENDING"
                          ? `Libera em ${c.availableAt.toISOString().slice(0, 10)}`
                          : undefined
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    {c.status === "PAID" && c.paidAt ? (
                      <DateText date={c.paidAt} />
                    ) : (
                      <DateText date={c.availableAt} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-mist-200 bg-mist-100/50 font-medium">
              <td colSpan={4} className="px-3 py-2 text-right text-muted-foreground">
                Total do filtro
              </td>
              <td className="px-3 py-2">
                <MoneyText cents={result.filterTotalCents} />
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        {result.total} comissão(ões) · página {result.page}
      </p>
    </div>
  );
}
