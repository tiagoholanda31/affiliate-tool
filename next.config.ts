import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

function actionAllowedOrigins(): string[] {
  const origins = new Set<string>(["affiliates.example.com", "localhost:3000"]);
  const appUrl = process.env.APP_URL;
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).host);
    } catch {
      // APP_URL inválida no build — os defaults bastam.
    }
  }
  return [...origins];
}

/**
 * Headers estáticos (não dependem de nonce por request).
 *
 * CSP mora no `proxy.ts`: nonce precisa ser único por request e o Next o lê do
 * header da requisição para carimbar os scripts que injeta.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
  },
  // HSTS preload-ready. Inofensivo em localhost (http); o Traefik serve HTTPS.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Imagem Docker enxuta: só o necessário para rodar (docs/spec/08).
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,

  // Imagens são locais (uploads servidos por Route Handler), sem domínios externos.
  images: { remotePatterns: [] },

  experimental: {
    serverActions: {
      bodySizeLimit: "60mb",
      ...(process.env.NODE_ENV === "production"
        ? { allowedOrigins: actionAllowedOrigins() }
        : {}),
    },
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

export default withBundleAnalyzer(nextConfig);
