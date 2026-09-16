"use server";

import { revalidatePath, updateTag } from "next/cache";

import {
  anonymizeAffiliate as anonymizeAffiliateService,
  revealPixKey as revealPixKeyService,
  transitionAffiliate,
  updateAffiliateCode as updateAffiliateCodeService,
  type TransitionEmailEvent,
} from "@/features/affiliates/admin-service";
import {
  anonymizeAffiliateSchema,
  approveAffiliateSchema,
  bulkApproveAffiliatesSchema,
  reactivateAffiliateSchema,
  rejectAffiliateSchema,
  removeAffiliateSchema,
  revealPixKeySchema,
  suspendAffiliateSchema,
  updateAffiliateCodeSchema,
} from "@/features/affiliates/admin-schemas";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { labelFor } from "@/lib/i18n/pt-BR";
import { sendMail } from "@/lib/mail";
import { adminAction } from "@/lib/safe-action";
import { getSupportWhatsapp } from "@/lib/settings";

/** Envia o e-mail pós-transição, fora da transação do banco. */
async function sendStatusEmail(event: TransitionEmailEvent): Promise<void> {
  const supportWhatsapp = await getSupportWhatsapp();
  await sendMail({
    to: event.to,
    template: event.template,
    props: { ...event.props, supportWhatsapp },
  });
}

export const approveAffiliate = adminAction({
  name: "affiliate.approve",
  schema: approveAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return transitionAffiliate(input.affiliateId, "APPROVED", { actorId: session.user.id }, tx);
    });

    await sendStatusEmail(result.emailEvent);

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId, code: result.code };
  },
  audit: (result, input) => ({
    action: "affiliate.approve",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { status: "APPROVED", code: result.code },
  }),
});

export const rejectAffiliate = adminAction({
  name: "affiliate.reject",
  schema: rejectAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return transitionAffiliate(input.affiliateId, "REJECTED", {
        reason: input.reason,
        actorId: session.user.id,
      }, tx);
    });

    await sendStatusEmail(result.emailEvent);

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId };
  },
  audit: (result, input) => ({
    action: "affiliate.reject",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { status: "REJECTED", reason: input.reason },
  }),
});

export const suspendAffiliate = adminAction({
  name: "affiliate.suspend",
  schema: suspendAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return transitionAffiliate(input.affiliateId, "SUSPENDED", {
        reason: input.reason,
        actorId: session.user.id,
      }, tx);
    });

    await sendStatusEmail(result.emailEvent);

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId };
  },
  audit: (result, input) => ({
    action: "affiliate.suspend",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { status: "SUSPENDED", reason: input.reason },
  }),
});

export const reactivateAffiliate = adminAction({
  name: "affiliate.reactivate",
  schema: reactivateAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return transitionAffiliate(input.affiliateId, "APPROVED", { actorId: session.user.id }, tx);
    });

    await sendStatusEmail(result.emailEvent);

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId };
  },
  audit: (result, input) => ({
    action: "affiliate.reactivate",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { status: "APPROVED" },
  }),
});

export const removeAffiliate = adminAction({
  name: "affiliate.remove",
  schema: removeAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return transitionAffiliate(input.affiliateId, "REMOVED", {
        reason: input.reason,
        actorId: session.user.id,
      }, tx);
    });

    await sendStatusEmail(result.emailEvent);

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId };
  },
  audit: (result, input) => ({
    action: "affiliate.remove",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { status: "REMOVED", reason: input.reason },
  }),
});

export const bulkApproveAffiliates = adminAction({
  name: "affiliate.bulkApprove",
  schema: bulkApproveAffiliatesSchema,
  async handler(input, { session }) {
    let processed = 0;
    let failed = 0;

    for (const affiliateId of input.ids) {
      try {
        const result = await db.$transaction(async (tx) => {
          return transitionAffiliate(affiliateId, "APPROVED", { actorId: session.user.id }, tx);
        });
        await sendStatusEmail(result.emailEvent);
        processed += 1;
      } catch (error) {
        // Continua com os demais; detalhe em log.
        if (error instanceof AppError && error.code === "NOT_FOUND") {
          failed += 1;
        } else {
          failed += 1;
        }
      }
    }

    revalidatePath("/admin/afiliados", "layout");

    return { processed, failed };
  },
});

export const revealPixKey = adminAction({
  name: "pix.reveal",
  schema: revealPixKeySchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return revealPixKeyService(input.affiliateId, session.user.id, tx);
    });

    return {
      affiliateId: result.affiliateId,
      pixKey: result.pixKey,
      pixKeyTypeLabel: labelFor("pixKeyType", result.pixKeyType),
    };
  },
});

export const updateAffiliateCode = adminAction({
  name: "affiliate.updateCode",
  schema: updateAffiliateCodeSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return updateAffiliateCodeService(input.affiliateId, input.code, session.user.id, tx);
    });

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId, newCode: result.newCode };
  },
  audit: (result, input) => ({
    action: "affiliate.code_change",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { code: result.newCode },
  }),
});

export const anonymizeAffiliate = adminAction({
  name: "affiliate.anonymize",
  schema: anonymizeAffiliateSchema,
  async handler(input, { session }) {
    const result = await db.$transaction(async (tx) => {
      return anonymizeAffiliateService(input.affiliateId, session.user.id, tx);
    });

    revalidatePath("/admin/afiliados", "layout");
    revalidatePath(`/admin/afiliados/${input.affiliateId}`, "page");
    updateTag(`affiliate-${input.affiliateId}`);

    return { affiliateId: result.affiliateId, anonymizedAt: result.anonymizedAt.toISOString() };
  },
  audit: (result, input) => ({
    action: "affiliate.anonymize",
    entity: "Affiliate",
    entityId: input.affiliateId,
    after: { anonymizedAt: result.anonymizedAt },
  }),
});
