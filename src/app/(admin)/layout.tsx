import { headers } from "next/headers";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { CommandMenu } from "@/components/layout/command-menu";
import { PendingBell } from "@/components/layout/pending-bell";
import { UserMenu } from "@/components/layout/user-menu";
import { requireAdmin } from "@/lib/auth";
import { PATHNAME_HEADER } from "@/proxy";

/**
 * Área administrativa.
 *
 * `requireAdmin` roda a cada render: sem sessão vai para `/entrar` guardando o
 * destino; com sessão de afiliado, volta para `/painel`. O proxy só filtra quem
 * não tem cookie — quem decide papel é este layout.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get(PATHNAME_HEADER) ?? "/admin";
  const session = await requireAdmin(pathname);

  return (
    <AppShell
      variant="admin"
      headerRight={
        <>
          <CommandMenu />
          <PendingBell />
          <UserMenu name={session.user.name} email={session.user.email} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
