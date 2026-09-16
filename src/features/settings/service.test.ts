import { describe, expect, it } from "vitest";

import { updateSettingsSchema } from "@/features/settings/schemas";
import {
  assertSettingsLimits,
  requiresNewTermsVersion,
} from "@/features/settings/service";

const validBase = {
  holdDays: 7,
  payoutDay: 10,
  attributionDays: 30,
  pixExpirationMinutes: 30,
  downloadGrantDays: 7,
  downloadMaxCount: 5,
  termsVersion: "v2",
  termsMarkdown: "Texto dos termos com comprimento suficiente para validar.",
  adminNotifyEmail: "admin@example.com",
  supportWhatsapp: "11912345678",
};

describe("updateSettingsSchema", () => {
  it("aceita valores nos limites", () => {
    const parsed = updateSettingsSchema.parse(validBase);
    expect(parsed.holdDays).toBe(7);
    expect(parsed.supportWhatsapp).toBe("+5511912345678");
  });

  it("rejeita holdDays 91", () => {
    const result = updateSettingsSchema.safeParse({ ...validBase, holdDays: 91 });
    expect(result.success).toBe(false);
  });

  it("rejeita payoutDay 0 e 29", () => {
    expect(updateSettingsSchema.safeParse({ ...validBase, payoutDay: 0 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ ...validBase, payoutDay: 29 }).success).toBe(false);
  });

  it("exige versão no formato vN", () => {
    expect(updateSettingsSchema.safeParse({ ...validBase, termsVersion: "2" }).success).toBe(
      false,
    );
  });
});

describe("requiresNewTermsVersion", () => {
  it("bloqueia texto alterado com mesma versão", () => {
    expect(requiresNewTermsVersion("a", "v1", "b", "v1")).toBe(true);
  });

  it("libera texto alterado com versão nova", () => {
    expect(requiresNewTermsVersion("a", "v1", "b", "v2")).toBe(false);
  });

  it("não exige versão nova se o texto é igual", () => {
    expect(requiresNewTermsVersion("mesmo", "v1", "mesmo", "v1")).toBe(false);
  });
});

describe("assertSettingsLimits", () => {
  it("aceita holdDays 10", () => {
    expect(() => { assertSettingsLimits(updateSettingsSchema.parse({ ...validBase, holdDays: 10 })); },
    ).not.toThrow();
  });
});
