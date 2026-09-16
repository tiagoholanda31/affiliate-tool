"use client";

import Link from "next/link";
import { Download, ExternalLink, FileText, Link2 } from "lucide-react";

import { CopyButton } from "@/components/forms/copy-button";
import { buttonVariants } from "@/components/ui/button";
import {
  replaceLinkPlaceholder,
  resolveMaterialAffiliateUrl,
} from "@/features/materials/text";
import type { MaterialTypeValue } from "@/features/materials/types";
import { labelFor } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export type ProductMaterialSnippet = {
  id: string;
  title: string;
  type: MaterialTypeValue;
  textContent: string | null;
  externalUrl: string | null;
};

type ProductMaterialsSnippetProps = {
  productId: string;
  productSlug: string;
  affiliateCode: string;
  materials: ProductMaterialSnippet[];
  totalLinked: number;
};

/**
 * Até 3 materiais sob o card do produto em `/painel/links`.
 */
export function ProductMaterialsSnippet({
  productId,
  productSlug,
  affiliateCode,
  materials,
  totalLinked,
}: ProductMaterialsSnippetProps) {
  if (materials.length === 0) return null;

  const affiliateUrl = resolveMaterialAffiliateUrl(affiliateCode, productSlug);

  return (
    <div className="mt-3 rounded-md border border-mist-200 bg-mist-50/60 px-3 py-2">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-navy-700">
        Materiais
      </p>
      <ul className="flex flex-col gap-2">
        {materials.map((material) => (
          <li
            key={material.id}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span className="text-navy-900">
              {material.title}
              <span className="ml-1 text-xs text-muted-foreground">
                ({labelFor("materialType", material.type)})
              </span>
            </span>
            <SnippetAction material={material} affiliateUrl={affiliateUrl} />
          </li>
        ))}
      </ul>
      {totalLinked > materials.length ? (
        <Link
          href={`/painel/materiais?productId=${productId}`}
          className="mt-2 inline-block text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
        >
          Ver todos ({totalLinked})
        </Link>
      ) : null}
    </div>
  );
}

function SnippetAction({
  material,
  affiliateUrl,
}: {
  material: ProductMaterialSnippet;
  affiliateUrl: string;
}) {
  if (material.type === "TEXT" && material.textContent) {
    return (
      <CopyButton
        value={replaceLinkPlaceholder(material.textContent, affiliateUrl)}
        label="Copiar"
        successMessage="Texto copiado"
        size="sm"
      />
    );
  }
  if (material.type === "LINK" && material.externalUrl) {
    return (
      <a
        href={material.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        <ExternalLink className="size-3.5" aria-hidden />
        Abrir
      </a>
    );
  }
  if (material.type === "IMAGE" || material.type === "PDF") {
    return (
      <a
        href={`/api/materials/${material.id}/download`}
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
      >
        {material.type === "PDF" ? (
          <FileText className="size-3.5" aria-hidden />
        ) : (
          <Download className="size-3.5" aria-hidden />
        )}
        Baixar
      </a>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Link2 className="size-3.5" aria-hidden />
    </span>
  );
}
