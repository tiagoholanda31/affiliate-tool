import type { Metadata } from "next";

import { PageHeader } from "@/components/layout/page-header";
import { MaterialsAdminClient } from "@/features/materials/components/materials-admin-client";
import type { MaterialFormInitial } from "@/features/materials/components/material-form";
import {
  getMaterialsForAdmin,
  listProductsForMaterialSelect,
} from "@/features/materials/queries";
import { getMaterialById } from "@/features/materials/service";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Materiais" };

export default async function AdminMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/materiais");
  const params = await searchParams;

  const typeRaw = typeof params.type === "string" ? params.type : "ALL";
  const type =
    typeRaw === "IMAGE" ||
    typeRaw === "PDF" ||
    typeRaw === "TEXT" ||
    typeRaw === "LINK" ||
    typeRaw === "ALL"
      ? typeRaw
      : "ALL";

  const result = await getMaterialsForAdmin({
    type,
    active:
      params.active === "true" || params.active === "false" ? params.active : "ALL",
    productId: typeof params.productId === "string" ? params.productId : undefined,
    q: typeof params.q === "string" ? params.q : undefined,
    page: typeof params.page === "string" ? Number(params.page) : undefined,
  });

  const products = await listProductsForMaterialSelect();

  const details: Record<string, MaterialFormInitial> = {};
  await Promise.all(
    result.items.map(async (item) => {
      const full = await getMaterialById(item.id);
      if (!full) return;
      details[item.id] = {
        id: full.id,
        title: full.title,
        description: full.description,
        type: full.type,
        productId: full.productId,
        isActive: full.isActive,
        sortOrder: full.sortOrder,
        textContent: full.textContent,
        externalUrl: full.externalUrl,
        filePath: full.filePath,
        fileName: full.fileName,
        mimeType: full.mimeType,
        sizeBytes: full.sizeBytes,
        thumbPath: full.thumbPath,
      };
    }),
  );

  return (
    <>
      <PageHeader
        title="Materiais de divulgação"
        description="Imagens, PDFs, textos com {{link}} e links externos para os afiliados."
      />
      <MaterialsAdminClient items={result.items} products={products} details={details} />
    </>
  );
}
