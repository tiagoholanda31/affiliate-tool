import { describe, expect, it } from "vitest";

import { createMaterialSchema, updateMaterialSchema } from "./schemas";
import { replaceLinkPlaceholder, resolveMaterialAffiliateUrl } from "./text";

describe("replaceLinkPlaceholder", () => {
  it("substitui {{link}} pelo URL do afiliado", () => {
    const url = "https://affiliates.example.com/r/ABC123/ebook";
    expect(replaceLinkPlaceholder("Compre aqui: {{link}} agora", url)).toBe(
      `Compre aqui: ${url} agora`,
    );
  });

  it("aceita espaços dentro do placeholder", () => {
    const url = "https://affiliates.example.com/r/ABC123";
    expect(replaceLinkPlaceholder("Link: {{ link }}", url)).toBe(`Link: ${url}`);
  });

  it("substitui todas as ocorrências", () => {
    const url = "https://example.com/r/X";
    expect(replaceLinkPlaceholder("{{link}} e de novo {{link}}", url)).toBe(
      `${url} e de novo ${url}`,
    );
  });
});

describe("resolveMaterialAffiliateUrl", () => {
  it("usa slug do produto quando houver", () => {
    expect(resolveMaterialAffiliateUrl("CODE1", "meu-livro")).toMatch(/\/r\/CODE1\/meu-livro$/);
  });

  it("usa link geral sem slug", () => {
    expect(resolveMaterialAffiliateUrl("CODE1", null)).toMatch(/\/r\/CODE1$/);
  });
});

describe("createMaterialSchema", () => {
  it("exige texto para TEXT", () => {
    const result = createMaterialSchema.safeParse({
      title: "Copy stories",
      type: "TEXT",
      isActive: true,
      sortOrder: 0,
      textContent: "oi",
    });
    expect(result.success).toBe(false);
  });

  it("aceita TEXT com {{link}}", () => {
    const result = createMaterialSchema.safeParse({
      title: "Copy stories",
      type: "TEXT",
      isActive: true,
      sortOrder: 0,
      textContent: "Veja: {{link}}",
    });
    expect(result.success).toBe(true);
  });

  it("exige arquivo para IMAGE", () => {
    const result = createMaterialSchema.safeParse({
      title: "Banner",
      type: "IMAGE",
      isActive: true,
      sortOrder: 0,
    });
    expect(result.success).toBe(false);
  });

  it("exige URL para LINK", () => {
    const result = createMaterialSchema.safeParse({
      title: "Vídeo",
      type: "LINK",
      isActive: true,
      sortOrder: 0,
      externalUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateMaterialSchema", () => {
  it("permite IMAGE sem arquivo novo (já existe no banco)", () => {
    const result = updateMaterialSchema.safeParse({
      id: "mat_1",
      title: "Banner",
      type: "IMAGE",
      isActive: true,
      sortOrder: 1,
    });
    expect(result.success).toBe(true);
  });
});
