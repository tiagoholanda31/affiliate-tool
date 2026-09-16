/**
 * Exportações CSV (UTF-8 BOM) e XLSX (exceljs) para listagens admin.
 *
 * Limite: 10_000 linhas. Nome sugerido: `affiliate-<recurso>-<yyyymmdd>.csv`.
 */
import ExcelJS from "exceljs";

import { toIsoDate } from "@/lib/dates";
import { formatAmount } from "@/lib/money";

export const EXPORT_MAX_ROWS = 10_000;

export type ExportColumn<T> = {
  key: string;
  header: string;
  /** Valor textual para CSV. */
  csv: (row: T) => string;
  /** Valor tipado para XLSX (número fica numérico). */
  xlsx: (row: T) => string | number | Date | null | undefined;
  /** Formato exceljs para colunas numéricas (ex. `#.##0,00`). */
  numFmt?: string;
};

export type ExportFormat = "csv" | "xlsx";

/** Nome de arquivo padrão: `affiliate-vendas-20260910.csv`. */
export function exportFileName(resource: string, format: ExportFormat, now = new Date()): string {
  const day = toIsoDate(now).replaceAll("-", "");
  return `affiliate-${resource}-${day}.${format}`;
}

/** Centavos → número decimal para XLSX (não texto). */
export function centsToNumber(cents: number): number {
  return cents / 100;
}

/** Valor monetário formatado pt-BR sem símbolo (CSV). */
export function centsToCsv(cents: number): string {
  return formatAmount(cents);
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r;]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

/** CSV UTF-8 com BOM; separador `;` (abre certo no Excel pt-BR). */
export function toCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(";");
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvCell(c.csv(row))).join(";"),
  );
  return `\uFEFF${[header, ...body].join("\r\n")}`;
}

/** Gera buffer XLSX com tipos numéricos quando `xlsx` devolve number. */
export async function toXlsx<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  sheetName = "Dados",
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Affiliate Tool";
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31));

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key: c.key,
    width: Math.min(40, Math.max(12, c.header.length + 2)),
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  for (const row of rows) {
    const values: Record<string, string | number | Date | null | undefined> = {};
    for (const col of columns) {
      values[col.key] = col.xlsx(row);
    }
    const added = sheet.addRow(values);
    columns.forEach((col, index) => {
      if (col.numFmt) {
        added.getCell(index + 1).numFmt = col.numFmt;
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function assertExportLimit(count: number): void {
  if (count > EXPORT_MAX_ROWS) {
    throw new Error(
      `A exportação está limitada a ${String(EXPORT_MAX_ROWS)} linhas. Refine os filtros.`,
    );
  }
}
