/**
 * Materiais de divulgação — regras e acesso a dados.
 */
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { deleteFile } from "@/lib/storage";

import type { MaterialFormValues } from "./schemas";

export type MaterialRecord = {
  id: string;
  title: string;
  description: string | null;
  type: "IMAGE" | "PDF" | "TEXT" | "LINK";
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  thumbPath: string | null;
  textContent: string | null;
  externalUrl: string | null;
  productId: string | null;
  isActive: boolean;
  sortOrder: number;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  product: { id: string; name: string; slug: string } | null;
};

function mapMaterial(
  row: MaterialRecord & {
    product?: { id: string; name: string; slug: string } | null;
  },
): MaterialRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    filePath: row.filePath,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    thumbPath: row.thumbPath,
    textContent: row.textContent,
    externalUrl: row.externalUrl,
    productId: row.productId,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    downloadCount: row.downloadCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    product: row.product ?? null,
  };
}

const materialInclude = {
  product: { select: { id: true, name: true, slug: true } },
} as const;

export async function createMaterial(data: MaterialFormValues): Promise<{ id: string }> {
  await assertProductExists(data.productId);

  const created = await db.material.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      productId: data.productId,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      textContent: data.type === "TEXT" ? data.textContent : null,
      externalUrl: data.type === "LINK" ? data.externalUrl : null,
      filePath: data.file?.path ?? null,
      fileName: data.file?.originalName ?? null,
      mimeType: data.file?.mimeType ?? null,
      sizeBytes: data.file?.sizeBytes ?? null,
      thumbPath: data.file?.thumbPath ?? null,
    },
    select: { id: true },
  });

  return created;
}

export async function updateMaterial(
  id: string,
  data: MaterialFormValues,
): Promise<{ id: string }> {
  const existing = await db.material.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Material não encontrado.");

  await assertProductExists(data.productId);

  const needsFile = data.type === "IMAGE" || data.type === "PDF";
  const hasNewFile = Boolean(data.file);
  if (needsFile && !hasNewFile && !existing.filePath) {
    throw new AppError("VALIDATION", "Envie o arquivo do material.");
  }
  if (needsFile && !hasNewFile && existing.type !== data.type) {
    throw new AppError("VALIDATION", "Ao mudar o tipo, envie um novo arquivo.");
  }

  const previousPaths = [existing.filePath, existing.thumbPath].filter(
    (p): p is string => Boolean(p),
  );

  const fileFields = (() => {
    if (hasNewFile) {
      const file = data.file;
      if (!file) {
        throw new AppError("VALIDATION", "Envie o arquivo do material.");
      }
      return {
        filePath: file.path,
        fileName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        thumbPath: file.thumbPath ?? null,
      };
    }
    if (needsFile) return {};
    return {
      filePath: null,
      fileName: null,
      mimeType: null,
      sizeBytes: null,
      thumbPath: null,
    };
  })();

  await db.material.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      productId: data.productId,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      textContent: data.type === "TEXT" ? data.textContent : null,
      externalUrl: data.type === "LINK" ? data.externalUrl : null,
      ...fileFields,
    },
  });

  if (hasNewFile) {
    for (const path of previousPaths) {
      if (path !== data.file?.path && path !== data.file?.thumbPath) {
        await deleteFile(path).catch(() => undefined);
      }
    }
  } else if (!needsFile) {
    for (const path of previousPaths) {
      await deleteFile(path).catch(() => undefined);
    }
  }

  return { id };
}

export async function setMaterialActive(
  id: string,
  isActive: boolean,
): Promise<{ id: string; isActive: boolean }> {
  const existing = await db.material.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("NOT_FOUND", "Material não encontrado.");

  const updated = await db.material.update({
    where: { id },
    data: { isActive },
    select: { id: true, isActive: true },
  });
  return updated;
}

export async function deleteMaterial(id: string, confirmTitle: string): Promise<void> {
  const existing = await db.material.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Material não encontrado.");

  if (confirmTitle.trim() !== existing.title) {
    throw new AppError("VALIDATION", "Digite o título do material para confirmar a exclusão.");
  }

  await db.material.delete({ where: { id } });

  for (const path of [existing.filePath, existing.thumbPath]) {
    if (path) await deleteFile(path).catch(() => undefined);
  }
}

export async function reorderMaterials(orderedIds: string[]): Promise<void> {
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.material.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );
}

export async function getMaterialById(id: string): Promise<MaterialRecord | null> {
  const row = await db.material.findUnique({
    where: { id },
    include: materialInclude,
  });
  return row ? mapMaterial(row) : null;
}

/** Incrementa contagem agregada de downloads (best-effort). */
export async function incrementDownloadCount(id: string): Promise<void> {
  await db.material.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  });
}

async function assertProductExists(productId: string | null | undefined): Promise<void> {
  if (!productId) return;
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new AppError("VALIDATION", "Produto vinculado não encontrado.");
}
