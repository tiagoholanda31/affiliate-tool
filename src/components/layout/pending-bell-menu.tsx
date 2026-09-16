"use client";

import Link from "next/link";
import { Bell } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminPendingSummary } from "@/features/system/pending";
import { formatBRL } from "@/lib/money";

export type PendingBellMenuProps = {
  summary: AdminPendingSummary;
};

type PendingRow = {
  key: string;
  label: string;
  detail: string;
  href: string;
  count: number;
};

/**
 * Dropdown do sino: lista categorias com contagem e link.
 */
export function PendingBellMenu({ summary }: PendingBellMenuProps) {
  const rows: PendingRow[] = [];

  if (summary.pendingAffiliates > 0) {
    rows.push({
      key: "affiliates",
      label: "Afiliados pendentes",
      detail: `${String(summary.pendingAffiliates)} cadastro${summary.pendingAffiliates === 1 ? "" : "s"}`,
      href: "/admin/afiliados?status=PENDING",
      count: summary.pendingAffiliates,
    });
  }

  if (summary.showPayout && summary.payoutAffiliates > 0) {
    rows.push({
      key: "payouts",
      label: "A pagar",
      detail: `${String(summary.payoutAffiliates)} afiliado${summary.payoutAffiliates === 1 ? "" : "s"} · ${formatBRL(summary.payoutCents)}`,
      href: "/admin/pagamentos",
      count: summary.payoutAffiliates,
    });
  }

  if (summary.failedWebhooks > 0) {
    rows.push({
      key: "webhooks",
      label: "Webhooks falhos",
      detail: `${String(summary.failedWebhooks)} evento${summary.failedWebhooks === 1 ? "" : "s"}`,
      href: "/admin/sistema?tab=webhooks",
      count: summary.failedWebhooks,
    });
  }

  if (summary.failedJobs > 0) {
    rows.push({
      key: "jobs",
      label: "Jobs com erro",
      detail: `${String(summary.failedJobs)} nas últimas 48 h`,
      href: "/admin/sistema?tab=jobs",
      count: summary.failedJobs,
    });
  }

  const total = summary.total;
  const ariaLabel =
    rows.length > 0
      ? rows.map((r) => `${r.label}: ${r.detail}`).join("; ")
      : "Nenhuma pendência";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative flex size-9 items-center justify-center rounded-md text-navy-700 transition-colors hover:bg-mist-100 hover:text-navy-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40"
          aria-label={ariaLabel}
          title={ariaLabel}
        >
          <Bell className="size-5" aria-hidden="true" />
          {total > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
              {total > 99 ? "99+" : total}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-navy-900">Pendências</p>
          <p className="text-xs text-muted-foreground">
            {total === 0
              ? "Tudo em dia."
              : `${String(total)} item${total === 1 ? "" : "s"} para revisar`}
          </p>
        </DropdownMenuLabel>

        {rows.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            {rows.map((row) => (
              <DropdownMenuItem key={row.key} asChild>
                <Link href={row.href} className="flex cursor-pointer items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{row.label}</span>
                    <span className="block text-xs text-muted-foreground">{row.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-mist-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-navy-800">
                    {row.count > 99 ? "99+" : row.count}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
