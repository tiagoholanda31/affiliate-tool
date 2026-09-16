import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { UserMenu } from "@/components/layout/user-menu";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { PATHNAME_HEADER } from "@/proxy";

/**
 * Painel do afiliado.
 *
 * `requireAffiliate` roda aqui, a cada render: exige sessão, confere o papel e
 * aplica as regras por status (PENDING só vê `/painel/aguardando`, etc.).
 * O proxy apenas barra quem não tem cookie — a decisão de verdade é esta, e ela
 * consulta o banco (docs/spec/02, Convenções; docs/spec/04, Autorização).
 */
export default async function AffiliateLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? AFFILIATE_ROUTES.home;
  const session = await requireAffiliate(pathname);

  return (
    <AppShell
      variant="affiliate"
      // Quem não está aprovado só alcança a própria tela de situação e o perfil.
      hideNav={session.affiliate.status !== "APPROVED"}
      headerRight={
        <UserMenu
          name={session.user.name}
          email={session.user.email}
          profileHref={AFFILIATE_ROUTES.profile}
        />
      }
    >
      {children}
    </AppShell>
  );
}
