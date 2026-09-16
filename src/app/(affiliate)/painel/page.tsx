import Link from "next/link";
import {
  Lightbulb,
  MousePointerClick,
  Percent,
  ShoppingCart,
  Wallet,
} from "lucide-react";

import { DateText } from "@/components/data-display/date-text";
import { EmptyState } from "@/components/feedback/empty-state";
import { KpiCard } from "@/components/data-display/kpi-card";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { getAffiliateSalesDashboard } from "@/features/commissions/queries";
import { TermsBanner } from "@/features/settings/components/terms-banner";
import { ClicksChartLazy } from "@/features/tracking/components/clicks-chart-lazy";
import { getAffiliateClickDashboard } from "@/features/tracking/queries";
import { requireAffiliate } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";
import { labelFor } from "@/lib/i18n/pt-BR";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Painel" };

/**
 * Início do afiliado aprovado: cliques + vendas/comissões (fatia 06).
 */
export default async function AffiliateDashboardPage() {
  const session = await requireAffiliate(AFFILIATE_ROUTES.home);
  const firstName = session.user.name.split(" ")[0] ?? session.user.name;

  const affiliate = await db.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, termsVersion: true },
  });

  if (!affiliate) {
    return (
      <>
        <PageHeader title={`Olá, ${firstName}`} />
        <EmptyState title="Perfil incompleto" description="Não encontramos seus dados de afiliado." />
      </>
    );
  }

  const [clickDash, salesDash, settings] = await Promise.all([
    getAffiliateClickDashboard(affiliate.id),
    getAffiliateSalesDashboard(affiliate.id),
    getSettings(),
  ]);
  const { kpis, byDay } = clickDash;
  const { sales30d, conversionRate, balances, recentOrders } = salesDash;
  const needsTermsAccept = affiliate.termsVersion !== settings.termsVersion;

  return (
    <>
      <PageHeader
        title={`Olá, ${firstName}`}
        description="Seus cliques, vendas e comissões aparecem aqui."
      />

      {needsTermsAccept ? <TermsBanner termsVersion={settings.termsVersion} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Vendas (30 dias)"
          value={formatCount(sales30d)}
          icon={ShoppingCart}
        />
        <KpiCard
          label="Conversão"
          value={`${conversionRate.toLocaleString("pt-BR")}%`}
          icon={Percent}
          hint="vendas / cliques únicos (30d)"
        />
        <KpiCard
          label="Pendente"
          value={formatBRL(balances.pendingCents)}
          hint="Em carência"
        />
        <KpiCard
          label="Disponível"
          value={formatBRL(balances.availableCents)}
          variant="gold"
          icon={Wallet}
          hint={`Próximo pagamento: ${formatDate(balances.nextPayoutDate)}`}
        />
        <KpiCard
          label="Cliques (30 dias)"
          value={formatCount(kpis.last30d)}
          icon={MousePointerClick}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Cliques por dia (30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            {kpis.last30d === 0 ? (
              <EmptyState
                title="Nenhum clique ainda"
                description="Compartilhe seus links para começar a acompanhar o tráfego."
                className="py-8"
              />
            ) : (
              <ClicksChartLazy data={byDay} />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-medium">Últimas vendas</CardTitle>
            <Link
              href="/painel/vendas"
              className="text-xs text-teal-800 underline-offset-2 hover:underline"
            >
              Ver todas
            </Link>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ainda não há vendas.{" "}
                <Link href="/painel/links" className="text-teal-800 underline-offset-2 hover:underline">
                  Ver links
                </Link>
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {recentOrders.map((order) => (
                  <li key={order.id} className="flex items-start justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{order.productNameSnap}</div>
                      <DateText
                        date={order.paidAt ?? order.createdAt}
                        className="text-xs text-muted-foreground"
                      />
                    </div>
                    <div className="shrink-0 text-right">
                      {order.commission ? (
                        <>
                          <MoneyText cents={order.commission.amountCents} />
                          <div className="mt-0.5">
                            <StatusBadge
                              label={labelFor("commissionStatus", order.commission.status)}
                              tone={
                                order.commission.status === "PENDING" ? "warning" : "success"
                              }
                              hint={
                                order.commission.status === "PENDING"
                                  ? `Libera em ${formatDate(order.commission.availableAt)}`
                                  : undefined
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <MoneyText cents={order.amountCents} />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              <Link href="/painel/comissoes" className="text-teal-800 underline-offset-2 hover:underline">
                Ver extrato de comissões
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader className="flex flex-row items-center gap-2">
          <Lightbulb className="size-5 text-gold-700" aria-hidden="true" />
          <CardTitle className="text-base font-medium">Como ganhar mais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-navy-700">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Compartilhe seus links rastreáveis com frequência nas redes que você já usa.</li>
            <li>Use os textos e artes prontos — eles já vêm com o tom da marca.</li>
            <li>Combine post + stories + mensagem direta; quem vê mais de uma vez converte mais.</li>
          </ul>
          <div className="flex flex-wrap gap-4 pt-1">
            <Link
              href="/painel/materiais"
              className="font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              Ver materiais
            </Link>
            <Link
              href="/painel/links"
              className="font-medium text-teal-800 underline-offset-2 hover:underline"
            >
              Meus links
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}
