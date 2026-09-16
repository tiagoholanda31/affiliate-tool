import { describe, expect, it } from "vitest";

import { globalSearchSchema } from "@/features/search/schemas";
import { normalizeSearchQuery } from "@/features/search/service";

describe("normalizeSearchQuery", () => {
  it("remove @ inicial do handle", () => {
    expect(normalizeSearchQuery("@affiliate")).toBe("affiliate");
    expect(normalizeSearchQuery("  @Maria  ")).toBe("Maria");
  });

  it("mantém texto sem @", () => {
    expect(normalizeSearchQuery("IF-ABC123")).toBe("IF-ABC123");
    expect(normalizeSearchQuery("joao@email.com")).toBe("joao@email.com");
  });
});

describe("globalSearchSchema", () => {
  it("aceita 1–80 chars", () => {
    expect(globalSearchSchema.parse({ q: "a" }).q).toBe("a");
    expect(globalSearchSchema.parse({ q: "  hello  " }).q).toBe("hello");
  });

  it("rejeita vazio e >80", () => {
    expect(globalSearchSchema.safeParse({ q: "" }).success).toBe(false);
    expect(globalSearchSchema.safeParse({ q: " " }).success).toBe(false);
    expect(globalSearchSchema.safeParse({ q: "x".repeat(81) }).success).toBe(false);
  });
});
