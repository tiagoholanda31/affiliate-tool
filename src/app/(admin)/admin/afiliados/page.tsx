import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AffiliatesDataTable } from "./data-table";

import { PageHeader } from "@/components/layout/page-header";
import { getAffiliatesForAdmin, type AffiliateListFilter } from "@/features/affiliates/admin-queries";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Afiliados" };

const VALID_STATUSES = ["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED", "REMOVED"] as const;
const VALID_SORT_BY = ["createdAt", "name", "status"] as const;
const VALID_SORT_DIR = ["asc", "desc"] as const;

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>): AffiliateListFilter {
  const status = searchParams.status;
  const q = searchParams.q;
  const page = searchParams.page;
  const sortBy = searchParams.sortBy;
  const sortDir = searchParams.sortDir;

  const validStatus =
    typeof status === "string" && (VALID_STATUSES as readonly string[]).includes(status)
      ? (status as AffiliateListFilter["status"])
      : "ALL";
  const validQ = typeof q === "string" ? q : undefined;
  const validPage = typeof page === "string" ? Number(page) : undefined;
  const validSortBy =
    typeof sortBy === "string" && (VALID_SORT_BY as readonly string[]).includes(sortBy)
      ? (sortBy as AffiliateListFilter["sortBy"])
      : undefined;
  const validSortDir =
    typeof sortDir === "string" && (VALID_SORT_DIR as readonly string[]).includes(sortDir)
      ? (sortDir as AffiliateListFilter["sortDir"])
      : undefined;

  return {
    status: validStatus,
    q: validQ,
    page: validPage,
    sortBy: validSortBy,
    sortDir: validSortDir,
  };
}

export default async function AffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin("/admin/afiliados");
  const filters = parseSearchParams(await searchParams);
  const result = await getAffiliatesForAdmin(filters);

  // Página vazia (por filtro ou por não haver dados) continua na URL, sem redirect.
  if (result.page > 1 && result.items.length === 0) {
    redirect("/admin/afiliados");
  }

  return (
    <>
      <PageHeader
        title="Afiliados"
        description="Gerencie os cadastros, aprove, suspenda ou remova afiliados do programa."
      />
      <AffiliatesDataTable initial={result} />
    </>
  );
}
