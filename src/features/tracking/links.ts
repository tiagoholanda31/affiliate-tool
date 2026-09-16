/**
 * Produtos ativos para a página de links do afiliado.
 */
import { db } from "@/lib/db";

export { buildAffiliateUrl } from "@/features/tracking/affiliate-url";

export type AffiliateLinkProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  type: "SERVICE" | "DIGITAL";
  /** Texto curto sugerido para WhatsApp (fallback se não houver material TEXT). */
  shareText: string;
};

export async function listActiveProductsForLinks(): Promise<AffiliateLinkProduct[]> {
  const products = await db.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      type: true,
    },
  });

  return products.map((product) => ({
    ...product,
    shareText: buildShareText(product.name),
  }));
}

function buildShareText(productName: string): string {
  return `Olha este material: ${productName}`;
}
