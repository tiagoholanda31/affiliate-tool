/**
 * Gera slug URL-safe a partir de texto em português.
 * Remove acentos, baixa caixa, troca espaços/pontuação por hífen.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}
