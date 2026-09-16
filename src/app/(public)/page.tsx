import type { Metadata } from "next";
import Link from "next/link";
import { Package } from "lucide-react";

import { ProductCover } from "@/components/content/product-cover";
import { EmptyState } from "@/components/feedback/empty-state";
import { HomeAvisoToast } from "@/components/feedback/home-aviso-toast";
import { PageHeader } from "@/components/layout/page-header";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { listActiveProducts } from "@/features/products/queries";
import { labelFor } from "@/lib/i18n/pt-BR";
import { formatBRL } from "@/lib/money";

export const metadata: Metadata = {
  title: "Vitrine",
  description: "Serviços e materiais digitais do Affiliate Tool.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  const products = await listActiveProducts();

  return (
    <>
      <HomeAvisoToast aviso={aviso} />
      <PageHeader
        title="Programa de Afiliados"
        description="Conheça os serviços e materiais do Affiliate Tool. O checkout completo chega em breve."
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto publicado"
          description="Quando o catálogo for publicado, os itens ativos aparecem aqui."
        />
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/p/${product.slug}`}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-mist-200 bg-white transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:outline-none"
              >
                <div className="bg-mist-100">
                  {product.coverImagePath ? (
                    <ProductCover
                      productId={product.id}
                      alt=""
                      size="sm"
                      className="transition-transform group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center text-navy-700">
                      <Package className="size-10 opacity-40" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-display text-lg text-navy-900 group-hover:text-teal-800">
                      {product.name}
                    </h2>
                    <StatusBadge
                      label={labelFor("productType", product.type)}
                      tone={product.type === "DIGITAL" ? "info" : "neutral"}
                    />
                  </div>
                  <p className="line-clamp-2 flex-1 text-sm text-navy-700">{product.shortDescription}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    {product.compareAtPriceCents ? (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatBRL(product.compareAtPriceCents)}
                      </span>
                    ) : null}
                    <MoneyText cents={product.priceCents} className="text-lg" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
