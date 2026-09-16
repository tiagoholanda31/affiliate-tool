"use client";

import { Download, ExternalLink, FileImage, FileText, Link2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { CopyButton } from "@/components/forms/copy-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  replaceLinkPlaceholder,
  resolveMaterialAffiliateUrl,
} from "@/features/materials/text";
import type { MaterialCard } from "@/features/materials/types";
import { labelFor } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

type ProductOption = { id: string; name: string };

type MaterialsGalleryProps = {
  materials: MaterialCard[];
  products: ProductOption[];
  affiliateCode: string;
  filters: {
    type: string;
    productId?: string;
    q?: string;
  };
};

export function MaterialsGallery({
  materials,
  products,
  affiliateCode,
  filters,
}: MaterialsGalleryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === "ALL" || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      startTransition(() => {
        router.push(`/painel/materiais?${next.toString()}`);
      });
    },
    [router, searchParams],
  );

  const hasFilters =
    filters.type !== "ALL" || Boolean(filters.productId ?? filters.q);

  return (
    <div className="flex flex-col gap-6">
      <form
        className="grid gap-3 rounded-lg border border-mist-200 bg-white p-4 sm:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const rawQ = form.get("q");
          const q = typeof rawQ === "string" ? rawQ.trim() : "";
          setFilter("q", q || undefined);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="filter-type">Tipo</Label>
          <Select
            value={filters.type}
            onValueChange={(value) => {
              setFilter("type", value);
            }}
            disabled={pending}
          >
            <SelectTrigger id="filter-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="IMAGE">Imagem</SelectItem>
              <SelectItem value="PDF">PDF</SelectItem>
              <SelectItem value="TEXT">Texto</SelectItem>
              <SelectItem value="LINK">Link</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-product">Produto</Label>
          <Select
            value={filters.productId ?? "ALL"}
            onValueChange={(value) => {
              setFilter("productId", value === "ALL" ? undefined : value);
            }}
            disabled={pending}
          >
            <SelectTrigger id="filter-product">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-q">Buscar</Label>
          <div className="flex gap-2">
            <Input
              id="filter-q"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Título ou texto"
            />
            <Button type="submit" variant="secondary" disabled={pending}>
              Filtrar
            </Button>
          </div>
        </div>
      </form>

      {materials.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title={hasFilters ? "Nenhum material neste filtro" : "Ainda não há materiais"}
          description={
            hasFilters
              ? "Tente limpar os filtros ou escolher outro produto."
              : "Quando o admin publicar peças de divulgação, elas aparecem aqui para você baixar e copiar."
          }
          action={
            hasFilters ? (
              <Link href="/painel/materiais" className={cn(buttonVariants({ variant: "outline" }))}>
                Limpar filtros
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((material) => {
            const affiliateUrl = resolveMaterialAffiliateUrl(
              affiliateCode,
              material.product?.slug,
            );
            return (
              <li
                key={material.id}
                className="flex flex-col gap-3 rounded-lg border border-mist-200 bg-white p-4"
              >
                <MaterialPreview material={material} />
                <div>
                  <h2 className="font-display text-lg text-navy-900">{material.title}</h2>
                  {material.description ? (
                    <p className="mt-1 text-sm text-navy-700">{material.description}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {labelFor("materialType", material.type)}
                    {material.product ? ` · ${material.product.name}` : " · Geral"}
                  </p>
                </div>
                <MaterialActions material={material} affiliateUrl={affiliateUrl} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MaterialPreview({ material }: { material: MaterialCard }) {
  if (material.type === "IMAGE" && material.thumbPath) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- thumb via rota autenticada
      <img
        src={`/api/materials/${material.id}/thumb`}
        alt=""
        className="aspect-[4/3] w-full rounded-md object-cover"
      />
    );
  }
  const Icon =
    material.type === "PDF"
      ? FileText
      : material.type === "LINK"
        ? ExternalLink
        : material.type === "TEXT"
          ? Link2
          : FileImage;
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-mist-100 text-navy-600">
      <Icon className="size-10" aria-hidden />
    </div>
  );
}

function MaterialActions({
  material,
  affiliateUrl,
}: {
  material: MaterialCard;
  affiliateUrl: string;
}) {
  if (material.type === "TEXT" && material.textContent) {
    const text = replaceLinkPlaceholder(material.textContent, affiliateUrl);
    return <CopyButton value={text} label="Copiar texto" successMessage="Texto copiado" />;
  }

  if (material.type === "LINK" && material.externalUrl) {
    return (
      <a
        href={material.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "outline" }), "inline-flex gap-2")}
      >
        <ExternalLink className="size-4" aria-hidden />
        Abrir link
      </a>
    );
  }

  if (material.type === "IMAGE" || material.type === "PDF") {
    return (
      <a
        href={`/api/materials/${material.id}/download`}
        className={cn(buttonVariants(), "inline-flex gap-2")}
      >
        <Download className="size-4" aria-hidden />
        Baixar
      </a>
    );
  }

  return null;
}
