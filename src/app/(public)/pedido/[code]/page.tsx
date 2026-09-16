import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RequestOrderLinkForm } from "@/features/delivery/components/request-order-link-form";
import { getActiveGrantSummary } from "@/features/delivery/service";
import { OrderStatusView } from "@/features/orders/components/order-status-view";
import { findOrderByPublicCode, getOrderForBuyer } from "@/features/orders/queries";
import { formatDate } from "@/lib/dates";
import { AppError } from "@/lib/errors";

type PageProps = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ t?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Pedido ${code}`, robots: { index: false, follow: false } };
}

export default async function PedidoPage({ params, searchParams }: PageProps) {
  const { code } = await params;
  const { t } = await searchParams;

  if (!t) {
    const exists = await findOrderByPublicCode(code);
    if (!exists) notFound();
    return <RequestOrderLinkForm publicCode={code} />;
  }

  let order;
  try {
    order = await getOrderForBuyer(code, t);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      const exists = await findOrderByPublicCode(code);
      if (!exists) notFound();
      return <RequestOrderLinkForm publicCode={code} />;
    }
    throw error;
  }

  const meta =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};

  const grant =
    order.status === "PAID" && order.product.type === "DIGITAL"
      ? await getActiveGrantSummary(order.id)
      : null;

  const downloadToken =
    grant?.token ??
    (typeof meta.activeDownloadToken === "string" ? meta.activeDownloadToken : null);

  return (
    <OrderStatusView
      publicCode={order.publicCode}
      accessToken={t}
      initialStatus={order.status}
      productName={order.productNameSnap}
      productSlug={order.product.slug}
      amountCents={order.amountCents}
      paymentMethod={order.paymentMethod}
      failureReason={order.failureReason}
      deliveryNote={order.product.deliveryNote}
      productType={order.product.type}
      pixQrCode={order.pixQrCode}
      pixExpiresAt={order.pixExpiresAt?.toISOString() ?? null}
      refundRequested={typeof meta.refundRequestedAt === "string"}
      downloadUrl={downloadToken ? `/download/${encodeURIComponent(downloadToken)}` : null}
      downloadExpiresAtLabel={grant ? formatDate(grant.expiresAt) : null}
      downloadRemaining={grant?.remaining ?? null}
      downloadMax={grant?.maxDownloads ?? null}
    />
  );
}
