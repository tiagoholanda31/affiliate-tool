import { afterEach, describe, expect, it, vi } from "vitest";

import { REF_COOKIE_NAME, readRef, signRef } from "@/lib/attribution";
import { isBotUserAgent } from "@/features/tracking/bots";
import {
  computeIsUnique,
  dailySalt,
  hashIp,
} from "@/features/tracking/service";

describe("signRef / readRef", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trip assina e lê o payload", async () => {
    const token = await signRef({ a: "aff_1", c: "clk_1" }, 30);
    const payload = await readRef(token);
    expect(payload).toEqual({ a: "aff_1", c: "clk_1" });
  });

  it("aceita store de cookies", async () => {
    const token = await signRef({ a: "aff_2", c: "clk_2" }, 7);
    const store = {
      get: (name: string) => (name === REF_COOKIE_NAME ? { value: token } : undefined),
    };
    expect(await readRef(store)).toEqual({ a: "aff_2", c: "clk_2" });
  });

  it("assinatura inválida → null", async () => {
    const token = await signRef({ a: "aff_1", c: "clk_1" }, 30);
    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(await readRef(tampered)).toBeNull();
  });

  it("token expirado → null", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    const token = await signRef({ a: "aff_1", c: "clk_1" }, 1);
    vi.setSystemTime(new Date("2026-01-05T12:00:00Z"));
    expect(await readRef(token)).toBeNull();
  });

  it("cookie ausente → null", async () => {
    expect(await readRef(null)).toBeNull();
    expect(await readRef(undefined)).toBeNull();
    expect(await readRef("")).toBeNull();
  });
});

describe("isBotUserAgent", () => {
  it("detecta bots conhecidos", () => {
    expect(isBotUserAgent("curl/8.0")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("python-requests/2.28")).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });

  it("não marca browsers reais", () => {
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      ),
    ).toBe(false);
  });
});

describe("isUnique + salt diário", () => {
  it("computeIsUnique inverte a existência recente", () => {
    expect(computeIsUnique(false)).toBe(true);
    expect(computeIsUnique(true)).toBe(false);
  });

  it("dailySalt muda com o dia e é estável no mesmo dia", () => {
    const secret = "test-secret-at-least-32-characters!!";
    const morning = new Date("2026-09-05T06:00:00-03:00");
    const evening = new Date("2026-09-05T22:00:00-03:00");
    const nextDay = new Date("2026-09-06T01:00:00-03:00");

    expect(dailySalt(morning, secret)).toBe(dailySalt(evening, secret));
    expect(dailySalt(morning, secret)).not.toBe(dailySalt(nextDay, secret));
  });

  it("hashIp depende do salt do dia", () => {
    const day1 = new Date("2026-09-05T12:00:00-03:00");
    const day2 = new Date("2026-09-06T12:00:00-03:00");
    expect(hashIp("203.0.113.10", day1)).not.toBe(hashIp("203.0.113.10", day2));
    expect(hashIp("203.0.113.10", day1)).toBe(hashIp("203.0.113.10", day1));
  });
});
