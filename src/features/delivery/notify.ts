/**
 * E-mails de entrega digital (download-link e helpers).
 */
import { formatDate } from "@/lib/dates";
import { APP_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { getSupportWhatsapp } from "@/lib/settings";

export async function sendDownloadLinkEmail(input: {
  customerEmail: string;
  customerName: string;
  publicCode: string;
  productName: string;
  token: string;
  expiresAt: Date;
  maxDownloads: number;
}): Promise<void> {
  const supportWhatsapp = await getSupportWhatsapp();
  await sendMail({
    to: input.customerEmail,
    template: "download-link",
    props: {
      customerName: input.customerName,
      publicCode: input.publicCode,
      productName: input.productName,
      downloadUrl: `${APP_URL}/download/${encodeURIComponent(input.token)}`,
      expiresAtLabel: formatDate(input.expiresAt),
      maxDownloads: input.maxDownloads,
      orderUrl: `${APP_URL}/pedido/${input.publicCode}`,
      supportWhatsapp,
    },
  });
}

export async function sendOrderAccessLinkEmail(input: {
  customerEmail: string;
  customerName: string;
  publicCode: string;
  productName: string;
  accessToken: string;
}): Promise<void> {
  const supportWhatsapp = await getSupportWhatsapp();
  await sendMail({
    to: input.customerEmail,
    template: "download-link",
    props: {
      customerName: input.customerName,
      publicCode: input.publicCode,
      productName: input.productName,
      downloadUrl: `${APP_URL}/pedido/${input.publicCode}?t=${encodeURIComponent(input.accessToken)}`,
      expiresAtLabel: "conforme o pedido",
      maxDownloads: 0,
      orderUrl: `${APP_URL}/pedido/${input.publicCode}`,
      isOrderAccess: true,
      supportWhatsapp,
    },
  });
}
