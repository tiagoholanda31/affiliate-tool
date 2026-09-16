import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

let storageDir: string;

// `src/lib/env.ts` lê STORAGE_DIR na importação, então o diretório precisa
// existir antes de importar o módulo de storage.
beforeAll(async () => {
  storageDir = await mkdtemp(path.join(tmpdir(), "affiliate-storage-"));
  process.env.STORAGE_DIR = storageDir;
});

afterAll(async () => {
  await rm(storageDir, { recursive: true, force: true });
});

async function loadStorage() {
  return import("@/lib/storage");
}

describe("saveFile", () => {
  it("grava o arquivo e devolve caminho relativo, hash e tamanho", async () => {
    const { saveFile, storageRoot } = await loadStorage();
    const content = Buffer.from("conteúdo do livro digital");

    const stored = await saveFile(content, { bucket: "products", ext: "pdf" });

    expect(stored.path).toMatch(/^products\/[0-9a-f-]{36}\.pdf$/);
    expect(stored.size).toBe(content.byteLength);
    expect(stored.sha256).toMatch(/^[0-9a-f]{64}$/);

    const written = await readFile(path.join(storageRoot(), stored.path));
    expect(written.equals(content)).toBe(true);
  });

  it("gera nomes diferentes para conteúdos iguais (o nome nunca vem do usuário)", async () => {
    const { saveFile } = await loadStorage();
    const content = Buffer.from("mesmo conteúdo");

    const first = await saveFile(content, { bucket: "materials", ext: "png" });
    const second = await saveFile(content, { bucket: "materials", ext: "png" });

    expect(first.path).not.toBe(second.path);
    expect(first.sha256).toBe(second.sha256);
  });

  it("normaliza a extensão, ignorando lixo enviado pelo usuário", async () => {
    const { saveFile } = await loadStorage();
    const content = Buffer.from("x");

    const withDots = await saveFile(content, { bucket: "proofs", ext: "..PdF" });
    expect(withDots.path.endsWith(".pdf")).toBe(true);

    const withTraversal = await saveFile(content, { bucket: "proofs", ext: "../../evil" });
    expect(withTraversal.path).toMatch(/^proofs\/[0-9a-f-]{36}\.evil$/);

    const empty = await saveFile(content, { bucket: "proofs", ext: "" });
    expect(empty.path).toMatch(/^proofs\/[0-9a-f-]{36}$/);
  });
});

describe("resolveStoragePath", () => {
  it("bloqueia caminho que escapa da raiz do storage", async () => {
    const { resolveStoragePath } = await loadStorage();

    expect(() => resolveStoragePath("../../etc/passwd")).toThrow();
    expect(() => resolveStoragePath("products/../../../secrets.txt")).toThrow();
  });

  it("aceita caminho normal dentro da raiz", async () => {
    const { resolveStoragePath, storageRoot } = await loadStorage();
    const resolved = resolveStoragePath("products/arquivo.pdf");
    expect(resolved.startsWith(storageRoot())).toBe(true);
  });
});

describe("fileSize / deleteFile", () => {
  it("devolve o tamanho e null depois de apagar", async () => {
    const { deleteFile, fileSize, saveFile } = await loadStorage();
    const content = Buffer.from("comprovante");

    const stored = await saveFile(content, { bucket: "proofs", ext: "jpg" });
    await expect(fileSize(stored.path)).resolves.toBe(content.byteLength);

    await deleteFile(stored.path);
    await expect(fileSize(stored.path)).resolves.toBeNull();
  });

  it("apagar arquivo inexistente não falha", async () => {
    const { deleteFile } = await loadStorage();
    await expect(deleteFile("products/não-existe.pdf")).resolves.toBeUndefined();
  });
});

describe("ensureStorageDirs", () => {
  it("cria as três subpastas", async () => {
    const { ensureStorageDirs, storageRoot } = await loadStorage();
    await ensureStorageDirs();

    for (const bucket of ["products", "materials", "proofs"]) {
      // Ler um diretório como arquivo falha com EISDIR — prova de que ele existe.
      const code = await readFile(path.join(storageRoot(), bucket)).catch(
        (error: unknown) => (error as NodeJS.ErrnoException).code,
      );
      expect(code).toBe("EISDIR");
    }
  });
});
