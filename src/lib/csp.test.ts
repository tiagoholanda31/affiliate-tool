import { describe, expect, it } from "vitest";

import { buildContentSecurityPolicy } from "@/lib/csp";

describe("buildContentSecurityPolicy", () => {
  it("inclui nonce e strict-dynamic em produção, sem unsafe-eval/unsafe-inline em script", () => {
    const csp = buildContentSecurityPolicy("abc123", { isDev: false });

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(csp).toContain("connect-src 'self' https://api.pagar.me");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("libera unsafe-eval só em desenvolvimento", () => {
    const csp = buildContentSecurityPolicy("devnonce", { isDev: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).toContain("'nonce-devnonce'");
  });
});
