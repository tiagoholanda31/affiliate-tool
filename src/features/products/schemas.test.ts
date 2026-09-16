import { describe, expect, it } from "vitest";

import { productFormSchema, suggestSlug } from "@/features/products/schemas";
import { slugify } from "@/lib/slugify";

describe("slugify / suggestSlug", () => {
  it("remove acentos e normaliza", () => {
    expect(slugify("Consulta de Avaliação")).toBe("consulta-de-avaliacao");
    expect(suggestSlug("E-book Introdução!")).toBe("e-book-introducao");
  });

  it("colapsa hífens e limita tamanho", () => {
    expect(slugify("a---b")).toBe("a-b");
    expect(slugify("x".repeat(100)).length).toBeLessThanOrEqual(80);
  });
});

describe("productFormSchema", () => {
  const base = {
    name: "Consulta de avaliação",
    slug: "consulta-avaliacao",
    type: "SERVICE" as const,
    status: "DRAFT" as const,
    shortDescription: "Descrição curta com mais de dez caracteres.",
    description: "Descrição longa em markdown com mais de vinte caracteres.",
    priceCents: 20000,
    commissionType: "PERCENT" as const,
    commissionValue: 1500,
    allowPix: true,
    allowCard: true,
    maxInstallments: 3,
    sortOrder: 0,
  };

  it("aceita serviço válido", () => {
    const parsed = productFormSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("rejeita DIGITAL ACTIVE sem arquivo", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      type: "DIGITAL",
      status: "ACTIVE",
      digitalFile: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("aceita DIGITAL ACTIVE com arquivo", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      type: "DIGITAL",
      status: "ACTIVE",
      digitalFile: {
        path: "products/abc.pdf",
        originalName: "livro.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        sha256: "a".repeat(64),
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita comissão fixa acima do preço", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      commissionType: "FIXED",
      commissionValue: 25000,
    });
    expect(parsed.success).toBe(false);
  });

  it("exige pelo menos um meio de pagamento", () => {
    const parsed = productFormSchema.safeParse({
      ...base,
      allowPix: false,
      allowCard: false,
    });
    expect(parsed.success).toBe(false);
  });
});
