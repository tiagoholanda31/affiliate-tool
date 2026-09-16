import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Timeline } from "@/components/data-display/timeline";
import { PageHeader } from "@/components/layout/page-header";
import { AdminDeliverySection } from "@/features/delivery/components/admin-delivery-section";
import { listGrantsForOrder } from "@/features/delivery/service";
import { RefundOrderButton } from "@/features/orders/components/refund-order-button";
import { getAdminOrderDetail } from "@/features/orders/queries";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { labelFor } from "@/lib/i18n/pt-BR";
import { maskEmail } from "@/lib/crypto";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const detail = await getAdminOrderDetail(id);
  return { title: detail ? `Pedido ${detail.order.publicCode}` : "Pedido" };
}

function toneFor(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "FAILED":
    case "EXPIRED":
    case "CHARGEDBACK":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default async function AdminVendaDetailPage({ params }: PageProps) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getAdminOrderDetail(id);
  if (!detail) notFound();

  const { order, webhooks } = detail;
  const grants =
    order.product.type === "DIGITAL" ? await listGrantsForOrder(order.id) : [];
  const meta =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};

  const timeline = [
    {
      id: "created",
      label: "Criado",
      at: formatDateTime(order.createdAt),
      done: true,
    },
    {
      id: "paid",
      label: "Pago",
      at: order.paidAt ? formatDateTime(order.paidAt) : undefined,
      done: Boolean(order.paidAt),
      active: order.status === "PAID",
    },
    ...(order.status === "FAILED"
      ? [
          {
            id: "failed",
            label: `Falhou${order.failureReason ? `: ${order.failureReason}` : ""}`,
            at: formatDateTime(order.updatedAt),
            done: true,
            active: true,
          },
        ]
      : []),
    ...(order.status === "EXPIRED"
      ? [{ id: "expired", label: "Expirado", at: formatDateTime(order.updatedAt), done: true, active: true }]
      : []),
    ...(order.refundedAt
      ? [
          {
            id: "refunded",
            label: order.status === "CHARGEDBACK" ? "Chargeback" : "Estornado",
            at: formatDateTime(order.refundedAt),
            done: true,
            active: true,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title={order.publicCode}
        description={order.productNameSnap}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge label={labelFor("orderStatus", order.status)} tone={toneFor(order.status)} />
            {order.status === "PAID" && order.gatewayChargeId ? (
              <RefundOrderButton orderId={order.id} />
            ) : null}
            {typeof meta.refundRequestedAt === "string" && order.status === "PAID" ? (
              <span className="text-sm text-muted-foreground">Estorno solicitado</span>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3 rounded-lg border border-mist-200 bg-white p-5">
          <h2 className="font-display text-lg text-navy-900">Resumo</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Valor</dt>
              <dd>
                <MoneyText cents={order.amountCents} />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Método</dt>
              <dd>{labelFor("paymentMethod", order.paymentMethod)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Parcelas</dt>
              <dd>{order.installments}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{order.source}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Produto</dt>
              <dd>
                <Link href={`/admin/produtos/${order.productId}`} className="text-teal-700 hover:underline">
                  {order.product.name}
                </Link>
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 rounded-lg border border-mist-200 bg-white p-5">
          <h2 className="font-display text-lg text-navy-900">Comprador</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{order.customerName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd>{maskEmail(order.customerEmail)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Documento</dt>
              <dd>{order.customerDocMasked ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Afiliado</dt>
              <dd>
                {order.affiliate ? (
                  <Link
                    href={`/admin/afiliados/${order.affiliate.id}`}
                    className="text-teal-700 hover:underline"
                  >
                    {order.affiliate.code} · {order.affiliate.user.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 rounded-lg border border-mist-200 bg-white p-5">
          <h2 className="font-display text-lg text-navy-900">Timeline</h2>
          <Timeline items={timeline} />
        </section>

        <section className="space-y-3 rounded-lg border border-mist-200 bg-white p-5">
          <h2 className="font-display text-lg text-navy-900">Gateway</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Order ID</dt>
              <dd className="font-mono text-xs">{order.gatewayOrderId ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Charge ID</dt>
              <dd className="font-mono text-xs">{order.gatewayChargeId ?? "—"}</dd>
            </div>
            {order.cardBrand ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Cartão</dt>
                <dd>
                  {order.cardBrand} ···· {order.cardLast4}
                </dd>
              </div>
            ) : null}
            {order.pixExpiresAt ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pix expira</dt>
                <dd>
                  <DateText date={order.pixExpiresAt} />
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      </div>

      {order.product.type === "DIGITAL" ? (
        <AdminDeliverySection
          orderId={order.id}
          canManage={order.status === "PAID"}
          grants={grants.map((g) => ({
            id: g.id,
            createdAt: g.createdAt,
            expiresAt: g.expiresAt,
            maxDownloads: g.maxDownloads,
            downloadCount: g.downloadCount,
            lastDownloadAt: g.lastDownloadAt,
            revokedAt: g.revokedAt,
          }))}
        />
      ) : null}

      <section className="space-y-3 rounded-lg border border-mist-200 bg-white p-5">
        <h2 className="font-display text-lg text-navy-900">Webhooks relacionados</h2>
        {webhooks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ul className="divide-y divide-mist-100 text-sm">
            {webhooks.map((wh) => (
              <li key={wh.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{wh.type}</span>
                <StatusBadge
                  label={wh.status}
                  tone={
                    wh.status === "PROCESSED"
                      ? "success"
                      : wh.status === "FAILED"
                        ? "danger"
                        : "neutral"
                  }
                />
                <span className="text-xs text-muted-foreground">
                  <DateText date={wh.receivedAt} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p>
        <Link href="/admin/vendas" className="text-sm text-teal-700 hover:underline">
          ← Voltar às vendas
        </Link>
      </p>
    </div>
  );
}
