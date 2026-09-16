import { unstable_cache } from "next/cache";

import type { Prisma } from "@/generated/prisma/client";
import type { CommissionType, ProductStatus, ProductType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { calculateCommission, formatCommissionPreview, formatBRL } from "@/lib/money";
import { labelFor } from "@/lib/i18n/pt-BR";

export type ProductListSortBy = "sortOrder" | "name" | "priceCents" | "updatedAt";
export type ProductListSortDir = "asc" | "desc";

export type ProductListFilter = {
  status?: ProductStatus | "ALL";
  type?: ProductType | "ALL";
  q?: string;
  page?: number;
  sortBy?: ProductListSortBy;
  sortDir?: ProductListSortDir;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  status: ProductStatus;
  priceCents: number;
  commissionLabel: string;
  coverImagePath: string | null;
  sortOrder: number;
  updatedAt: Date;
  /** Placeholder até a fatia 05. */
  salesCount: number;
};

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<ProductStatus | "ALL", number>;
};

const PAGE_SIZE = 25;

export async function getProductsForAdmin(filters: ProductListFilter): Promise<ProductListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const status = filters.status === "ALL" ? undefined : filters.status;
  const type = filters.type === "ALL" ? undefined : filters.type;
  const q = filters.q?.trim();

  const where: Prisma.ProductWhereInput = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { shortDescription: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortBy = filters.sortBy ?? "sortOrder";
  const sortDir = filters.sortDir ?? "asc";
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sortBy === "sortOrder"
      ? [{ sortOrder: sortDir }, { name: "asc" }]
      : [{ [sortBy]: sortDir }];

  const [rows, total, counts] = await db.$transaction([
    db.product.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        priceCents: true,
        commissionType: true,
        commissionValue: true,
        coverImagePath: true,
        sortOrder: true,
        updatedAt: true,
      },
    }),
    db.product.count({ where }),
    db.product.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } }),
  ]);

  const salesByProduct =
    rows.length === 0
      ? []
      : await db.order.groupBy({
          by: ["productId"],
          where: { status: "PAID", productId: { in: rows.map((r) => r.id) } },
          _count: { _all: true },
        });
  const salesMap = new Map(
    salesByProduct.map((g) => [g.productId, g._count._all]),
  );

  const statusCounts: Record<ProductStatus | "ALL", number> = {
    ALL: 0,
    DRAFT: 0,
    ACTIVE: 0,
    ARCHIVED: 0,
  };
  for (const group of counts) {
    const count = (group._count as unknown as { _all?: number })._all ?? 0;
    statusCounts[group.status] = count;
    statusCounts.ALL += count;
  }

  return {
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.type,
      status: row.status,
      priceCents: row.priceCents,
      commissionLabel: formatCommissionPreview({
        type: row.commissionType,
        value: row.commissionValue,
        priceCents: row.priceCents,
      }),
      coverImagePath: row.coverImagePath,
      sortOrder: row.sortOrder,
      updatedAt: row.updatedAt,
      salesCount: salesMap.get(row.id) ?? 0,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    statusCounts,
  };
}

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  type: ProductType;
  status: ProductStatus;
  shortDescription: string;
  description: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  commissionType: CommissionType;
  commissionValue: number;
  coverImagePath: string | null;
  allowPix: boolean;
  allowCard: boolean;
  maxInstallments: number;
  deliveryNote: string | null;
  sortOrder: number;
  digitalFile: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    path: string;
  } | null;
};

export async function getProductForAdmin(id: string): Promise<ProductDetail | null> {
  const product = await db.product.findUnique({
    where: { id },
    include: { digitalFile: true },
  });
  if (!product) return null;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    type: product.type,
    status: product.status,
    shortDescription: product.shortDescription,
    description: product.description,
    priceCents: product.priceCents,
    compareAtPriceCents: product.compareAtPriceCents,
    commissionType: product.commissionType,
    commissionValue: product.commissionValue,
    coverImagePath: product.coverImagePath,
    allowPix: product.allowPix,
    allowCard: product.allowCard,
    maxInstallments: product.maxInstallments,
    deliveryNote: product.deliveryNote,
    sortOrder: product.sortOrder,
    digitalFile: product.digitalFile
      ? {
          originalName: product.digitalFile.originalName,
          mimeType: product.digitalFile.mimeType,
          sizeBytes: product.digitalFile.sizeBytes,
          sha256: product.digitalFile.sha256,
          path: product.digitalFile.storagePath,
        }
      : null,
  };
}

/** Produtos ACTIVE para a vitrine pública. */
export const listActiveProducts = unstable_cache(
  async () => {
    return db.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        shortDescription: true,
        priceCents: true,
        compareAtPriceCents: true,
        coverImagePath: true,
        maxInstallments: true,
      },
    });
  },
  ["products-vitrine"],
  { tags: ["products"], revalidate: 60 },
);

export type PublicProduct = Awaited<ReturnType<typeof getPublicProductBySlug>>;

export async function getPublicProductBySlug(slug: string) {
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      type: true,
      status: true,
      shortDescription: true,
      description: true,
      priceCents: true,
      compareAtPriceCents: true,
      coverImagePath: true,
      allowPix: true,
      allowCard: true,
      maxInstallments: true,
      deliveryNote: true,
    },
  });
  return product;
}

/** Resolve slug atual ou histórico (para 301). */
export async function resolveProductSlug(slug: string): Promise<
  | { kind: "current"; product: NonNullable<Awaited<ReturnType<typeof getPublicProductBySlug>>> }
  | { kind: "redirect"; toSlug: string }
  | { kind: "missing" }
> {
  const current = await getPublicProductBySlug(slug);
  if (current) return { kind: "current", product: current };

  const history = await db.productSlugHistory.findUnique({
    where: { slug },
    select: { product: { select: { slug: true } } },
  });
  if (history) return { kind: "redirect", toSlug: history.product.slug };

  return { kind: "missing" };
}

export function installmentLabel(priceCents: number, maxInstallments: number): string | null {
  if (maxInstallments <= 1) return null;
  const per = Math.floor(priceCents / maxInstallments);
  return `em até ${String(maxInstallments)}x de ${formatBRL(per)} sem juros`;
}

export function productTypeLabel(type: ProductType): string {
  return labelFor("productType", type);
}

export function commissionCents(type: CommissionType, value: number, priceCents: number): number {
  return calculateCommission({ type, value, priceCents });
}
