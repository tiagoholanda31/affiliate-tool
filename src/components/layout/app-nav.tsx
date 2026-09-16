"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ADMIN_NAV, AFFILIATE_NAV, isNavItemActive } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const EXACT_ROOTS = ["/painel", "/admin"];

/** Sidebar do afiliado (desktop). No celular, quem navega é a `AffiliateBottomNav`. */
export function AffiliateSidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-1">
      {AFFILIATE_NAV.map((item) => {
        const active = isNavItemActive(pathname, item.href, EXACT_ROOTS);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-navy-900 text-white"
                : "text-navy-700 hover:bg-mist-100 hover:text-navy-900",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Barra inferior do afiliado no celular — o afiliado usa o painel majoritariamente
 * pelo telefone (docs/spec/05, seção Layout).
 */
export function AffiliateBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-mist-300 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {AFFILIATE_NAV.map((item) => {
          const active = isNavItemActive(pathname, item.href, EXACT_ROOTS);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium",
                  active ? "text-navy-900" : "text-navy-700/70",
                )}
              >
                <Icon className={cn("size-5", active && "text-teal-700")} aria-hidden="true" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Sidebar do admin: 260 px fixos, agrupada por área. */
export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-6">
      {ADMIN_NAV.map((group, index) => (
        <div key={group.title ?? `grupo-${String(index)}`} className="flex flex-col gap-1">
          {group.title ? (
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-mist-300 uppercase">
              {group.title}
            </p>
          ) : null}

          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item.href, EXACT_ROOTS);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-navy-800 text-white"
                    : "text-mist-300 hover:bg-navy-800/60 hover:text-white",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
