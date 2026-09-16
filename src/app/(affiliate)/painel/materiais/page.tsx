import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { MaterialsGallery } from "@/features/materials/components/materials-gallery";
import { listActiveMaterials, listProductsForMaterialSelect } from "@/features/materials/queries";
import { affiliateMaterialsFilterSchema } from "@/features/materials/schemas";
import type { MaterialCard } from "@/features/materials/types";
import { requireAffiliate } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Materiais" };

export default async function AffiliateMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAffiliate("/painel/materiais");
  const params = await searchParams;

  const parsed = affiliateMaterialsFilterSchema.safeParse({
    type: typeof params.type === "string" ? params.type : "ALL",
    productId: typeof params.productId === "string" ? params.productId : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
  });
  const filters = parsed.success
    ? parsed.data
    : { type: "ALL" as const, productId: undefined, q: undefined };

  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { code: true },
  });

  const [materials, products] = await Promise.all([
    listActiveMaterials(filters),
    listProductsForMaterialSelect(),
  ]);

  const cards: MaterialCard[] = materials.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    type: m.type,
    fileName: m.fileName,
    thumbPath: m.thumbPath,
    textContent: m.textContent,
    externalUrl: m.externalUrl,
    productId: m.productId,
    product: m.product,
  }));

  return (
    <>
      <PageHeader
        title="Materiais"
        description="Baixe artes e PDFs, copie textos já com o seu link e abra vídeos e páginas prontas."
      />
      <Suspense fallback={<p className="text-sm text-muted-foreground">Carregando…</p>}>
        <MaterialsGallery
          materials={cards}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          affiliateCode={affiliate?.code ?? ""}
          filters={{
            type: filters.type,
            productId: filters.productId,
            q: filters.q,
          }}
        />
      </Suspense>
    </>
  );
}
