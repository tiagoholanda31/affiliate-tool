import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  contentDispositionAttachment,
  downloadFileName,
} from "@/features/delivery/service";
import { hashToken, randomToken } from "@/lib/crypto";

describe("downloadFileName", () => {
  it("normaliza acentos e espaços", () => {
    expect(downloadFileName("E-book Introdução", "pdf")).toBe("E-book-Introducao.pdf");
  });

  it("fallback quando o nome fica vazio", () => {
    expect(downloadFileName("!!!", "epub")).toBe("download.epub");
  });
});

describe("contentDispositionAttachment", () => {
  it("inclui filename ASCII e filename* UTF-8", () => {
    const header = contentDispositionAttachment("Livro.pdf");
    expect(header).toContain('filename="Livro.pdf"');
    expect(header).toContain("filename*=UTF-8''Livro.pdf");
  });
});

describe("token hash (grant)", () => {
  it("gera token de 32 bytes e hash determinístico", () => {
    const token = randomToken(32);
    expect(token.length).toBeGreaterThan(40);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(token);
  });

  it("expiração padrão é +7 dias a partir de agora", () => {
    const now = new Date("2026-09-10T12:00:00.000Z");
    expect(addDays(now, 7).toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });
});
