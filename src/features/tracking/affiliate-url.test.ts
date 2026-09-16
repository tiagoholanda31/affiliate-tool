import { describe, expect, it } from "vitest";

import { buildAffiliateUrl } from "@/features/tracking/affiliate-url";

describe("buildAffiliateUrl", () => {
  it("monta o link geral e o de produto", () => {
    expect(buildAffiliateUrl("abc12")).toMatch(/\/r\/abc12$/);
    expect(buildAffiliateUrl("abc12", "consulta-avaliacao")).toMatch(
      /\/r\/abc12\/consulta-avaliacao$/,
    );
  });
});
