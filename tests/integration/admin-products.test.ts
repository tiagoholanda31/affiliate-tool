/**
 * CRUD de produtos no admin.
 *
 * Protege: DIGITAL sem arquivo não publica; slug único; exclusão com confirmação;
 * troca de slug em ACTIVE grava histórico; audit em create/publish/archive.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveProduct,
  createProduct,
  deleteProduct,
  publishProduct,
  updateProduct,
} from "@/features/products/actions";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

import {
  createCookieStore,
  requestContext,
  seedSettings,
  signInAndGetCookie,
  truncateAll,
} from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  updateTag: () => undefined,
  revalidateTag: () => undefined,
}));

const PASSWORD = "trufaAzulNoTelhado";

const digitalFile = {
  path: "products/test-file.pdf",
  originalName: "livro.pdf",
  mimeType: "application/pdf" as const,
  sizeBytes: 2048,
  sha256: "b".repeat(64),
};

const baseProduct = {
  name: "E-book Introdução",
  slug: "ebook-introducao",
  type: "DIGITAL" as const,
  status: "DRAFT" as const,
  shortDescription: "Material digital introdutório do Affiliate Tool.",
  description: "Descrição completa em markdown com conteúdo suficiente para validar.",
  priceCents: 4900,
  compareAtPriceCents: null,
  commissionType: "PERCENT" as const,
  commissionValue: 1500,
  coverImagePath: null,
  allowPix: true,
  allowCard: true,
  maxInstallments: 1,
  deliveryNote: null,
  sortOrder: 0,
  digitalFile: null,
  confirmSlugChange: false,
};

async function createAdmin(email: string) {
  await auth.api.signUpEmail({
    body: { name: "Admin Produtos", email, password: PASSWORD, callbackURL: "/verificar-email?status=ok" },
    headers: requestContext.headers,
  });
  await db.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  return { email, password: PASSWORD };
}

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v1");
  requestContext.reset();
  cookieStore.jar.clear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("admin products", () => {
  it("cria produto, publica com arquivo e registra audit", async () => {
    const admin = await createAdmin("admin.produtos@teste.local");
    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const created = await createProduct({ ...baseProduct, digitalFile });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const published = await publishProduct({ id: created.data.id });
    expect(published.ok).toBe(true);

    const product = await db.product.findUnique({
      where: { id: created.data.id },
      include: { digitalFile: true },
    });
    expect(product?.status).toBe("ACTIVE");
    expect(product?.digitalFile?.originalName).toBe("livro.pdf");

    const audits = await db.auditLog.findMany({
      where: { entityId: created.data.id },
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["product.create", "product.publish"]),
    );
  });

  it("não publica DIGITAL sem arquivo", async () => {
    const admin = await createAdmin("admin.produtos2@teste.local");
    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const created = await createProduct(baseProduct);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const published = await publishProduct({ id: created.data.id });
    expect(published.ok).toBe(false);
    if (published.ok) return;
    expect(published.error).toMatch(/arquivo/i);
  });

  it("bloqueia slug duplicado e grava histórico ao alterar slug publicado", async () => {
    const admin = await createAdmin("admin.produtos3@teste.local");
    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const first = await createProduct({
      ...baseProduct,
      type: "SERVICE",
      status: "ACTIVE",
      slug: "consulta-avaliacao",
      name: "Consulta de avaliação",
      digitalFile: null,
      deliveryNote: "Contato em 1 dia útil.",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const dup = await createProduct({
      ...baseProduct,
      type: "SERVICE",
      slug: "consulta-avaliacao",
      name: "Outra consulta",
      digitalFile: null,
    });
    expect(dup.ok).toBe(false);

    const withoutConfirm = await updateProduct({
      ...baseProduct,
      id: first.data.id,
      type: "SERVICE",
      status: "ACTIVE",
      slug: "consulta-nova",
      name: "Consulta de avaliação",
      digitalFile: null,
      deliveryNote: "Contato em 1 dia útil.",
      confirmSlugChange: false,
    });
    expect(withoutConfirm.ok).toBe(false);

    const withConfirm = await updateProduct({
      ...baseProduct,
      id: first.data.id,
      type: "SERVICE",
      status: "ACTIVE",
      slug: "consulta-nova",
      name: "Consulta de avaliação",
      digitalFile: null,
      deliveryNote: "Contato em 1 dia útil.",
      confirmSlugChange: true,
    });
    expect(withConfirm.ok).toBe(true);

    const history = await db.productSlugHistory.findUnique({
      where: { slug: "consulta-avaliacao" },
    });
    expect(history?.productId).toBe(first.data.id);
  });

  it("arquiva e exclui com nome confirmado", async () => {
    const admin = await createAdmin("admin.produtos4@teste.local");
    requestContext.setCookie(await signInAndGetCookie(auth, admin.email, admin.password));

    const created = await createProduct({
      ...baseProduct,
      type: "SERVICE",
      name: "Serviço temporário",
      slug: "servico-temporario",
      digitalFile: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const archived = await archiveProduct({ id: created.data.id });
    expect(archived.ok).toBe(true);

    const wrongName = await deleteProduct({ id: created.data.id, confirmName: "errado" });
    expect(wrongName.ok).toBe(false);

    const deleted = await deleteProduct({
      id: created.data.id,
      confirmName: "Serviço temporário",
    });
    expect(deleted.ok).toBe(true);
    expect(await db.product.findUnique({ where: { id: created.data.id } })).toBeNull();
  });
});
