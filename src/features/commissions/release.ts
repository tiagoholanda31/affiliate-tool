/**
 * Job diário: libera comissões vencidas e envia digest por afiliado.
 */
import { releaseDueCommissions, getBalances } from "@/features/commissions/service";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { APP_URL } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { formatBRL, sumCents } from "@/lib/money";
import { getSupportWhatsapp } from "@/lib/settings";
import { emit } from "@/server/n8n";

export type ReleaseCommissionsSummary = {
  releasedCount: number;
  releasedCents: number;
  digestsSent: number;
  affiliateIds: string[];
};

export async function runReleaseCommissions(
  now: Date = new Date(),
): Promise<ReleaseCommissionsSummary> {
  const released = await releaseDueCommissions(db, now);
  const releasedCents = sumCents(released.map((c) => c.amountCents));

  if (released.length === 0) {
    return { releasedCount: 0, releasedCents: 0, digestsSent: 0, affiliateIds: [] };
  }

  const byAffiliate = new Map<string, typeof released>();
  for (const c of released) {
    const list = byAffiliate.get(c.affiliateId) ?? [];
    list.push(c);
    byAffiliate.set(c.affiliateId, list);
  }

  const supportWhatsapp = await getSupportWhatsapp();
  let digestsSent = 0;

  for (const [affiliateId, commissions] of byAffiliate) {
    const affiliate = await db.affiliate.findUnique({
      where: { id: affiliateId },
      select: { user: { select: { name: true, email: true } } },
    });
    if (!affiliate) continue;

    const total = sumCents(commissions.map((c) => c.amountCents));
    const balances = await getBalances(affiliateId, db, now);

    await sendMail({
      to: affiliate.user.email,
      template: "commissions-available-digest",
      props: {
        affiliateName: affiliate.user.name.split(" ")[0] ?? affiliate.user.name,
        releasedCount: commissions.length,
        releasedTotalLabel: formatBRL(total),
        nextPayoutLabel: formatDate(balances.nextPayoutDate),
        panelUrl: `${APP_URL}/painel/comissoes`,
        supportWhatsapp,
      },
    });
    digestsSent += 1;

    await emit("commission.available", {
      affiliateId,
      count: commissions.length,
      totalCents: total,
      commissionIds: commissions.map((c) => c.id),
    });
  }

  return {
    releasedCount: released.length,
    releasedCents,
    digestsSent,
    affiliateIds: [...byAffiliate.keys()],
  };
}
