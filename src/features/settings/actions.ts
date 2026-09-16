"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { acceptTermsSchema, updateSettingsSchema } from "@/features/settings/schemas";
import { acceptCurrentTerms, updateSettings } from "@/features/settings/service";
import { adminAction, authedAction } from "@/lib/safe-action";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

function revalidateSettings(): void {
  revalidateTag("settings", "max");
  revalidatePath("/admin/configuracoes");
  revalidatePath("/termos");
  revalidatePath("/painel");
}

export const updateSettingsAction = adminAction({
  name: "settings.update",
  schema: updateSettingsSchema,
  async handler(input) {
    const result = await updateSettings(input);
    revalidateSettings();
    return result;
  },
  audit: (result) => ({
    action: "settings.update",
    entity: "Setting",
    entityId: "1",
    before: result.before,
    after: result.after,
  }),
});

export const acceptTermsAction = authedAction({
  name: "settings.acceptTerms",
  schema: acceptTermsSchema,
  async handler(input, ctx) {
    if (ctx.session.user.role !== "AFFILIATE") {
      throw new AppError("FORBIDDEN", "Apenas afiliados aceitam os termos.");
    }
    const affiliate = await db.affiliate.findUnique({
      where: { userId: ctx.session.user.id },
      select: { id: true, termsVersion: true },
    });
    if (!affiliate) {
      throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
    }
    const before = { termsVersion: affiliate.termsVersion };
    const result = await acceptCurrentTerms(affiliate.id, input, ctx.ip);
    revalidatePath("/painel");
    return { affiliateId: affiliate.id, ...result, before };
  },
  audit: (result) => ({
    action: "affiliate.accept_terms",
    entity: "Affiliate",
    entityId: result.affiliateId,
    before: result.before,
    after: { termsVersion: result.termsVersion },
  }),
});
