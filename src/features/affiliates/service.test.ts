import { describe, expect, it } from "vitest";

import type { AffiliateStatus } from "@/generated/prisma/enums";
import {
  AFFILIATE_ROUTES,
  canTransition,
  homeRouteForStatus,
  resolveAffiliateAccess,
  toneForAffiliateStatus,
} from "@/features/affiliates/service";

/** Toda rota que o painel do afiliado expõe hoje, para varrer a matriz inteira. */
const PANEL_ROUTES = [
  AFFILIATE_ROUTES.home,
  AFFILIATE_ROUTES.profile,
  AFFILIATE_ROUTES.pending,
  AFFILIATE_ROUTES.rejected,
  AFFILIATE_ROUTES.suspended,
  "/painel/links",
  "/painel/vendas",
  "/painel/materiais",
] as const;

describe("homeRouteForStatus", () => {
  it.each([
    ["PENDING", AFFILIATE_ROUTES.pending],
    ["APPROVED", AFFILIATE_ROUTES.home],
    ["REJECTED", AFFILIATE_ROUTES.rejected],
    ["SUSPENDED", AFFILIATE_ROUTES.suspended],
    ["REMOVED", "/entrar"],
  ] as [AffiliateStatus, string][])("%s começa em %s", (status, route) => {
    expect(homeRouteForStatus(status)).toBe(route);
  });
});

describe("resolveAffiliateAccess", () => {
  it("deixa o afiliado aprovado ir a qualquer tela de trabalho", () => {
    for (const route of ["/painel", "/painel/links", "/painel/vendas", "/painel/perfil"]) {
      expect(resolveAffiliateAccess("APPROVED", route)).toEqual({ allowed: true });
    }
  });

  it("tira o aprovado das telas de situação, que não dizem nada a ele", () => {
    expect(resolveAffiliateAccess("APPROVED", AFFILIATE_ROUTES.pending)).toEqual({
      allowed: false,
      redirectTo: AFFILIATE_ROUTES.home,
      signOut: false,
    });
  });

  it.each(["PENDING", "REJECTED", "SUSPENDED"] as AffiliateStatus[])(
    "%s só abre a própria tela de situação e o perfil",
    (status) => {
      const allowed = PANEL_ROUTES.filter(
        (route) => resolveAffiliateAccess(status, route).allowed,
      );

      expect(new Set(allowed)).toEqual(
        new Set([homeRouteForStatus(status), AFFILIATE_ROUTES.profile]),
      );
    },
  );

  it.each(["PENDING", "REJECTED", "SUSPENDED"] as AffiliateStatus[])(
    "%s que tenta o painel volta para a própria tela, mantendo a sessão",
    (status) => {
      expect(resolveAffiliateAccess(status, "/painel/links")).toEqual({
        allowed: false,
        redirectTo: homeRouteForStatus(status),
        signOut: false,
      });
    },
  );

  it("trata sub-rotas do perfil como parte do perfil", () => {
    expect(resolveAffiliateAccess("PENDING", "/painel/perfil/senha")).toEqual({ allowed: true });
  });

  it("não confunde /painel/perfilx com /painel/perfil", () => {
    expect(resolveAffiliateAccess("PENDING", "/painel/perfilx").allowed).toBe(false);
  });

  it("encerra a sessão de quem foi removido, em qualquer rota", () => {
    for (const route of PANEL_ROUTES) {
      expect(resolveAffiliateAccess("REMOVED", route)).toEqual({
        allowed: false,
        redirectTo: "/entrar?motivo=conta-removida",
        signOut: true,
      });
    }
  });
});

describe("canTransition", () => {
  it("segue o ciclo de vida da spec", () => {
    expect(canTransition("PENDING", "APPROVED")).toBe(true);
    expect(canTransition("PENDING", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "SUSPENDED")).toBe(true);
    expect(canTransition("SUSPENDED", "APPROVED")).toBe(true);
    // Reenvio do cadastro corrigido.
    expect(canTransition("REJECTED", "PENDING")).toBe(true);
  });

  it("bloqueia atalhos que a spec não prevê", () => {
    expect(canTransition("PENDING", "SUSPENDED")).toBe(false);
    expect(canTransition("REJECTED", "APPROVED")).toBe(false);
    expect(canTransition("APPROVED", "PENDING")).toBe(false);
  });

  it("REMOVED é terminal", () => {
    for (const to of ["PENDING", "APPROVED", "REJECTED", "SUSPENDED"] as AffiliateStatus[]) {
      expect(canTransition("REMOVED", to)).toBe(false);
    }
  });
});

describe("toneForAffiliateStatus", () => {
  it("usa as cores semânticas da spec 05, item 10", () => {
    expect(toneForAffiliateStatus("PENDING")).toBe("warning");
    expect(toneForAffiliateStatus("APPROVED")).toBe("success");
    expect(toneForAffiliateStatus("REJECTED")).toBe("danger");
    expect(toneForAffiliateStatus("SUSPENDED")).toBe("neutral");
  });
});
