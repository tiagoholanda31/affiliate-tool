import type { Metadata } from "next";
import Link from "next/link";

import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { listAdminOrders } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth";
import { maskEmail } from "@/lib/crypto";
import { labelFor } from "@/lib/i18n/pt-BR";
import type { OrderStatus, PaymentMethod } from "@/generated/prisma/client";

export const metadata: Metadata = { title: "Vendas" };

type SearchParams = Promise<{
  status?: string;
  q?: string;
  page?: string;
  method?: string;
}>;

function toneFor(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "FAILED":
    case "EXPIRED":
    case "CHARGEDBACK":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default async function AdminVendasPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const result = await listAdminOrders({
    status: sp.status as OrderStatus | undefined,
    method: sp.method as PaymentMethod | undefined,
    q: sp.q,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        description="Pedidos de checkout e vendas manuais."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/api/admin/export/vendas?format=csv${sp.status ? `&status=${sp.status}` : ""}`}
              className="inline-flex h-9 items-center rounded-md border border-mist-300 px-3 text-sm text-navy-800 hover:bg-mist-100"
            >
              CSV
            </Link>
            <Link
              href={`/api/admin/export/vendas?format=xlsx${sp.status ? `&status=${sp.status}` : ""}`}
              className="inline-flex h-9 items-center rounded-md border border-mist-300 px-3 text-sm text-navy-800 hover:bg-mist-100"
            >
              XLSX
            </Link>
            <Link
              href="/admin/vendas/nova"
              className="inline-flex h-9 items-center rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
            >
              Lançar venda manual
            </Link>
          </div>
        }
      />

      <form className="flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Código, e-mail ou nome"
          aria-label="Buscar vendas"
          className="h-9 min-w-[200px] flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          aria-label="Status do pedido"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os status</option>
          {["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED", "CHARGEDBACK", "CANCELED"].map(
            (s) => (
              <option key={s} value={s}>
                {labelFor("orderStatus", s)}
              </option>
            ),
          )}
        </select>
        <select
          name="method"
          defaultValue={sp.method ?? ""}
          aria-label="Método de pagamento"
          className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
        >
          <option value="">Todos os métodos</option>
          <option value="PIX">Pix</option>
          <option value="CREDIT_CARD">Cartão</option>
          <option value="MANUAL">Manual</option>
        </select>
        <button
          type="submit"
          className="h-9 rounded-md bg-navy-900 px-4 text-sm text-white hover:bg-navy-700"
        >
          Filtrar
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="border-b border-mist-200 bg-mist-100/80 text-xs uppercase text-navy-700">
            <tr>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Data</th>
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 font-medium">Comprador</th>
              <th className="px-3 py-2 font-medium">Afiliado</th>
              <th className="px-3 py-2 font-medium">Método</th>
              <th className="px-3 py-2 font-medium">Valor</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada.
                </td>
              </tr>
            ) : (
              result.items.map((order) => (
                <tr key={order.id} className="border-b border-mist-100 hover:bg-mist-100/40">
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/vendas/${order.id}`}
                      className="font-medium text-teal-700 underline-offset-2 hover:underline"
                    >
                      {order.publicCode}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <DateText date={order.createdAt} />
                  </td>
                  <td className="px-3 py-2">{order.product.name}</td>
                  <td className="px-3 py-2">
                    <div>{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {maskEmail(order.customerEmail)}
                    </div>
                  </td>
                  <td className="px-3 py-2">{order.affiliate?.code ?? "—"}</td>
                  <td className="px-3 py-2">
                    {labelFor("paymentMethod", order.paymentMethod)}
                  </td>
                  <td className="px-3 py-2">
                    <MoneyText cents={order.amountCents} />
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      label={labelFor("orderStatus", order.status)}
                      tone={toneFor(order.status)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        {result.total} venda(s) · página {result.page}
      </p>
    </div>
  );
}
