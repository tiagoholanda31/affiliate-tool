import type { Metadata } from "next";
import Link from "next/link";

import { ManualSaleForm } from "@/features/commissions/components/manual-sale-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Lançar venda manual" };

export default async function NovaVendaManualPage() {
  await requireAdmin();

  const products = await db.product.findMany({
    where: { status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, priceCents: true, status: true, type: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lançar venda manual"
        description="Para negociações fora do checkout. O pedido nasce como pago."
        actions={
          <Button asChild variant="outline">
            <Link href="/admin/vendas">Voltar</Link>
          </Button>
        }
      />

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Cadastre um produto antes de lançar uma venda manual.
        </p>
      ) : (
        <ManualSaleForm products={products} />
      )}
    </div>
  );
}
