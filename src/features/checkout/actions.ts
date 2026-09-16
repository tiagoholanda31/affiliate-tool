"use server";

import { createCheckoutOrder } from "@/features/checkout/service";
import { createCheckoutOrderSchema } from "@/features/checkout/schemas";
import { publicAction } from "@/lib/safe-action";

export const createCheckoutOrderAction = publicAction({
  name: "checkout.create",
  schema: createCheckoutOrderSchema,
  handler: async (input, ctx) => createCheckoutOrder(input, ctx.ip),
});
