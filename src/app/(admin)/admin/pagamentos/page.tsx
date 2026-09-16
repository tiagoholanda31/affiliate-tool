import type { Metadata } from "next";
import Link from "next/link";

import { GeneratePayoutButton } from "@/features/payouts/components/generate-payout-button";
import {
  getPayoutDashboardSummary,
  listAffiliatesPayable,
  listPayouts,
} from "@/features/payouts/queries";
import { DateText } from "@/components/data-display/date-text";
import { KpiCard } from "@/components/data-display/kpi-card";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { labelFor } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Pagamentos" };

type SearchParams = Promise<{
  tab?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
}>;

export default async function AdminPagamentosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = sp.tab === "pagos" ? "pagos" : sp.tab === "rascunhos" ? "rascunhos" : "a-pagar";
  const page = Number(sp.page ?? "1") || 1;

  const [summary, payable, drafts, paid] = await Promise.all([
    getPayoutDashboardSummary(),
    listAffiliatesPayable(),
    listPayouts({ status: "DRAFT", from: sp.from, to: sp.to, page, pageSize: 25 }),
    listPayouts({ status: "PAID", from: sp.from, to: sp.to, page, pageSize: 25 }),
  ]);

  const exportQs = new URLSearchParams();
  if (sp.from) exportQs.set("from", sp.from);
  if (sp.to) exportQs.set("to", sp.to);
  if (tab === "rascunhos") exportQs.set("status", "DRAFT");
  if (tab === "pagos") exportQs.set("status", "PAID");
  const exportBase = `/api/admin/export/pagamentos?${exportQs.toString()}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pagamentos"
        description="Gere lotes a partir das comissões disponíveis e registre o Pix manual."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`${exportBase}&format=csv`}>CSV</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`${exportBase}&format=xlsx`}>XLSX</a>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="A pagar este mês"
          value={formatBRL(summary.totalAvailableCents)}
          variant="gold"
          hint={`${String(summary.affiliatesWithBalance)} afiliado${summary.affiliatesWithBalance === 1 ? "" : "s"}`}
        />
        <KpiCard label="Rascunhos abertos" value={String(summary.draftsCount)} />
        <KpiCard
          label="Afiliados com saldo"
          value={String(summary.affiliatesWithBalance)}
          hint="Disponível > 0"
        />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-mist-300 pb-2">
        {(
          [
            ["a-pagar", "A pagar"],
            ["rascunhos", "Rascunhos"],
            ["pagos", "Pagos"],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={tab === value ? "default" : "ghost"}
          >
            <Link href={`/admin/pagamentos?tab=${value}`}>{label}</Link>
          </Button>
        ))}
      </div>

      {tab === "a-pagar" ? (
        payable.length === 0 ? (
          <EmptyState
            title="Nada a pagar agora"
            description="Quando houver comissões disponíveis, os afiliados aparecem aqui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Afiliado</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Disponível</TableHead>
                <TableHead className="text-right">Ajustes</TableHead>
                <TableHead>Último pagamento</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payable.map((row) => (
                <TableRow key={row.affiliateId}>
                  <TableCell>
                    <Link
                      href={`/admin/afiliados/${row.affiliateId}?tab=pagamentos`}
                      className="text-teal-700 hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>{row.code ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <MoneyText cents={row.availableCents} />
                  </TableCell>
                  <TableCell className="text-right">
                    <MoneyText cents={row.openAdjustmentsCents} showSign />
                  </TableCell>
                  <TableCell>
                    {row.lastPaidAt ? <DateText date={row.lastPaidAt} /> : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <GeneratePayoutButton affiliateId={row.affiliateId} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )
      ) : null}

      {tab === "rascunhos" ? (
        <PayoutsTable items={drafts.items} emptyTitle="Nenhum rascunho" />
      ) : null}

      {tab === "pagos" ? (
        <PayoutsTable items={paid.items} emptyTitle="Nenhum pagamento registrado" />
      ) : null}
    </div>
  );
}

function PayoutsTable({
  items,
  emptyTitle,
}: {
  items: Awaited<ReturnType<typeof listPayouts>>["items"];
  emptyTitle: string;
}) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description="Os lotes desta aba aparecem aqui." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Afiliado</TableHead>
          <TableHead>Mês</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Comissões</TableHead>
          <TableHead>Criado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((p) => (
          <TableRow key={p.id}>
            <TableCell>
              <Link
                href={`/admin/pagamentos/${p.id}`}
                className="text-teal-700 hover:underline"
              >
                {p.affiliate.name}
              </Link>
              <span className="ml-2 text-xs text-muted-foreground">
                {p.affiliate.code ?? ""}
              </span>
            </TableCell>
            <TableCell>{p.referenceMonth}</TableCell>
            <TableCell>
              <StatusBadge
                label={labelFor("payoutStatus", p.status)}
                tone={p.status === "PAID" ? "success" : "info"}
              />
            </TableCell>
            <TableCell className="text-right">
              <MoneyText cents={p.totalCents} />
            </TableCell>
            <TableCell>
              {p.commissionCount}
              {p.adjustmentCount > 0 ? ` (+${String(p.adjustmentCount)} aj.)` : ""}
            </TableCell>
            <TableCell>
              <DateText date={p.createdAt} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
