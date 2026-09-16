/**
 * Domínio de lotes de pagamento (Payout): rascunho, pagamento, descarte e ajustes.
 */
import type {
  Commission,
  CommissionAdjustment,
  Payout,
  Prisma,
} from "@/generated/prisma/client";

import { getBalances } from "@/features/commissions/service";
import { partsInSaoPaulo, toReferenceMonth } from "@/lib/dates";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { sumCents } from "@/lib/money";

export type Tx = Prisma.TransactionClient;

export type BuildPayoutDraftInput = {
  commissionIds?: string[];
  /** YYYY-MM; default = mês atual em America/Sao_Paulo. */
  referenceMonth?: string;
};

export type MarkPayoutPaidInput = {
  paidAt: Date;
  proofReference?: string | null;
  proofPath?: string | null;
  notes?: string | null;
};

const REFERENCE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function assertReferenceMonth(value: string): void {
  if (!REFERENCE_MONTH_RE.test(value)) {
    throw new AppError("VALIDATION", "Mês de referência inválido. Use YYYY-MM.");
  }
}

type DbClient = typeof db | Tx;

/** Seleciona AVAILABLE livres (+ ajustes abertos), valida total > 0 e cria DRAFT. */
export async function buildPayoutDraft(
  affiliateId: string,
  input: BuildPayoutDraftInput,
  createdById: string,
  tx: DbClient = db,
): Promise<Payout> {
  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, status: true },
  });
  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  const referenceMonth = input.referenceMonth ?? toReferenceMonth();
  assertReferenceMonth(referenceMonth);

  const commissionWhere: Prisma.CommissionWhereInput = {
    affiliateId,
    status: "AVAILABLE",
    payoutId: null,
  };
  if (input.commissionIds && input.commissionIds.length > 0) {
    commissionWhere.id = { in: input.commissionIds };
  }

  const commissions = await tx.commission.findMany({
    where: commissionWhere,
    orderBy: { availableAt: "asc" },
  });

  if (input.commissionIds && input.commissionIds.length > 0) {
    const found = new Set(commissions.map((c) => c.id));
    const missing = input.commissionIds.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new AppError(
        "VALIDATION",
        "Uma ou mais comissões não estão disponíveis para este lote.",
        { meta: { missing } },
      );
    }
  }

  if (commissions.length === 0) {
    throw new AppError("VALIDATION", "Não há comissões disponíveis para gerar o lote.");
  }

  const adjustments = await tx.commissionAdjustment.findMany({
    where: { affiliateId, payoutId: null },
    orderBy: { createdAt: "asc" },
  });

  const commissionsTotal = sumCents(commissions.map((c) => c.amountCents));
  const adjustmentsTotal = sumCents(adjustments.map((a) => a.amountCents));
  const totalCents = commissionsTotal + adjustmentsTotal;

  if (totalCents <= 0) {
    throw new AppError(
      "VALIDATION",
      "O total do lote precisa ser maior que zero. Confira os ajustes abertos.",
      { meta: { commissionsTotal, adjustmentsTotal, totalCents } },
    );
  }

  const payout = await tx.payout.create({
    data: {
      affiliateId,
      status: "DRAFT",
      totalCents,
      referenceMonth,
      createdById,
    },
  });

  await tx.commission.updateMany({
    where: { id: { in: commissions.map((c) => c.id) } },
    data: { payoutId: payout.id },
  });

  if (adjustments.length > 0) {
    await tx.commissionAdjustment.updateMany({
      where: { id: { in: adjustments.map((a) => a.id) } },
      data: { payoutId: payout.id },
    });
  }

  return payout;
}

/**
 * Marca DRAFT como PAID. Exige proofReference ou proofPath; paidAt ≤ fim do dia SP.
 * Comissões → PAID. E-mail/n8n ficam para o chamador pós-commit.
 */
export async function markPayoutPaid(
  payoutId: string,
  input: MarkPayoutPaidInput,
  tx: DbClient = db,
  now: Date = new Date(),
): Promise<Payout> {
  const payout = await tx.payout.findUnique({
    where: { id: payoutId },
    include: {
      commissions: true,
      adjustments: true,
    },
  });
  if (!payout) {
    throw new AppError("NOT_FOUND", "Lote de pagamento não encontrado.");
  }
  if (payout.status !== "DRAFT") {
    throw new AppError("INVALID_TRANSITION", "Só é possível pagar um lote em rascunho.");
  }

  const proofReference = input.proofReference?.trim() ?? null;
  const proofPath = input.proofPath?.trim() ?? null;
  if (!proofReference && !proofPath) {
    throw new AppError(
      "VALIDATION",
      "Informe a referência da transferência Pix ou anexe o comprovante.",
    );
  }

  assertPaidAtNotFuture(input.paidAt, now);

  const commissionIds = payout.commissions.map((c) => c.id);
  if (commissionIds.length === 0) {
    throw new AppError("VALIDATION", "O lote não tem comissões para pagar.");
  }

  const stillAvailable = payout.commissions.every(
    (c) => c.status === "AVAILABLE" && c.payoutId === payout.id,
  );
  if (!stillAvailable) {
    throw new AppError(
      "CONFLICT",
      "Uma ou mais comissões do lote mudaram de status. Descarte e gere novamente.",
    );
  }

  await tx.commission.updateMany({
    where: { id: { in: commissionIds } },
    data: {
      status: "PAID",
      paidAt: input.paidAt,
    },
  });

  return tx.payout.update({
    where: { id: payoutId },
    data: {
      status: "PAID",
      paidAt: input.paidAt,
      proofReference,
      proofPath,
      notes: input.notes?.trim() ?? null,
    },
  });
}

/** Desfaz DRAFT: limpa vínculos e apaga o lote. */
export async function discardDraft(
  payoutId: string,
  tx: DbClient = db,
): Promise<void> {
  const payout = await tx.payout.findUnique({ where: { id: payoutId } });
  if (!payout) {
    throw new AppError("NOT_FOUND", "Lote de pagamento não encontrado.");
  }
  if (payout.status !== "DRAFT") {
    throw new AppError("INVALID_TRANSITION", "Só é possível descartar um lote em rascunho.");
  }

  await tx.commission.updateMany({
    where: { payoutId },
    data: { payoutId: null },
  });
  await tx.commissionAdjustment.updateMany({
    where: { payoutId },
    data: { payoutId: null },
  });
  await tx.payout.delete({ where: { id: payoutId } });
}

/** Remove uma comissão de um lote DRAFT e recalcula o total. */
export async function removeCommissionFromDraft(
  payoutId: string,
  commissionId: string,
  tx: DbClient = db,
): Promise<Payout> {
  const payout = await tx.payout.findUnique({
    where: { id: payoutId },
    include: { commissions: true, adjustments: true },
  });
  if (!payout) {
    throw new AppError("NOT_FOUND", "Lote de pagamento não encontrado.");
  }
  if (payout.status !== "DRAFT") {
    throw new AppError("INVALID_TRANSITION", "Só é possível editar um lote em rascunho.");
  }

  const target = payout.commissions.find((c) => c.id === commissionId);
  if (!target) {
    throw new AppError("NOT_FOUND", "Comissão não pertence a este lote.");
  }

  const remaining = payout.commissions.filter((c) => c.id !== commissionId);
  if (remaining.length === 0) {
    throw new AppError(
      "VALIDATION",
      "O lote precisa ter ao menos uma comissão. Descarte o rascunho se quiser cancelar.",
    );
  }

  await tx.commission.update({
    where: { id: commissionId },
    data: { payoutId: null },
  });

  const commissionsTotal = sumCents(remaining.map((c) => c.amountCents));
  const adjustmentsTotal = sumCents(payout.adjustments.map((a) => a.amountCents));
  const totalCents = commissionsTotal + adjustmentsTotal;

  if (totalCents <= 0) {
    throw new AppError(
      "VALIDATION",
      "Após remover, o total ficaria zerado ou negativo. Descarte o rascunho.",
    );
  }

  return tx.payout.update({
    where: { id: payoutId },
    data: { totalCents },
  });
}

/** Cria ajuste manual (±) com motivo. */
export async function createManualAdjustment(
  affiliateId: string,
  amountCents: number,
  reason: string,
  createdById: string,
  tx: DbClient = db,
): Promise<CommissionAdjustment> {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) {
    throw new AppError("VALIDATION", "Informe um valor diferente de zero (em centavos).");
  }
  const trimmed = reason.trim();
  if (trimmed.length < 3) {
    throw new AppError("VALIDATION", "Informe o motivo do ajuste (mínimo 3 caracteres).");
  }

  const affiliate = await tx.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true },
  });
  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  return tx.commissionAdjustment.create({
    data: {
      affiliateId,
      amountCents,
      reason: trimmed,
      createdById,
    },
  });
}

/** Garante paidAt não é no futuro (fim do dia SP). */
export function assertPaidAtNotFuture(paidAt: Date, now: Date = new Date()): void {
  if (Number.isNaN(paidAt.getTime())) {
    throw new AppError("VALIDATION", "Data de pagamento inválida.");
  }
  const paid = partsInSaoPaulo(paidAt);
  const today = partsInSaoPaulo(now);
  const paidKey = paid.year * 10_000 + paid.month * 100 + paid.day;
  const todayKey = today.year * 10_000 + today.month * 100 + today.day;
  if (paidKey > todayKey) {
    throw new AppError("VALIDATION", "A data do pagamento não pode ser no futuro.");
  }
}

/** Recalcula total a partir dos itens vinculados (útil em testes/admin). */
export function computePayoutTotal(
  commissions: Pick<Commission, "amountCents">[],
  adjustments: Pick<CommissionAdjustment, "amountCents">[],
): number {
  return sumCents(commissions.map((c) => c.amountCents)) +
    sumCents(adjustments.map((a) => a.amountCents));
}

/** Snapshot de saldo após reservar (para UI/testes). */
export async function getAvailableAfterDraft(
  affiliateId: string,
  tx: Parameters<typeof getBalances>[1] = db,
): Promise<number> {
  const balances = await getBalances(affiliateId, tx);
  return balances.availableCents;
}
