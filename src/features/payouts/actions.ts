"use server";

import { revalidatePath } from "next/cache";

import { notifyPayoutPaid } from "@/features/payouts/notify";
import {
  buildPayoutDraftSchema,
  createManualAdjustmentSchema,
  discardDraftSchema,
  markPayoutPaidSchema,
  removeCommissionFromDraftSchema,
} from "@/features/payouts/schemas";
import {
  buildPayoutDraft,
  createManualAdjustment,
  discardDraft,
  markPayoutPaid,
  removeCommissionFromDraft,
} from "@/features/payouts/service";
import { db } from "@/lib/db";
import { adminAction } from "@/lib/safe-action";

function revalidatePayoutPaths(affiliateId?: string) {
  revalidatePath("/admin/pagamentos");
  revalidatePath("/admin/comissoes");
  revalidatePath("/painel/comissoes");
  revalidatePath("/painel");
  if (affiliateId) {
    revalidatePath(`/admin/afiliados/${affiliateId}`);
    revalidatePath(`/admin/pagamentos`);
  }
}

export const buildPayoutDraftAction = adminAction({
  name: "payout.draft",
  schema: buildPayoutDraftSchema,
  handler: async (input, ctx) => {
    const payout = await db.$transaction((tx) =>
      buildPayoutDraft(
        input.affiliateId,
        {
          commissionIds: input.commissionIds,
          referenceMonth: input.referenceMonth,
        },
        ctx.session.user.id,
        tx,
      ),
    );
    revalidatePayoutPaths(input.affiliateId);
    return { payoutId: payout.id, totalCents: payout.totalCents };
  },
  audit: (result, input) => ({
    action: "payout.draft",
    entity: "Payout",
    entityId: result.payoutId,
    after: {
      affiliateId: input.affiliateId,
      totalCents: result.totalCents,
    },
  }),
});

export const markPayoutPaidAction = adminAction({
  name: "payout.pay",
  schema: markPayoutPaidSchema,
  handler: async (input) => {
    const payout = await db.$transaction((tx) =>
      markPayoutPaid(
        input.payoutId,
        {
          paidAt: input.paidAt,
          proofReference: input.proofReference,
          proofPath: input.proofPath,
          notes: input.notes,
        },
        tx,
      ),
    );
    revalidatePayoutPaths(payout.affiliateId);
    revalidatePath(`/admin/pagamentos/${payout.id}`);
    // E-mail/n8n após commit da transação.
    void notifyPayoutPaid(payout.id);
    return {
      payoutId: payout.id,
      affiliateId: payout.affiliateId,
      totalCents: payout.totalCents,
    };
  },
  audit: (result, input) => ({
    action: "payout.pay",
    entity: "Payout",
    entityId: result.payoutId,
    after: {
      totalCents: result.totalCents,
      paidAt: input.paidAt.toISOString(),
      hasProofReference: Boolean(input.proofReference),
      hasProofPath: Boolean(input.proofPath),
    },
  }),
});

export const discardDraftAction = adminAction({
  name: "payout.discard",
  schema: discardDraftSchema,
  handler: async (input) => {
    const existing = await db.payout.findUnique({
      where: { id: input.payoutId },
      select: { affiliateId: true, status: true },
    });
    await db.$transaction((tx) => discardDraft(input.payoutId, tx));
    revalidatePayoutPaths(existing?.affiliateId);
    return { payoutId: input.payoutId };
  },
  audit: (_result, input) => ({
    action: "payout.discard",
    entity: "Payout",
    entityId: input.payoutId,
    after: { discarded: true },
  }),
});

export const removeCommissionFromDraftAction = adminAction({
  name: "payout.remove_commission",
  schema: removeCommissionFromDraftSchema,
  handler: async (input) => {
    const payout = await db.$transaction((tx) =>
      removeCommissionFromDraft(input.payoutId, input.commissionId, tx),
    );
    revalidatePayoutPaths(payout.affiliateId);
    revalidatePath(`/admin/pagamentos/${payout.id}`);
    return { payoutId: payout.id, totalCents: payout.totalCents };
  },
  audit: (result, input) => ({
    action: "payout.remove_commission",
    entity: "Payout",
    entityId: result.payoutId,
    after: { commissionId: input.commissionId, totalCents: result.totalCents },
  }),
});

export const createManualAdjustmentAction = adminAction({
  name: "adjustment.create",
  schema: createManualAdjustmentSchema,
  handler: async (input, ctx) => {
    const adjustment = await createManualAdjustment(
      input.affiliateId,
      input.amountCents,
      input.reason,
      ctx.session.user.id,
    );
    revalidatePayoutPaths(input.affiliateId);
    return { adjustmentId: adjustment.id, amountCents: adjustment.amountCents };
  },
  audit: (result, input) => ({
    action: "adjustment.create",
    entity: "CommissionAdjustment",
    entityId: result.adjustmentId,
    after: {
      affiliateId: input.affiliateId,
      amountCents: result.amountCents,
      reason: input.reason,
    },
  }),
});
