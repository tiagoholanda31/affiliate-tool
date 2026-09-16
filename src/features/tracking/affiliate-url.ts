/**
 * Montagem do URL de afiliado — puro, seguro para Client Components.
 * Não importar `links.ts` daqui: aquele arquivo acessa o banco.
 */
import { APP_URL } from "@/lib/env";

export function buildAffiliateUrl(code: string, slug?: string): string {
  const base = APP_URL.replace(/\/$/, "");
  if (slug) return `${base}/r/${code}/${slug}`;
  return `${base}/r/${code}`;
}
