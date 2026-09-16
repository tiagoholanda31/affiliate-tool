import Link from "next/link";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";

/** Área pública: vitrine, página de produto, checkout, status do pedido. */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      variant="public"
      headerRight={
        <Link
          href="/entrar"
          className="rounded-md px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
        >
          Área do afiliado
        </Link>
      }
    >
      {children}
    </AppShell>
  );
}
