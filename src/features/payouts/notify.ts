/**
 * Notificações pós-pagamento de lote (e-mail + n8n). Fire-and-forget seguro.
 */
import { formatDate, formatMonthYear, startOfDayInSaoPaulo } from "@/lib/dates";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { formatBRL } from "@/lib/money";
import { getSupportWhatsapp } from "@/lib/settings";
import { logger } from "@/lib/logger";
import { emit } from "@/server/n8n";

function monthLabelFromReference(referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-").map(Number);
  if (!y || !m) return referenceMonth;
  const date = startOfDayInSaoPaulo(y, m, 1);
  return formatMonthYear(date);
}

/** Envia e-mail `payout-paid` e evento n8n após commit. */
export async function notifyPayoutPaid(payoutId: string): Promise<void> {
  try {
    const payout = await db.payout.findUnique({
      where: { id: payoutId },
      include: {
        affiliate: { select: { user: { select: { name: true, email: true } } } },
        commissions: {
          select: {
            amountCents: true,
            order: { select: { publicCode: true, product: { select: { name: true } } } },
          },
          orderBy: { availableAt: "asc" },
        },
        adjustments: { select: { amountCents: true, reason: true } },
      },
    });
    if (!payout?.paidAt || payout.status !== "PAID") return;

    const supportWhatsapp = await getSupportWhatsapp();
    const firstName =
      payout.affiliate.user.name.split(" ")[0] ?? payout.affiliate.user.name;

    const lineItems = [
      ...payout.commissions.map((c) => ({
        label: `${c.order.product.name} (${c.order.publicCode})`,
        amountLabel: formatBRL(c.amountCents),
      })),
      ...payout.adjustments.map((a) => ({
        label: a.reason,
        amountLabel: formatBRL(a.amountCents),
      })),
    ];

    await sendMail({
      to: payout.affiliate.user.email,
      template: "payout-paid",
      props: {
        affiliateName: firstName,
        totalLabel: formatBRL(payout.totalCents),
        paidAtLabel: formatDate(payout.paidAt),
        referenceMonthLabel: monthLabelFromReference(payout.referenceMonth),
        proofReference: payout.proofReference,
        hasProofFile: Boolean(payout.proofPath),
        lineItems,
        panelUrl: `${APP_URL}/painel/comissoes`,
        supportWhatsapp,
      },
    });

    await emit("payout.paid", {
      payoutId: payout.id,
      affiliateId: payout.affiliateId,
      totalCents: payout.totalCents,
      referenceMonth: payout.referenceMonth,
      paidAt: payout.paidAt.toISOString(),
      commissionCount: payout.commissions.length,
    });
  } catch (error) {
    logger.error({ err: error, payoutId }, "Falha ao notificar pagamento de lote");
  }
}
