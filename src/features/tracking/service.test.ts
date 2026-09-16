import { describe, expect, it } from "vitest";

import { isBotUserAgent, BOT_UA_FRAGMENTS } from "@/features/tracking/bots";
import { computeIsUnique, dailySalt, shouldTrackAffiliate } from "@/features/tracking/service";

describe("bots", () => {
  it("lista curta cobre curl e Googlebot", () => {
    expect(BOT_UA_FRAGMENTS).toContain("curl/");
    expect(BOT_UA_FRAGMENTS).toContain("googlebot");
    expect(isBotUserAgent("curl/7.88")).toBe(true);
    expect(isBotUserAgent("Googlebot")).toBe(true);
  });
});

describe("shouldTrackAffiliate", () => {
  it("só APPROVED rastreia", () => {
    expect(shouldTrackAffiliate("APPROVED")).toBe(true);
    expect(shouldTrackAffiliate("PENDING")).toBe(false);
    expect(shouldTrackAffiliate("SUSPENDED")).toBe(false);
  });
});

describe("computeIsUnique / dailySalt", () => {
  it("único só quando não houve clique recente", () => {
    expect(computeIsUnique(false)).toBe(true);
    expect(computeIsUnique(true)).toBe(false);
  });

  it("salt diário é estável no mesmo dia SP", () => {
    const secret = "x".repeat(40);
    const a = dailySalt(new Date("2026-09-05T10:00:00-03:00"), secret);
    const b = dailySalt(new Date("2026-09-05T23:59:00-03:00"), secret);
    const c = dailySalt(new Date("2026-09-06T00:01:00-03:00"), secret);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
