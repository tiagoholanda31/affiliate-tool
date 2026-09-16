/**
 * Domínio de produtos — puro o bastante para testar sem HTTP.
 *
 * Regras (docs/spec/01 §2): DIGITAL só ACTIVE com arquivo; exclusão bloqueada
 * se houver pedidos (Order chega na fatia 05 — checagem defensiva abaixo).
 */
import type { Prisma } from "@/generated/prisma/client";
import type { ProductStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { deleteFile } from "@/lib/storage";
import { coverVariantPath } from "@/lib/uploads";
import type { ProductFormValues } from "@/features/products/schemas";

export type Tx = Prisma.TransactionClient;

/** Conta pedidos do produto (bloqueia exclusão se > 0). */
export async function countProductOrders(productId: string, client: Tx | typeof db = db): Promise<number> {
  return client.order.count({ where: { productId } });
}

async function assertUniqueSlug(slug: string, excludeId: string | null, client: Tx): Promise<void> {
  const existing = await client.product.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== excludeId) {
    throw new AppError("CONFLICT", "Este slug já está em uso. Escolha outro.");
  }

  const history = await client.productSlugHistory.findUnique({
    where: { slug },
    select: { productId: true },
  });
  if (history && history.productId !== excludeId) {
    throw new AppError("CONFLICT", "Este slug já foi usado por outro produto.");
  }
}

function digitalFileCreate(data: ProductFormValues): Prisma.DigitalFileCreateWithoutProductInput | undefined {
  if (data.type !== "DIGITAL" || !data.digitalFile) return undefined;
  return {
    storagePath: data.digitalFile.path,
    originalName: data.digitalFile.originalName,
    mimeType: data.digitalFile.mimeType,
    sizeBytes: data.digitalFile.sizeBytes,
    sha256: data.digitalFile.sha256,
  };
}

function productData(data: ProductFormValues): Prisma.ProductCreateInput {
  return {
    name: data.name,
    slug: data.slug,
    type: data.type,
    status: data.status,
    shortDescription: data.shortDescription,
    description: data.description,
    priceCents: data.priceCents,
    compareAtPriceCents: data.compareAtPriceCents ?? null,
    commissionType: data.commissionType,
    commissionValue: data.commissionValue,
    coverImagePath: data.coverImagePath ?? null,
    allowPix: data.allowPix,
    allowCard: data.allowCard,
    maxInstallments: data.allowCard ? data.maxInstallments : 1,
    deliveryNote:
      data.type === "SERVICE" && data.deliveryNote && data.deliveryNote.trim() !== ""
        ? data.deliveryNote.trim()
        : null,
    sortOrder: data.sortOrder,
  };
}

function assertCanActivate(data: ProductFormValues, hasExistingFile: boolean): void {
  if (data.status !== "ACTIVE") return;
  if (data.type === "DIGITAL" && !data.digitalFile && !hasExistingFile) {
    throw new AppError(
      "VALIDATION",
      "Produto digital só pode ser publicado com arquivo PDF ou EPUB.",
    );
  }
}

export async function createProduct(data: ProductFormValues, client: Tx = db): Promise<{ id: string }> {
  assertCanActivate(data, false);
  await assertUniqueSlug(data.slug, null, client);

  const file = digitalFileCreate(data);
  const product = await client.product.create({
    data: {
      ...productData(data),
      ...(file ? { digitalFile: { create: file } } : {}),
    },
    select: { id: true },
  });

  return product;
}

export async function updateProduct(
  id: string,
  data: ProductFormValues,
  client: Tx = db,
): Promise<{ id: string; slugChanged: boolean; previousSlug: string | null }> {
  const current = await client.product.findUnique({
    where: { id },
    include: { digitalFile: true },
  });
  if (!current) throw new AppError("NOT_FOUND", "Produto não encontrado.");

  const hasFile = Boolean(current.digitalFile) || Boolean(data.digitalFile);
  assertCanActivate(data, hasFile);
  await assertUniqueSlug(data.slug, id, client);

  const slugChanged = current.slug !== data.slug;
  if (slugChanged && current.status === "ACTIVE" && data.confirmSlugChange !== true) {
    throw new AppError(
      "VALIDATION",
      "Alterar o slug de um produto publicado quebra links antigos. Confirme a alteração.",
    );
  }

  // Troca de arquivo digital: remove o anterior do disco depois do commit (actions).
  const previousDigitalPath =
    data.digitalFile && current.digitalFile ? current.digitalFile.storagePath : null;
  const previousCoverPath =
    data.coverImagePath &&
    current.coverImagePath &&
    data.coverImagePath !== current.coverImagePath
      ? current.coverImagePath
      : null;

  await client.product.update({
    where: { id },
    data: {
      ...productData(data),
      ...(slugChanged
        ? {
            slugHistory: {
              create: { slug: current.slug },
            },
          }
        : {}),
      ...(data.type === "DIGITAL" && data.digitalFile
        ? {
            digitalFile: {
              upsert: {
                create: {
                  storagePath: data.digitalFile.path,
                  originalName: data.digitalFile.originalName,
                  mimeType: data.digitalFile.mimeType,
                  sizeBytes: data.digitalFile.sizeBytes,
                  sha256: data.digitalFile.sha256,
                },
                update: {
                  storagePath: data.digitalFile.path,
                  originalName: data.digitalFile.originalName,
                  mimeType: data.digitalFile.mimeType,
                  sizeBytes: data.digitalFile.sizeBytes,
                  sha256: data.digitalFile.sha256,
                },
              },
            },
          }
        : {}),
      ...(data.type === "SERVICE" && current.digitalFile
        ? { digitalFile: { delete: true } }
        : {}),
    },
  });

  // Limpeza de arquivos órfãos — best-effort fora da lógica de negócio.
  if (previousDigitalPath) {
    await deleteFile(previousDigitalPath).catch(() => undefined);
  }
  if (previousCoverPath) {
    await deleteCoverVariants(previousCoverPath);
  }
  if (data.type === "SERVICE" && current.digitalFile) {
    await deleteFile(current.digitalFile.storagePath).catch(() => undefined);
  }

  return {
    id,
    slugChanged,
    previousSlug: slugChanged ? current.slug : null,
  };
}

export async function setProductStatus(
  id: string,
  status: Extract<ProductStatus, "ACTIVE" | "ARCHIVED" | "DRAFT">,
  client: Tx = db,
): Promise<{ id: string; status: ProductStatus }> {
  const product = await client.product.findUnique({
    where: { id },
    include: { digitalFile: true },
  });
  if (!product) throw new AppError("NOT_FOUND", "Produto não encontrado.");

  if (status === "ACTIVE" && product.type === "DIGITAL" && !product.digitalFile) {
    throw new AppError(
      "VALIDATION",
      "Produto digital só pode ser publicado com arquivo PDF ou EPUB.",
    );
  }

  await client.product.update({ where: { id }, data: { status } });
  return { id, status };
}

export async function deleteProduct(
  id: string,
  confirmName: string,
  client: Tx = db,
): Promise<{ id: string }> {
  const product = await client.product.findUnique({
    where: { id },
    include: { digitalFile: true },
  });
  if (!product) throw new AppError("NOT_FOUND", "Produto não encontrado.");

  if (confirmName.trim() !== product.name) {
    throw new AppError("VALIDATION", "Digite o nome do produto exatamente para confirmar.");
  }

  const orders = await countProductOrders(id, client);
  if (orders > 0) {
    throw new AppError(
      "CONFLICT",
      "Este produto já tem pedidos. Arquive em vez de excluir.",
    );
  }

  await client.product.delete({ where: { id } });

  if (product.coverImagePath) await deleteCoverVariants(product.coverImagePath);
  if (product.digitalFile) await deleteFile(product.digitalFile.storagePath).catch(() => undefined);

  return { id };
}

export async function reorderProducts(orderedIds: string[], client: Tx = db): Promise<void> {
  await Promise.all(
    orderedIds.map((id, index) =>
      client.product.updateMany({ where: { id }, data: { sortOrder: index } }),
    ),
  );
}

async function deleteCoverVariants(mdPath: string): Promise<void> {
  await Promise.all(
    (["sm", "md", "lg"] as const).map((size) =>
      deleteFile(coverVariantPath(mdPath, size)).catch(() => undefined),
    ),
  );
}
