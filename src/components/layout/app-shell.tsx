import Link from "next/link";
import type { ReactNode } from "react";

import {
  AdminSidebarNav,
  AffiliateBottomNav,
  AffiliateSidebarNav,
} from "@/components/layout/app-nav";
import { Brand } from "@/components/layout/brand";
import { currentYear } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  /**
   * `public` — vitrine, produto, checkout: header mínimo e footer com selo de
   * pagamento seguro.
   * `affiliate` — bottom nav no celular, sidebar no desktop, largura máx. 1200 px.
   * `admin` — sidebar navy fixa de 260 px, desktop-first.
   */
  variant: "public" | "affiliate" | "admin";
  children: ReactNode;
  /** Conteúdo à direita do header (avatar, sino de pendências, busca). */
  headerRight?: ReactNode;
  /**
   * Esconde a navegação do painel. Usado com afiliado em análise, reprovado ou
   * suspenso: os destinos do menu são bloqueados para ele, e um menu que só
   * devolve a pessoa para a mesma tela é pior do que menu nenhum.
   */
  hideNav?: boolean;
  className?: string;
};

export function AppShell({ variant, children, headerRight, hideNav, className }: AppShellProps) {
  if (variant === "admin") return <AdminShell headerRight={headerRight}>{children}</AdminShell>;
  if (variant === "affiliate") {
    return (
      <AffiliateShell headerRight={headerRight} hideNav={hideNav}>
        {children}
      </AffiliateShell>
    );
  }
  return (
    <PublicShell headerRight={headerRight} className={className}>
      {children}
    </PublicShell>
  );
}

/** Link que aparece ao primeiro Tab, para pular direto ao conteúdo. */
function SkipToContent() {
  return (
    <a
      href="#conteudo"
      className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-navy-900 focus:shadow-card"
    >
      Pular para o conteúdo
    </a>
  );
}

function PublicShell({
  children,
  headerRight,
  className,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-mist-100">
      <SkipToContent />

      <header className="bg-navy-900">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Brand tone="light" />
          {headerRight}
        </div>
      </header>

      <main
        id="conteudo"
        className={cn("mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-6", className)}
      >
        {children}
      </main>

      <footer className="border-t border-mist-300 bg-white">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {currentYear()} Affiliate Tool</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/termos" className="hover:text-navy-900">
              Termos
            </Link>
            <Link href="/privacidade" className="hover:text-navy-900">
              Privacidade
            </Link>
            <span className="text-xs">Pagamento seguro via Pagar.me</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function AffiliateShell({
  children,
  headerRight,
  hideNav,
}: {
  children: ReactNode;
  headerRight?: ReactNode;
  hideNav?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-mist-100">
      <SkipToContent />

      <header className="sticky top-0 z-30 border-b border-mist-300 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Brand href="/painel" />
          {headerRight}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1200px] gap-8 px-4 sm:px-6">
        {hideNav ? null : (
          <aside className="hidden w-56 shrink-0 py-8 md:block">
            <AffiliateSidebarNav />
          </aside>
        )}

        {/* pb-20 no celular reserva espaço para a bottom nav fixa. */}
        <main
          id="conteudo"
          className={cn("min-w-0 flex-1 py-8", hideNav ? "pb-8" : "pb-20 md:pb-8")}
        >
          {children}
        </main>
      </div>

      {hideNav ? null : <AffiliateBottomNav />}
    </div>
  );
}

function AdminShell({ children, headerRight }: { children: ReactNode; headerRight?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-mist-100">
      <SkipToContent />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col gap-8 bg-navy-900 px-4 py-6 lg:flex">
        <Brand tone="light" href="/admin" />
        <AdminSidebarNav />
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 border-b border-mist-300 bg-white">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="lg:hidden">
              <Brand href="/admin" />
            </div>
            <div className="ml-auto flex items-center gap-3">{headerRight}</div>
          </div>
        </header>

        <main id="conteudo" className="px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
