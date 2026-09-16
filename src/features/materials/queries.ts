import { unstable_cache } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { MaterialType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

import type { AffiliateMaterialsFilter } from "./schemas";
import type { MaterialRecord } from "./service";
import type { AdminMaterialListItem } from "./types";

export type { AdminMaterialListItem } from "./types";

export type AdminMaterialFilter = {
  type?: MaterialType | "ALL";
  active?: "ALL" | "true" | "false";
  productId?: string;
  q?: string;
  page?: number;
};

export type AdminMaterialListResult = {
  items: AdminMaterialListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 25;

export async function getMaterialsForAdmin(
  filters: AdminMaterialFilter,
): Promise<AdminMaterialListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const type = filters.type === "ALL" ? undefined : filters.type;
  const q = filters.q?.trim();
  const active =
    filters.active === "true" ? true : filters.active === "false" ? false : undefined;

  const where: Prisma.MaterialWhereInput = {
    ...(type ? { type } : {}),
    ...(active === undefined ? {} : { isActive: active }),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [rows, total] = await db.$transaction([
    db.material.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      select: {
        id: true,
        title: true,
        type: true,
        isActive: true,
        sortOrder: true,
        thumbPath: true,
        downloadCount: true,
        updatedAt: true,
        product: { select: { name: true } },
      },
    }),
    db.material.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      type: row.type,
      isActive: row.isActive,
      sortOrder: row.sortOrder,
      thumbPath: row.thumbPath,
      productName: row.product?.name ?? null,
      downloadCount: row.downloadCount,
      updatedAt: row.updatedAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function listProductsForMaterialSelect(): Promise<
  { id: string; name: string; slug: string }[]
> {
  return db.product.findMany({
    where: { status: { in: ["ACTIVE", "DRAFT"] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

type AffiliateMaterialRow = MaterialRecord;

async function listActiveMaterialsUncached(
  filters: AffiliateMaterialsFilter,
): Promise<AffiliateMaterialRow[]> {
  const type = filters.type === "ALL" ? undefined : filters.type;
  const q = filters.q?.trim();

  const where: Prisma.MaterialWhereInput = {
    isActive: true,
    ...(type ? { type } : {}),
    ...(filters.productId ? { productId: filters.productId } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { textContent: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.material.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    include: {
      product: { select: { id: true, name: true, slug: true } },
    },
  });

  return rows.map((row) => ({
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
    product: row.product,
  }));
}

/** Lista pública (afiliado) com cache tag `materials`. */
export function listActiveMaterials(filters: AffiliateMaterialsFilter) {
  const key = [
    "materials-active",
    filters.type,
    filters.productId ?? "",
    filters.q ?? "",
  ];
  return unstable_cache(() => listActiveMaterialsUncached(filters), key, {
    tags: ["materials"],
    revalidate: 60,
  })();
}

/** Até 3 materiais ativos por produto (página de links). */
export async function listMaterialsForProduct(
  productId: string,
  limit = 3,
): Promise<
  {
    id: string;
    title: string;
    type: MaterialType;
    textContent: string | null;
    externalUrl: string | null;
  }[]
> {
  return db.material.findMany({
    where: { productId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    take: limit,
    select: {
      id: true,
      title: true,
      type: true,
      textContent: true,
      externalUrl: true,
    },
  });
}

/** Materiais TEXT ativos por produto — texto de share na página de links. */
export async function getPrimaryTextMaterial(
  productId: string,
): Promise<{ textContent: string } | null> {
  const row = await db.material.findFirst({
    where: { productId, isActive: true, type: "TEXT", textContent: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { textContent: true },
  });
  if (!row?.textContent) return null;
  return { textContent: row.textContent };
}
