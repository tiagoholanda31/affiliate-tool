/**
 * Efeitos pós-pagamento / estorno: comissão, grant digital, e-mails de venda e n8n.
 */
import type { Commission, DownloadGrant, Order } from "@/generated/prisma/client";

import {
  createCommissionForOrder,
  reverseCommission,
} from "@/features/commissions/service";
import { createGrant, revokeGrantsForOrder } from "@/features/delivery/service";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { formatBRL } from "@/lib/money";
import { getSettings, getSupportWhatsapp } from "@/lib/settings";
import { logger } from "@/lib/logger";
import { emit } from "@/server/n8n";

export type OrderPaidResult = {
  commission: Commission | null;
  download: { grant: DownloadGrant; token: string } | null;
};

export type OrderHook = (order: Order) => Promise<OrderPaidResult | undefined>;

export const onOrderPaid: OrderHook = async (order) => {
  const product = await db.product.findUnique({
    where: { id: order.productId },
    select: {
      type: true,
      digitalFile: { select: { id: true } },
    },
  });

  const { commission, download } = await db.$transaction(async (tx) => {
    const commissionRow = await createCommissionForOrder(order, tx);
    let downloadResult: { grant: DownloadGrant; token: string } | null = null;
    if (product?.type === "DIGITAL" && product.digitalFile) {
      downloadResult = await createGrant(order.id, tx);
    }
    return { commission: commissionRow, download: downloadResult };
  });

  const supportWhatsapp = await getSupportWhatsapp();
  const settings = await getSettings();
  const affiliate = order.affiliateId
    ? await db.affiliate.findUnique({
        where: { id: order.affiliateId },
        select: {
          id: true,
          code: true,
          user: { select: { name: true, email: true } },
        },
      })
    : null;

  const amountLabel = formatBRL(order.amountCents);
  const commissionLabel = commission ? formatBRL(commission.amountCents) : undefined;
  const affiliateLabel = affiliate?.code
    ? `@${affiliate.code}`
    : affiliate?.user.name ?? "Sem afiliado";
  const sourceLabel = order.source === "MANUAL" ? "Manual" : "Checkout";
  const orderAdminUrl = `${APP_URL}/admin/vendas/${order.id}`;

  if (affiliate && commission) {
    const commissionLabelSafe = formatBRL(commission.amountCents);
    await sendMail({
      to: affiliate.user.email,
      template: "sale-affiliate",
      props: {
        affiliateName: affiliate.user.name.split(" ")[0] ?? affiliate.user.name,
        productName: order.productNameSnap,
        amountLabel,
        commissionLabel: commissionLabelSafe,
        availableAtLabel: formatDate(commission.availableAt),
        publicCode: order.publicCode,
        panelUrl: `${APP_URL}/painel/vendas`,
        supportWhatsapp,
      },
    });
  }

  if (settings.adminNotifyEmail) {
    await sendMail({
      to: settings.adminNotifyEmail,
      template: "sale-admin",
      props: {
        publicCode: order.publicCode,
        productName: order.productNameSnap,
        amountLabel,
        commissionLabel,
        affiliateLabel,
        sourceLabel,
        orderUrl: orderAdminUrl,
      },
    });
  }

  await emit("order.paid", {
    orderId: order.id,
    publicCode: order.publicCode,
    amountCents: order.amountCents,
    affiliateId: order.affiliateId,
    commissionCents: commission?.amountCents ?? null,
    source: order.source,
  });

  if (order.source === "MANUAL") {
    await emit("order.manual_created", {
      orderId: order.id,
      publicCode: order.publicCode,
      amountCents: order.amountCents,
      affiliateId: order.affiliateId,
    });
  }

  return { commission, download };
};

export const onOrderReversed: OrderHook = async (order) => {
  const reason =
    order.status === "CHARGEDBACK" ? "Chargeback do pedido" : "Estorno do pedido";

  const { commission, adjustment } = await db.$transaction(async (tx) => {
    await revokeGrantsForOrder(order.id, tx);
    return reverseCommission(order, reason, tx, "system");
  });

  const supportWhatsapp = await getSupportWhatsapp();
  const settings = await getSettings();
  const amountLabel = formatBRL(order.amountCents);
  const commissionLabel = commission ? formatBRL(commission.amountCents) : undefined;
  const orderAdminUrl = `${APP_URL}/admin/vendas/${order.id}`;

  await sendMail({
    to: order.customerEmail,
    template: "order-refunded-buyer",
    props: {
      customerName: order.customerName,
      publicCode: order.publicCode,
      productName: order.productNameSnap,
      amountLabel,
      supportWhatsapp,
    },
  });

  if (order.affiliateId && commission) {
    const affiliate = await db.affiliate.findUnique({
      where: { id: order.affiliateId },
      select: { code: true, user: { select: { name: true, email: true } } },
    });
    if (affiliate) {
      await sendMail({
        to: affiliate.user.email,
        template: "order-refunded-affiliate",
        props: {
          affiliateName: affiliate.user.name.split(" ")[0] ?? affiliate.user.name,
          publicCode: order.publicCode,
          productName: order.productNameSnap,
          commissionLabel: commissionLabel ?? formatBRL(0),
          supportWhatsapp,
        },
      });
    }

    if (settings.adminNotifyEmail) {
      await sendMail({
        to: settings.adminNotifyEmail,
        template: "order-refunded-admin",
        props: {
          publicCode: order.publicCode,
          productName: order.productNameSnap,
          amountLabel,
          affiliateLabel: affiliate?.code ? `@${affiliate.code}` : "—",
          orderUrl: orderAdminUrl,
        },
      });
    }
  } else if (settings.adminNotifyEmail) {
    await sendMail({
      to: settings.adminNotifyEmail,
      template: "order-refunded-admin",
      props: {
        publicCode: order.publicCode,
        productName: order.productNameSnap,
        amountLabel,
        affiliateLabel: "Sem afiliado",
        orderUrl: orderAdminUrl,
      },
    });
  }

  if (adjustment) {
    logger.info(
      {
        orderId: order.id,
        adjustmentId: adjustment.id,
        amountCents: adjustment.amountCents,
      },
      "Ajuste negativo criado por estorno de comissão já paga",
    );
  }

  await emit("order.refunded", {
    orderId: order.id,
    publicCode: order.publicCode,
    status: order.status,
    affiliateId: order.affiliateId,
    commissionId: commission?.id ?? null,
    adjustmentId: adjustment?.id ?? null,
  });

  return undefined;
};
