/**
 * Queries administrativas de afiliados.
 *
 * Listagem server-side com busca, filtro de status e paginação. Os valores
 * sensíveis (chave Pix, e-mail completo, telefone) só saem mascarados ou sob
 * ação explícita de revelação.
 */
import type { AffiliateStatus, Prisma } from "@/generated/prisma/client";
import { formatPhone } from "@/features/affiliates/queries";
import { getAffiliateClicks30d, getClicks30dByAffiliateIds } from "@/features/tracking/queries";
import { db } from "@/lib/db";

export type AffiliateListSortBy = "createdAt" | "name" | "status";
export type AffiliateListSortDir = "asc" | "desc";

export type AffiliateListFilter = {
  status?: AffiliateStatus | "ALL";
  q?: string;
  page?: number;
  sortBy?: AffiliateListSortBy;
  sortDir?: AffiliateListSortDir;
};

export type AffiliateListItem = {
  id: string;
  name: string;
  email: string;
  status: AffiliateStatus;
  code: string | null;
  socialNetwork: string;
  socialHandle: string;
  phone: string;
  createdAt: Date;
  /** Cliques não-bot nos últimos 30 dias. */
  clicks30d: number;
};

export type AffiliateListResult = {
  items: AffiliateListItem[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<AffiliateStatus | "ALL", number>;
};

const PAGE_SIZE = 25;

const SORT_COLUMNS: Record<AffiliateListSortBy, Prisma.AffiliateOrderByWithRelationInput> = {
  createdAt: { createdAt: "desc" },
  name: { user: { name: "asc" } },
  status: { status: "asc" },
};

export async function getAffiliatesForAdmin(filters: AffiliateListFilter): Promise<AffiliateListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const status = filters.status === "ALL" ? undefined : filters.status;
  const q = filters.q?.trim();

  const where: Prisma.AffiliateWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { socialHandle: { contains: q, mode: "insensitive" } },
            { code: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortBy = filters.sortBy ?? "createdAt";
  const sortDir = filters.sortDir ?? "desc";
  const orderBy =
    sortBy === "createdAt" && sortDir === "asc"
      ? { createdAt: "asc" as const }
      : SORT_COLUMNS[sortBy];

  const [items, total, counts] = await db.$transaction([
    db.affiliate.findMany({
      where,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy,
      select: {
        id: true,
        status: true,
        code: true,
        socialNetwork: true,
        socialHandle: true,
        phone: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.affiliate.count({ where }),
    db.affiliate.groupBy({ by: ["status"], orderBy: { status: "asc" }, _count: { _all: true } }),
  ]);

  const statusCounts: Record<AffiliateStatus | "ALL", number> = {
    ALL: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    SUSPENDED: 0,
    REMOVED: 0,
  };

  for (const group of counts) {
    const count = (group._count as unknown as { _all?: number })._all ?? 0;
    statusCounts[group.status] = count;
    statusCounts.ALL += count;
  }

  const clicksMap = await getClicks30dByAffiliateIds(items.map((item) => item.id));

  return {
    items: items.map((item) => ({
      id: item.id,
      name: item.user.name,
      email: item.user.email,
      status: item.status,
      code: item.code,
      socialNetwork: item.socialNetwork,
      socialHandle: item.socialHandle,
      phone: formatPhone(item.phone),
      createdAt: item.createdAt,
      clicks30d: clicksMap.get(item.id) ?? 0,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
    statusCounts,
  };
}

export type AffiliateDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: AffiliateStatus;
  code: string | null;
  phone: string;
  socialNetwork: string;
  socialHandle: string;
  pixKeyType: string;
  pixKeyMasked: string;
  termsVersion: string;
  termsAcceptedAt: Date;
  termsIp: string;
  statusReason: string | null;
  statusChangedAt: Date;
  reviewCount: number;
  createdAt: Date;
  anonymizedAt: Date | null;
  codeEditedAt: Date | null;
  reviewedBy: { id: string; name: string } | null;
  clicks30d: number;
};

export async function getAffiliateDetailForAdmin(affiliateId: string): Promise<AffiliateDetail | null> {
  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
    select: {
      id: true,
      userId: true,
      status: true,
      code: true,
      phone: true,
      socialNetwork: true,
      socialHandle: true,
      pixKeyType: true,
      pixKeyMasked: true,
      termsVersion: true,
      termsAcceptedAt: true,
      termsIp: true,
      statusReason: true,
      statusChangedAt: true,
      reviewCount: true,
      createdAt: true,
      anonymizedAt: true,
      codeEditedAt: true,
      reviewedBy: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
    },
  });

  if (!affiliate) return null;

  const clicks30d = await getAffiliateClicks30d(affiliate.id);

  return {
    id: affiliate.id,
    userId: affiliate.userId,
    name: affiliate.user.name,
    email: affiliate.user.email,
    status: affiliate.status,
    code: affiliate.code,
    phone: formatPhone(affiliate.phone),
    socialNetwork: affiliate.socialNetwork,
    socialHandle: affiliate.socialHandle,
    pixKeyType: affiliate.pixKeyType,
    pixKeyMasked: affiliate.pixKeyMasked,
    termsVersion: affiliate.termsVersion,
    termsAcceptedAt: affiliate.termsAcceptedAt,
    termsIp: affiliate.termsIp,
    statusReason: affiliate.statusReason,
    statusChangedAt: affiliate.statusChangedAt,
    reviewCount: affiliate.reviewCount,
    createdAt: affiliate.createdAt,
    anonymizedAt: affiliate.anonymizedAt,
    codeEditedAt: affiliate.codeEditedAt,
    reviewedBy: affiliate.reviewedBy,
    clicks30d,
  };
}

export type AffiliateAuditEntry = {
  id: string;
  action: string;
  actorRole: string;
  actorName: string | null;
  before: unknown;
  after: unknown;
  createdAt: Date;
};

export async function getAffiliateAuditLog(affiliateId: string): Promise<AffiliateAuditEntry[]> {
  const logs = await db.auditLog.findMany({
    where: { entity: "Affiliate", entityId: affiliateId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      action: true,
      actorRole: true,
      before: true,
      after: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    actorRole: log.actorRole,
    actorName: log.actor?.name ?? null,
    before: log.before,
    after: log.after,
    createdAt: log.createdAt,
  }));
}

export async function getPendingAffiliatesCount(): Promise<number> {
  return db.affiliate.count({ where: { status: "PENDING" } });
}
