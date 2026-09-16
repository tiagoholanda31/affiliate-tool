import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

let storageDir: string;

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "affiliate-uploads-"));
  process.env.STORAGE_DIR = storageDir;
});

afterAll(async () => {
  // No Windows o sharp pode manter o handle aberto por um instante — não falha o suite.
  await rm(storageDir, { recursive: true, force: true }).catch(() => undefined);
});

async function loadUploads() {
  return import("@/lib/uploads");
}

describe("saveDigitalUpload", () => {
  it("aceita PDF real (magic bytes)", async () => {
    const { saveDigitalUpload } = await loadUploads();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

    const stored = await saveDigitalUpload(pdf, "livro.pdf");
    expect(stored.mime).toBe("application/pdf");
    expect(stored.path).toMatch(/^products\/.+\.pdf$/);
  });

  it("rejeita .exe renomeado para .pdf", async () => {
    const { saveDigitalUpload } = await loadUploads();
    const exe = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, ...Buffer.alloc(60)]);

    await expect(saveDigitalUpload(exe, "malware.pdf")).rejects.toThrow(/inválido/i);
  });

  it("rejeita arquivo acima de 50 MB", async () => {
    const { saveDigitalUpload, DIGITAL_MAX_BYTES } = await loadUploads();
    const huge = Buffer.alloc(DIGITAL_MAX_BYTES + 1, 0x25);

    await expect(saveDigitalUpload(huge, "grande.pdf")).rejects.toThrow(/muito grande/i);
  });
});

describe("saveCoverUpload", () => {
  it("reprocessa imagem em webp 4:3 sem EXIF", async () => {
    const sharp = (await import("sharp")).default;
    const { saveCoverUpload, coverVariantPath } = await loadUploads();

    const jpeg = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 20, g: 40, b: 80 } },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .toBuffer();

    const stored = await saveCoverUpload(jpeg);
    expect(stored.mime).toBe("image/webp");
    expect(stored.path).toMatch(/-md\.webp$/);

    const meta = await sharp(path.join(storageDir, coverVariantPath(stored.path, "md"))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
    expect(meta.exif).toBeUndefined();
  });
});
