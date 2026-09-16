import type { Metadata } from "next";
import { Link2 } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ShareLinkCard } from "@/components/forms/share-link-card";
import { PageHeader } from "@/components/layout/page-header";
import { ProductMaterialsSnippet } from "@/features/materials/components/product-materials-snippet";
import { listMaterialsForProduct } from "@/features/materials/queries";
import {
  replaceLinkPlaceholder,
  resolveMaterialAffiliateUrl,
} from "@/features/materials/text";
import { buildAffiliateUrl, listActiveProductsForLinks } from "@/features/tracking/links";
import { requireAffiliate } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Links" };

export default async function AffiliateLinksPage() {
  const session = await requireAffiliate("/painel/links");

  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { code: true },
  });

  const code = affiliate?.code;
  if (!code) {
    return (
      <>
        <PageHeader
          title="Seus links"
          description="Compartilhe o link geral ou o de cada produto."
        />
        <EmptyState
          icon={Link2}
          title="Código ainda não disponível"
          description="Assim que sua conta for aprovada, seus links de afiliado aparecem aqui."
        />
      </>
    );
  }

  const products = await listActiveProductsForLinks();
  const generalUrl = buildAffiliateUrl(code);

  const materialsByProduct = await Promise.all(
    products.map(async (product) => {
      const materials = await listMaterialsForProduct(product.id, 3);
      const total = await db.material.count({
        where: { productId: product.id, isActive: true },
      });
      const textMaterial = materials.find((m) => m.type === "TEXT" && m.textContent);
      const shareText = textMaterial?.textContent
        ? replaceLinkPlaceholder(
            textMaterial.textContent,
            resolveMaterialAffiliateUrl(code, product.slug),
          )
        : product.shareText;
      return { productId: product.id, materials, total, shareText };
    }),
  );

  const materialsMap = new Map(materialsByProduct.map((row) => [row.productId, row]));

  return (
    <>
      <PageHeader
        title="Seus links"
        description="Copie, gere o QR ou envie pelo WhatsApp. Cada acesso conta como clique."
      />

      <div className="flex flex-col gap-6">
        <ShareLinkCard
          title="Link geral (vitrine)"
          description="Leva o visitante à vitrine com sua atribuição."
          url={generalUrl}
          qrFileName={`link-${code}.png`}
          shareText="Conheça os serviços e materiais do Affiliate Tool"
        />

        {products.length === 0 ? (
          <EmptyState
            icon={Link2}
            title="Nenhum produto publicado"
            description="Quando houver produtos ativos, os links individuais aparecem aqui."
          />
        ) : (
          <section className="flex flex-col gap-4">
            <h2 className="font-display text-xl text-navy-900">Por produto</h2>
            <ul className="flex flex-col gap-4">
              {products.map((product) => {
                const linked = materialsMap.get(product.id);
                return (
                  <li key={product.id}>
                    <ShareLinkCard
                      title={product.name}
                      description={product.shortDescription}
                      url={buildAffiliateUrl(code, product.slug)}
                      qrFileName={`link-${code}-${product.slug}.png`}
                      shareText={linked?.shareText ?? product.shareText}
                    />
                    {linked ? (
                      <ProductMaterialsSnippet
                        productId={product.id}
                        productSlug={product.slug}
                        affiliateCode={code}
                        materials={linked.materials}
                        totalLinked={linked.total}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
