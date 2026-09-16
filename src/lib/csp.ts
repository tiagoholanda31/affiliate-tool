/**
 * Content-Security-Policy por request, com nonce em `script-src`.
 *
 * `style-src` mantém `'unsafe-inline'`: Radix, shadcn e o runtime do Next
 * injetam estilos inline. Nonce em CSS quebraria o layout (D-029).
 * `unsafe-eval` só em desenvolvimento (Turbopack/webpack).
 */
export function buildContentSecurityPolicy(
  nonce: string,
  options: { isDev: boolean },
): string {
  const scriptSrc = options.isDev
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.pagar.me",
    "frame-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
