/**
 * Regras de domínio do afiliado — funções puras, sem banco e sem Next.
 *
 * O que estiver aqui é testado em `service.test.ts` e reutilizado tanto pelo
 * `requireAffiliate` (que decide o redirecionamento no servidor) quanto pelas
 * telas, para que a navegação e a autorização não divirjam.
 */
import type { AffiliateStatus } from "@/generated/prisma/enums";

export type { AffiliateStatus };

/** Todas as rotas do painel do afiliado citadas nas regras abaixo. */
export const AFFILIATE_ROUTES = {
  home: "/painel",
  profile: "/painel/perfil",
  pending: "/painel/aguardando",
  rejected: "/painel/reprovado",
  suspended: "/painel/suspenso",
} as const;

/**
 * A tela inicial de cada status (docs/spec/01, seção 1).
 * `REMOVED` não tem tela: a conta deixa de existir para quem tenta entrar.
 */
const HOME_BY_STATUS: Record<AffiliateStatus, string> = {
  PENDING: AFFILIATE_ROUTES.pending,
  APPROVED: AFFILIATE_ROUTES.home,
  REJECTED: AFFILIATE_ROUTES.rejected,
  SUSPENDED: AFFILIATE_ROUTES.suspended,
  REMOVED: "/entrar",
};

/**
 * O que cada status pode abrir além da própria tela inicial.
 *
 * `/painel/perfil` está liberado em todos os status que ainda logam: quem está
 * em análise precisa poder corrigir os dados, e quem foi suspenso precisa poder
 * conferir para onde o dinheiro já apurado seria enviado.
 */
const EXTRA_ROUTES_BY_STATUS: Record<AffiliateStatus, readonly string[]> = {
  PENDING: [AFFILIATE_ROUTES.profile],
  APPROVED: [],
  REJECTED: [AFFILIATE_ROUTES.profile],
  SUSPENDED: [AFFILIATE_ROUTES.profile],
  REMOVED: [],
};

export function homeRouteForStatus(status: AffiliateStatus): string {
  return HOME_BY_STATUS[status];
}

export type AffiliateAccess =
  | { allowed: true }
  /** Redireciona mantendo a sessão (o afiliado só está na tela errada). */
  | { allowed: false; redirectTo: string; signOut: false }
  /** Encerra a sessão antes de redirecionar (conta removida). */
  | { allowed: false; redirectTo: string; signOut: true };

/** `/painel/perfil/senha` conta como dentro de `/painel/perfil`. */
function matches(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Decide se um afiliado com determinado status pode ver `pathname`.
 *
 * `APPROVED` acessa tudo. Os demais status ficam presos à própria tela de
 * situação mais o perfil; qualquer outra rota do painel os devolve para lá — o
 * que também impede que um link antigo ou um `router.push` no client contorne a
 * regra, já que a checagem acontece no servidor a cada render.
 */
export function resolveAffiliateAccess(
  status: AffiliateStatus,
  pathname: string,
): AffiliateAccess {
  if (status === "REMOVED") {
    return { allowed: false, redirectTo: "/entrar?motivo=conta-removida", signOut: true };
  }

  if (status === "APPROVED") {
    // Um afiliado aprovado numa tela de situação não tem o que ver ali.
    const statusScreens = [
      AFFILIATE_ROUTES.pending,
      AFFILIATE_ROUTES.rejected,
      AFFILIATE_ROUTES.suspended,
    ];
    if (statusScreens.some((route) => matches(pathname, route))) {
      return { allowed: false, redirectTo: AFFILIATE_ROUTES.home, signOut: false };
    }
    return { allowed: true };
  }

  const allowedRoutes = [HOME_BY_STATUS[status], ...EXTRA_ROUTES_BY_STATUS[status]];
  if (allowedRoutes.some((route) => matches(pathname, route))) {
    return { allowed: true };
  }

  return { allowed: false, redirectTo: HOME_BY_STATUS[status], signOut: false };
}

/**
 * Transições permitidas do ciclo de vida (docs/spec/01, seção 1).
 * A fatia 02 é quem expõe as ações; aqui fica só a tabela, para que os dois
 * lados usem a mesma verdade.
 */
const ALLOWED_TRANSITIONS: Record<AffiliateStatus, readonly AffiliateStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "REMOVED"],
  APPROVED: ["SUSPENDED", "REMOVED"],
  // Reenvio do cadastro corrigido devolve o afiliado à fila de análise.
  REJECTED: ["PENDING", "REMOVED"],
  SUSPENDED: ["APPROVED", "REMOVED"],
  REMOVED: [],
};

export function canTransition(from: AffiliateStatus, to: AffiliateStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Tom do `StatusBadge` para cada status (docs/spec/05, item 10). */
export function toneForAffiliateStatus(
  status: AffiliateStatus,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "PENDING":
      return "warning";
    case "REJECTED":
      return "danger";
    case "SUSPENDED":
    case "REMOVED":
      return "neutral";
  }
}
