import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  MousePointerClick,
  Receipt,
  ShoppingCart,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { KpiCard } from "@/components/data-display/kpi-card";
import { MoneyText } from "@/components/data-display/money-text";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChartLazy } from "@/features/dashboard/components/revenue-chart-lazy";
import { getAdminDashboard } from "@/features/dashboard/queries";
import { formatBRL, formatPercent } from "@/lib/money";

/** Seções do dashboard admin (Server Component). */
export async function AdminDashboard() {
  const data = await getAdminDashboard();
  const { kpis, series90d, funnel, topAffiliates, topProducts, pendencias, antifraud } = data;

  const hasRevenue = series90d.some((d) => d.revenueCents > 0 || d.commissionsCents > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão geral"
        description="Resumo do programa de afiliados e pendências que precisam de você."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vendas no mês"
          value={formatCount(kpis.salesCount.value)}
          icon={ShoppingCart}
          trend={{ value: kpis.salesCount.trendBps, label: "vs. mês anterior" }}
        />
        <KpiCard
          label="Receita no mês"
          value={formatBRL(kpis.revenueCents.value)}
          icon={CircleDollarSign}
          trend={{ value: kpis.revenueCents.trendBps, label: "vs. mês anterior" }}
        />
        <KpiCard
          label="Comissões geradas"
          value={formatBRL(kpis.commissionsGeneratedCents.value)}
          icon={Receipt}
          trend={{
            value: kpis.commissionsGeneratedCents.trendBps,
            label: "vs. mês anterior",
          }}
        />
        <KpiCard
          label="A pagar"
          value={formatBRL(kpis.commissionsPayableCents)}
          variant="gold"
          icon={Wallet}
          hint="Disponível + ajustes abertos"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">
              Receita × comissões (90 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasRevenue ? (
              <EmptyState
                title="Sem movimentação ainda"
                description="Quando houver vendas pagas, o gráfico aparece aqui."
                className="py-8"
              />
            ) : (
              <RevenueChartLazy data={series90d} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Funil (30 dias)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <FunnelStep
              icon={MousePointerClick}
              label="Cliques"
              value={formatCount(funnel.clicks)}
              hint="não-bot"
            />
            <FunnelStep
              icon={ShoppingCart}
              label="Pedidos com afiliado"
              value={formatCount(funnel.orders)}
              hint={formatPercent(funnel.clickToOrderBps) + " dos cliques"}
            />
            <FunnelStep
              icon={CircleDollarSign}
              label="Pagos com afiliado"
              value={formatCount(funnel.paid)}
              hint={formatPercent(funnel.orderToPaidBps) + " dos pedidos"}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <RankingCard title="Top afiliados (30d)" rows={topAffiliates} empty="Nenhuma venda." />
        <RankingCard title="Top produtos (30d)" rows={topProducts} empty="Nenhuma venda." />

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base font-medium">Pendências</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3 text-sm">
              <PendenciaLink
                href="/admin/afiliados?status=PENDING"
                label="Afiliados a aprovar"
                count={pendencias.pendingAffiliates}
              />
              <PendenciaLink
                href="/admin/pagamentos"
                label="Afiliados com saldo"
                count={pendencias.affiliatesWithBalance}
                extra={formatBRL(pendencias.totalAvailableCents)}
              />
              <PendenciaLink
                href="/admin/sistema?tab=webhooks&status=FAILED"
                label="Webhooks falhos"
                count={pendencias.failedWebhooks}
              />
              <PendenciaLink
                href="/admin/sistema?tab=jobs"
                label="Jobs com erro (7d)"
                count={pendencias.failedJobs7d}
              />
            </ul>
          </CardContent>
        </Card>
      </div>

      {antifraud.length > 0 ? (
        <Card className="shadow-card border-[color:var(--color-warning)]/30">
          <CardHeader className="flex flex-row items-center gap-2">
            <AlertTriangle
              className="size-4 text-[color:var(--color-warning)]"
              aria-hidden="true"
            />
            <CardTitle className="text-base font-medium">Alertas antifraude</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {antifraud.map((alert) => (
                <li key={`${alert.kind}-${alert.href}-${alert.title}`}>
                  <Link
                    href={alert.href}
                    className="block rounded-md border border-mist-300 px-3 py-2 text-sm transition-colors hover:bg-mist-100"
                  >
                    <span className="font-medium text-foreground">{alert.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {alert.detail}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FunnelStep({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-teal-800" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div data-tabular className="font-display text-2xl leading-tight">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
    </div>
  );
}

function RankingCard({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: { id: string; label: string; sublabel: string | null; revenueCents: number; href: string }[];
  empty: string;
}) {
  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {rows.map((row, index) => (
              <li key={row.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                  <Link
                    href={row.href}
                    className="font-medium text-teal-900 underline-offset-2 hover:underline"
                  >
                    {row.label}
                  </Link>
                  {row.sublabel ? (
                    <div className="truncate text-xs text-muted-foreground">{row.sublabel}</div>
                  ) : null}
                </div>
                <MoneyText cents={row.revenueCents} className="shrink-0" />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function PendenciaLink({
  href,
  label,
  count,
  extra,
}: {
  href: string;
  label: string;
  count: number;
  extra?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-mist-100"
      >
        <span className="text-foreground">{label}</span>
        <span className="shrink-0 text-right">
          <span data-tabular className="font-medium">
            {formatCount(count)}
          </span>
          {extra ? (
            <span className="ml-2 text-xs text-muted-foreground">{extra}</span>
          ) : null}
        </span>
      </Link>
    </li>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
