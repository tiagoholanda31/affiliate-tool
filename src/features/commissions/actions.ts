"use server";

import { revalidatePath } from "next/cache";

import {
  createManualOrder,
  previewManualOrder,
  searchAffiliatesForManual,
} from "@/features/commissions/manual";
import {
  createManualOrderSchema,
  previewManualCommissionSchema,
} from "@/features/commissions/schemas";
import { adminAction } from "@/lib/safe-action";
import { z } from "zod";

export const createManualOrderAction = adminAction({
  name: "order.manual_create",
  schema: createManualOrderSchema,
  handler: async (input, ctx) => {
    const result = await createManualOrder(input, ctx.session.user.id);
    revalidatePath("/admin/vendas");
    revalidatePath("/admin/comissoes");
    if (input.affiliateId) {
      revalidatePath(`/admin/afiliados/${input.affiliateId}`);
      revalidatePath("/painel");
      revalidatePath("/painel/vendas");
      revalidatePath("/painel/comissoes");
    }
    return result;
  },
  audit: (result, input) => ({
    action: "order.manual_create",
    entity: "Order",
    entityId: result.orderId,
    after: {
      publicCode: result.publicCode,
      amountCents: input.amountCents,
      affiliateId: input.affiliateId ?? null,
      productId: input.productId,
    },
  }),
});

export const previewManualCommissionAction = adminAction({
  name: "order.manual_preview",
  schema: previewManualCommissionSchema,
  handler: async (input) => previewManualOrder(input),
});

export const searchAffiliatesAction = adminAction({
  name: "order.manual_search_affiliates",
  schema: z.object({ q: z.string().trim().min(0).max(120) }),
  handler: async ({ q }) => searchAffiliatesForManual(q),
});
