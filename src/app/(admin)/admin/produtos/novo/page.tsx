import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ProductForm } from "@/features/products/components/product-form";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Novo produto" };

export default async function NewProductPage() {
  await requireAdmin("/admin/produtos/novo");

  return (
    <>
      <PageHeader
        title="Novo produto"
        description="Cadastre um serviço ou livro digital. Você pode salvar como rascunho e publicar depois."
        actions={
          <Link href="/admin/produtos" className={cn(buttonVariants({ variant: "outline" }))}>
            Voltar
          </Link>
        }
      />
      <ProductForm mode="create" />
    </>
  );
}
