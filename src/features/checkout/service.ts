/**
 * Criação de pedido de checkout: atribuição, preço server-side, gateway.
 */
import { cookies } from "next/headers";

import {
  extractCardData,
  extractPixData,
  transitionOrder,
} from "@/features/orders/service";
import { generatePublicCode } from "@/features/orders/public-code";
import type { CreateCheckoutOrderInput } from "@/features/checkout/schemas";
import type { Prisma } from "@/generated/prisma/client";
import { readRef } from "@/lib/attribution";
import { encrypt, hashToken, maskCpf, randomToken } from "@/lib/crypto";
import { APP_URL } from "@/lib/env";
import { AppError, rateLimited, validation } from "@/lib/errors";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/dates";
import { sendMail } from "@/lib/mail";
import { formatBRL } from "@/lib/money";
import { consume } from "@/lib/rate-limit";
import { getSupportWhatsapp } from "@/lib/settings";
import { getPagarme, mapCardDecline, mapGatewayStatus } from "@/server/pagarme";
import { PagarmeError } from "@/server/pagarme/types";
import type { PagarmeBillingAddress, PagarmeCustomer } from "@/server/pagarme/types";

const MIN_FORM_MS = 3_000;

export type CreateCheckoutResult = {
  publicCode: string;
  accessToken: string;
  redirectTo: string;
  status: string;
  failureReason?: string;
};

function toPagarmeCustomer(customer: CreateCheckoutOrderInput["customer"]): PagarmeCustomer {
  const doc = customer.document;
  const phone = customer.phone;
  return {
    name: customer.name,
    email: customer.email,
    document: doc,
    type: doc.length === 14 ? "company" : "individual",
    phones: {
      mobile_phone: {
        country_code: "55",
        area_code: phone.slice(0, 2),
        number: phone.slice(2),
      },
    },
  };
}

function toBillingAddress(
  addr: NonNullable<Extract<CreateCheckoutOrderInput, { method: "card" }>["billingAddress"]>,
): PagarmeBillingAddress {
  return {
    line_1: addr.line1,
    line_2: addr.line2,
    zip_code: addr.zipCode,
    city: addr.city,
    state: addr.state,
    country: "BR",
  };
}

async function resolveAttribution(
  customerEmail: string,
): Promise<{
  affiliateId: string | null;
  clickId: string | null;
  selfPurchaseBlocked: boolean;
}> {
  const jar = await cookies();
  const ref = await readRef(jar);
  if (!ref) {
    return { affiliateId: null, clickId: null, selfPurchaseBlocked: false };
  }

  const affiliate = await db.affiliate.findUnique({
    where: { id: ref.a },
    select: {
      id: true,
      status: true,
      user: { select: { email: true } },
    },
  });

  if (affiliate?.status !== "APPROVED") {
    return { affiliateId: null, clickId: null, selfPurchaseBlocked: false };
  }

  if (affiliate.user.email.toLowerCase() === customerEmail.toLowerCase()) {
    return { affiliateId: null, clickId: null, selfPurchaseBlocked: true };
  }

  const click = await db.click.findUnique({
    where: { id: ref.c },
    select: { id: true, affiliateId: true },
  });

  return {
    affiliateId: affiliate.id,
    clickId: click?.affiliateId === affiliate.id ? click.id : null,
    selfPurchaseBlocked: false,
  };
}

export async function createCheckoutOrder(
  input: CreateCheckoutOrderInput,
  ip: string,
): Promise<CreateCheckoutResult> {
  if (input.website) {
    throw validation("Não foi possível processar o pedido.");
  }
  if (Date.now() - input.formStartedAt < MIN_FORM_MS) {
    throw validation("Aguarde um instante e tente de novo.");
  }

  const rl = consume("checkout", ip);
  if (!rl.ok) throw rateLimited();

  const product = await db.product.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      priceCents: true,
      allowPix: true,
      allowCard: true,
      maxInstallments: true,
      type: true,
      deliveryNote: true,
    },
  });

  if (product?.status !== "ACTIVE") {
    throw new AppError("NOT_FOUND", "Produto indisponível.");
  }

  if (input.method === "pix" && !product.allowPix) {
    throw validation("Este produto não aceita Pix.");
  }
  if (input.method === "card" && !product.allowCard) {
    throw validation("Este produto não aceita cartão.");
  }
  if (input.method === "card" && input.installments > product.maxInstallments) {
    throw validation(`Máximo de ${String(product.maxInstallments)} parcela(s).`);
  }

  const amountCents = product.priceCents;
  const pixMinutes =
    (
      await db.setting.findUnique({
        where: { id: 1 },
        select: { pixExpirationMinutes: true },
      })
    )?.pixExpirationMinutes ?? 30;

  const attribution = await resolveAttribution(input.customer.email);
  const accessToken = randomToken(32);
  const publicCode = generatePublicCode();
  const customer = toPagarmeCustomer(input.customer);

  const metadata: Record<string, unknown> = {};
  if (attribution.selfPurchaseBlocked) {
    metadata.selfPurchaseBlocked = true;
  }

  const order = await db.order.create({
    data: {
      publicCode,
      accessTokenHash: hashToken(accessToken),
      source: "CHECKOUT",
      status: "PENDING",
      productId: product.id,
      productNameSnap: product.name,
      affiliateId: attribution.affiliateId,
      clickId: attribution.clickId,
      customerName: input.customer.name,
      customerEmail: input.customer.email,
      customerPhone: `+55${input.customer.phone}`,
      customerDocEnc: encrypt(input.customer.document),
      customerDocMasked:
        input.customer.document.length === 11
          ? maskCpf(input.customer.document)
          : `**.${input.customer.document.slice(2, 5)}.${input.customer.document.slice(5, 8)}/${input.customer.document.slice(8, 12)}-**`,
      amountCents,
      paymentMethod: input.method === "pix" ? "PIX" : "CREDIT_CARD",
      installments: input.method === "card" ? input.installments : 1,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  const gateway = getPagarme();
  const redirectTo = `/pedido/${publicCode}?t=${encodeURIComponent(accessToken)}`;

  try {
    if (input.method === "pix") {
      const remote = await gateway.createPixOrder({
        amountCents,
        description: product.name,
        productId: product.id,
        publicCode,
        orderId: order.id,
        affiliateId: attribution.affiliateId,
        customer,
        expiresInSeconds: pixMinutes * 60,
      });
      const pix = extractPixData(remote);
      await db.order.update({
        where: { id: order.id },
        data: {
          gatewayOrderId: remote.id,
          gatewayChargeId: pix.chargeId,
          pixQrCode: pix.qrCode,
          pixQrCodeUrl: pix.qrCodeUrl,
          pixExpiresAt: pix.expiresAt,
        },
      });

      const supportWhatsapp = await getSupportWhatsapp();
      await sendMail({
        to: input.customer.email,
        template: "order-created-pix",
        props: {
          customerName: input.customer.name,
          publicCode,
          productName: product.name,
          amountLabel: formatBRL(amountCents),
          pixCopyPaste: pix.qrCode ?? "",
          expiresAtLabel: pix.expiresAt
            ? formatDateTime(pix.expiresAt)
            : `${String(pixMinutes)} minutos`,
          orderUrl: `${APP_URL}${redirectTo}`,
          supportWhatsapp,
        },
      });

      return { publicCode, accessToken, redirectTo, status: "PENDING" };
    }

    // Cartão
    const remote = await gateway.createCardOrder({
      amountCents,
      description: product.name,
      productId: product.id,
      publicCode,
      orderId: order.id,
      affiliateId: attribution.affiliateId,
      customer,
      cardToken: input.cardToken,
      installments: input.installments,
      billingAddress: toBillingAddress(input.billingAddress),
    });

    const card = extractCardData(remote);
    await db.order.update({
      where: { id: order.id },
      data: {
        gatewayOrderId: remote.id,
        gatewayChargeId: card.chargeId,
        cardBrand: card.brand,
        cardLast4: card.last4,
      },
    });

    const gwStatus = mapGatewayStatus(remote);
    if (gwStatus === "paid") {
      const updated = await db.order.findUniqueOrThrow({ where: { id: order.id } });
      await transitionOrder(updated.id, "PAID", {
        paidAt: new Date(),
        cardBrand: card.brand,
        cardLast4: card.last4,
      });
      return { publicCode, accessToken, redirectTo, status: "PAID" };
    }

    if (gwStatus === "failed") {
      const reason = mapCardDecline(card.declineCode);
      await transitionOrder(order.id, "FAILED", {
        failureReason: reason,
        metadata: {
          ...metadata,
          gatewayDeclineCode: card.declineCode,
        } as Prisma.InputJsonValue,
      });
      return {
        publicCode,
        accessToken,
        redirectTo,
        status: "FAILED",
        failureReason: reason,
      };
    }

    // pending/processing — antifraude
    return { publicCode, accessToken, redirectTo, status: "PENDING" };
  } catch (error) {
    const message =
      error instanceof PagarmeError
        ? "Não foi possível processar o pagamento. Tente novamente ou use Pix."
        : error instanceof AppError
          ? error.message
          : "Não foi possível processar o pagamento. Tente novamente.";

    await db.order
      .update({
        where: { id: order.id },
        data: { status: "FAILED", failureReason: message },
      })
      .catch(() => undefined);

    if (error instanceof AppError) throw error;
    throw new AppError("INTERNAL", message, {
      expose: true,
      cause: error,
    });
  }
}
