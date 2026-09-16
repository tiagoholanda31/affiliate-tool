"use server";

import { globalSearchSchema } from "@/features/search/schemas";
import { globalSearch } from "@/features/search/service";
import { adminAction } from "@/lib/safe-action";

export const globalSearchAction = adminAction({
  name: "search.global",
  schema: globalSearchSchema,
  async handler(input, ctx) {
    return globalSearch(input.q, ctx.session.user.role);
  },
});
