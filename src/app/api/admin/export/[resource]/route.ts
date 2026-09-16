/**
 * Exportações CSV/XLSX de vendas, comissões e pagamentos (admin).
 * Respeita filtros da URL; máx. 10k linhas; dados mascarados iguais à tela.
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import type { Prisma } from "@/generated/prisma/client";

import { requireAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, startOfDayInSaoPaulo } from "@/lib/dates";
import { db } from "@/lib/db";
import {
  assertExportLimit,
  centsToCsv,
  centsToNumber,
  EXPORT_MAX_ROWS,
  exportFileName,
  toCsv,
  toXlsx,
  type ExportColumn,
  type ExportFormat,
} from "@/lib/export";
import { labelFor } from "@/lib/i18n/pt-BR";
import { AppError, isAppError, toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

type Resource = "vendas" | "comissoes" | "pagamentos";

function parseResource(value: string): Resource | null {
  if (value === "vendas" || value === "comissoes" || value === "pagamentos") return value;
  return null;
}

function parseFormat(value: string | null): ExportFormat {
  return value === "xlsx" ? "xlsx" : "csv";
}

function dayBounds(from?: string | null, to?: string | null): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  const filter: Prisma.DateTimeFilter = {};
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
    const [y, m, d] = from.split("-").map(Number) as [number, number, number];
    filter.gte = startOfDayInSaoPaulo(y, m, d);
  }
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    const [y, m, d] = to.split("-").map(Number) as [number, number, number];
    const end = startOfDayInSaoPaulo(y, m, d);
    filter.lt = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

async function respond<T>(
  resource: Resource,
  format: ExportFormat,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  assertExportLimit(rows.length);
  const filename = exportFileName(resource, format);

  if (format === "csv") {
    const body = toCsv(columns, rows);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const buffer = await toXlsx(columns, rows, resource);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resource: string }> },
) {
  try {
    await requireAdmin();
    const resource = parseResource((await context.params).resource);
    if (!resource) {
      return NextResponse.json({ ok: false, error: "Recurso inválido." }, { status: 400 });
    }

    const sp = request.nextUrl.searchParams;
    const format = parseFormat(sp.get("format"));
    const createdAt = dayBounds(sp.get("from"), sp.get("to"));

    if (resource === "vendas") {
      const where: Prisma.OrderWhereInput = {};
      const status = sp.get("status");
      if (status) where.status = status as Prisma.EnumOrderStatusFilter;
      if (createdAt) where.createdAt = createdAt;

      const total = await db.order.count({ where });
      assertExportLimit(total);
      const rows = await db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: EXPORT_MAX_ROWS,
        select: {
          publicCode: true,
          status: true,
          productNameSnap: true,
          amountCents: true,
          paidAt: true,
          affiliate: { select: { code: true } },
        },
      });

      type Row = (typeof rows)[number];
      const columns: ExportColumn<Row>[] = [
        { key: "publicCode", header: "Pedido", csv: (r) => r.publicCode, xlsx: (r) => r.publicCode },
        {
          key: "status",
          header: "Status",
          csv: (r) => labelFor("orderStatus", r.status),
          xlsx: (r) => labelFor("orderStatus", r.status),
        },
        {
          key: "product",
          header: "Produto",
          csv: (r) => r.productNameSnap,
          xlsx: (r) => r.productNameSnap,
        },
        {
          key: "affiliate",
          header: "Afiliado",
          csv: (r) => r.affiliate?.code ?? "",
          xlsx: (r) => r.affiliate?.code ?? "",
        },
        {
          key: "amount",
          header: "Valor (R$)",
          csv: (r) => centsToCsv(r.amountCents),
          xlsx: (r) => centsToNumber(r.amountCents),
          numFmt: "#.##0,00",
        },
        {
          key: "paidAt",
          header: "Pago em",
          csv: (r) => (r.paidAt ? formatDateTime(r.paidAt) : ""),
          xlsx: (r) => r.paidAt,
        },
      ];
      return await respond(resource, format, columns, rows);
    }

    if (resource === "comissoes") {
      const where: Prisma.CommissionWhereInput = {};
      const status = sp.get("status");
      if (status) where.status = status as Prisma.EnumCommissionStatusFilter;
      const affiliateId = sp.get("affiliateId");
      if (affiliateId) where.affiliateId = affiliateId;
      if (createdAt) where.createdAt = createdAt;

      const total = await db.commission.count({ where });
      assertExportLimit(total);
      const rows = await db.commission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: EXPORT_MAX_ROWS,
        include: {
          affiliate: { select: { code: true, user: { select: { name: true } } } },
          order: { select: { publicCode: true, productNameSnap: true } },
        },
      });

      type Row = (typeof rows)[number];
      const columns: ExportColumn<Row>[] = [
        {
          key: "affiliate",
          header: "Afiliado",
          csv: (r) => r.affiliate.code ?? r.affiliate.user.name,
          xlsx: (r) => r.affiliate.code ?? r.affiliate.user.name,
        },
        {
          key: "order",
          header: "Pedido",
          csv: (r) => r.order.publicCode,
          xlsx: (r) => r.order.publicCode,
        },
        {
          key: "product",
          header: "Produto",
          csv: (r) => r.order.productNameSnap,
          xlsx: (r) => r.order.productNameSnap,
        },
        {
          key: "status",
          header: "Status",
          csv: (r) => labelFor("commissionStatus", r.status),
          xlsx: (r) => labelFor("commissionStatus", r.status),
        },
        {
          key: "amount",
          header: "Comissão (R$)",
          csv: (r) => centsToCsv(r.amountCents),
          xlsx: (r) => centsToNumber(r.amountCents),
          numFmt: "#.##0,00",
        },
        {
          key: "availableAt",
          header: "Disponível em",
          csv: (r) => formatDate(r.availableAt),
          xlsx: (r) => r.availableAt,
        },
      ];
      return await respond(resource, format, columns, rows);
    }

    const where: Prisma.PayoutWhereInput = {};
    const status = sp.get("status");
    if (status === "DRAFT" || status === "PAID") where.status = status;
    const affiliateId = sp.get("affiliateId");
    if (affiliateId) where.affiliateId = affiliateId;
    if (createdAt) where.createdAt = createdAt;

    const total = await db.payout.count({ where });
    assertExportLimit(total);
    const rows = await db.payout.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_MAX_ROWS,
      include: {
        affiliate: { select: { code: true, user: { select: { name: true } } } },
      },
    });

    type Row = (typeof rows)[number];
    const columns: ExportColumn<Row>[] = [
      {
        key: "affiliate",
        header: "Afiliado",
        csv: (r) => r.affiliate.code ?? r.affiliate.user.name,
        xlsx: (r) => r.affiliate.code ?? r.affiliate.user.name,
      },
      {
        key: "status",
        header: "Status",
        csv: (r) => labelFor("payoutStatus", r.status),
        xlsx: (r) => labelFor("payoutStatus", r.status),
      },
      {
        key: "month",
        header: "Mês ref.",
        csv: (r) => r.referenceMonth,
        xlsx: (r) => r.referenceMonth,
      },
      {
        key: "total",
        header: "Total (R$)",
        csv: (r) => centsToCsv(r.totalCents),
        xlsx: (r) => centsToNumber(r.totalCents),
        numFmt: "#.##0,00",
      },
      {
        key: "paidAt",
        header: "Pago em",
        csv: (r) => (r.paidAt ? formatDate(r.paidAt) : ""),
        xlsx: (r) => r.paidAt,
      },
      {
        key: "proof",
        header: "Referência",
        csv: (r) => r.proofReference ?? "",
        xlsx: (r) => r.proofReference ?? "",
      },
    ];
    return await respond(resource, format, columns, rows);
  } catch (error) {
    if (error instanceof Error && error.message.includes("limitada a")) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    if (isAppError(error) && error.expose) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") {
      return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
    }
    logger.error({ err: error }, "Falha na exportação admin");
    return NextResponse.json({ ok: false, error: toUserMessage(error) }, { status: 500 });
  }
}
