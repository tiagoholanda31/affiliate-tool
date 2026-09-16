import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Package } from "lucide-react";

import { Markdown } from "@/components/content/markdown";
import { ProductCover } from "@/components/content/product-cover";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { CheckoutForm } from "@/features/checkout/components/checkout-form";
import {
  installmentLabel,
  resolveProductSlug,
} from "@/features/products/queries";
import { env } from "@/lib/env";
import { labelFor } from "@/lib/i18n/pt-BR";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolved = await resolveProductSlug(slug);

  if (resolved.kind === "redirect") {
    return { title: "Redirecionando…" };
  }
  if (resolved.kind === "missing") {
    return { title: "Produto não encontrado" };
  }

  const product = resolved.product;
  if (product.status === "DRAFT") {
    return { title: "Produto não encontrado" };
  }

  const title = product.name;
  const description = product.shortDescription;
  const ogImage = product.coverImagePath
    ? `${env.NEXT_PUBLIC_APP_URL}/api/media/cover/${product.id}?size=lg`
    : undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 900 }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const resolved = await resolveProductSlug(slug);

  if (resolved.kind === "redirect") {
    permanentRedirect(`/p/${resolved.toSlug}`);
  }
  if (resolved.kind === "missing") {
    notFound();
  }

  const product = resolved.product;

  if (product.status === "DRAFT") {
    notFound();
  }

  if (product.status === "ARCHIVED") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <Package className="mx-auto size-12 text-navy-700 opacity-50" aria-hidden />
        <h1 className="font-display text-3xl text-navy-900">Produto indisponível</h1>
        <p className="text-navy-700">
          Este item não está mais à venda. Confira os produtos ativos na vitrine.
        </p>
        <Link href="/" className={cn(buttonVariants())}>
          Voltar à vitrine
        </Link>
      </div>
    );
  }

  const parcels = installmentLabel(product.priceCents, product.maxInstallments);

  return (
    <article className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
        <div className="overflow-hidden rounded-lg bg-mist-100">
          {product.coverImagePath ? (
            <ProductCover productId={product.id} alt={`Capa de ${product.name}`} size="lg" priority />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center">
              <Package className="size-16 text-navy-700 opacity-40" aria-hidden />
            </div>
          )}
        </div>

        <div className="space-y-5">
          <StatusBadge
            label={labelFor("productType", product.type)}
            tone={product.type === "DIGITAL" ? "info" : "neutral"}
          />
          <h1 className="font-display text-4xl text-balance text-navy-900">{product.name}</h1>
          <p className="text-navy-700">{product.shortDescription}</p>

          <div className="flex flex-wrap items-baseline gap-3">
            {product.compareAtPriceCents ? (
              <span className="text-lg text-muted-foreground line-through">
                {formatBRL(product.compareAtPriceCents)}
              </span>
            ) : null}
            <MoneyText cents={product.priceCents} className="text-3xl" />
          </div>
          {parcels ? <p className="text-sm text-navy-700">{parcels}</p> : null}

          <div className="space-y-2 rounded-lg border border-mist-200 bg-white p-4">
            <CheckoutForm
              product={{
                id: product.id,
                name: product.name,
                priceCents: product.priceCents,
                allowPix: product.allowPix,
                allowCard: product.allowCard,
                maxInstallments: product.maxInstallments,
              }}
              fakeTokenizer={env.PAGARME_DRIVER === "fake"}
            />
          </div>

          <p className="text-sm text-muted-foreground">
            <Link href="/" className="text-navy-800 underline-offset-2 hover:underline">
              ← Voltar à vitrine
            </Link>
          </p>
        </div>
      </div>

      <section aria-labelledby="product-description-heading" className="rounded-lg border border-mist-200 bg-white p-6">
        <h2 id="product-description-heading" className="mb-4 font-display text-2xl text-navy-900">
          Sobre
        </h2>
        <Markdown>{product.description}</Markdown>
      </section>
    </article>
  );
}
