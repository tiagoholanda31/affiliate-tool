import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ProductsDataTable } from "./data-table";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getProductsForAdmin, type ProductListFilter } from "@/features/products/queries";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Produtos" };

const VALID_STATUSES = ["ALL", "DRAFT", "ACTIVE", "ARCHIVED"] as const;
const VALID_TYPES = ["ALL", "SERVICE", "DIGITAL"] as const;

function parseSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): ProductListFilter {
  const status = searchParams.status;
  const type = searchParams.type;
  const q = searchParams.q;
  const page = searchParams.page;

  return {
    status:
      typeof status === "string" && (VALID_STATUSES as readonly string[]).includes(status)
        ? (status as ProductListFilter["status"])
        : "ALL",
    type:
      typeof type === "string" && (VALID_TYPES as readonly string[]).includes(type)
        ? (type as ProductListFilter["type"])
        : "ALL",
    q: typeof q === "string" ? q : undefined,
    page: typeof page === "string" ? Number(page) : undefined,
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/produtos");
  const filters = parseSearchParams(await searchParams);
  const result = await getProductsForAdmin(filters);

  if (result.page > 1 && result.items.length === 0) {
    redirect("/admin/produtos");
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        description="Cadastre serviços e livros digitais, defina preço, comissão e publique na vitrine."
        actions={
          <Link href="/admin/produtos/novo" className={cn(buttonVariants())}>
            Novo produto
          </Link>
        }
      />
      <ProductsDataTable initial={result} />
    </>
  );
}
