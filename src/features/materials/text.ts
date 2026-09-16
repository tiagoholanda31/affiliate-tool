/**
 * Substituição de `{{link}}` e montagem do URL do afiliado (puro, sem DB).
 */
import { buildAffiliateUrl } from "@/features/tracking/affiliate-url";

const LINK_PLACEHOLDER = /\{\{\s*link\s*\}\}/gi;

/** Substitui `{{link}}` pelo URL do afiliado. */
export function replaceLinkPlaceholder(text: string, affiliateUrl: string): string {
  return text.replace(LINK_PLACEHOLDER, affiliateUrl);
}

/** Monta o URL a usar na substituição (produto vinculado ou geral). */
export function resolveMaterialAffiliateUrl(
  affiliateCode: string,
  productSlug: string | null | undefined,
): string {
  if (productSlug) return buildAffiliateUrl(affiliateCode, productSlug);
  return buildAffiliateUrl(affiliateCode);
}
