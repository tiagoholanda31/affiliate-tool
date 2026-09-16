import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ProductForm } from "@/features/products/components/product-form";
import { getProductForAdmin } from "@/features/products/queries";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Editar produto" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/admin/produtos");
  const { id } = await params;
  const product = await getProductForAdmin(id);
  if (!product) notFound();

  return (
    <>
      <PageHeader
        title={product.name}
        description="Edite preço, comissão, arquivo e publicação. Alterar o slug de um produto publicado exige confirmação."
        actions={
          <div className="flex gap-2">
            {product.status === "ACTIVE" ? (
              <Link
                href={`/p/${product.slug}`}
                className={cn(buttonVariants({ variant: "outline" }))}
                target="_blank"
              >
                Ver na vitrine
              </Link>
            ) : null}
            <Link href="/admin/produtos" className={cn(buttonVariants({ variant: "outline" }))}>
              Voltar
            </Link>
          </div>
        }
      />
      <ProductForm mode="edit" initial={product} />
    </>
  );
}
