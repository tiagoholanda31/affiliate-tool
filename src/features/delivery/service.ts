/**
 * Entrega digital: grants de download, validação, reenvio e revogação.
 *
 * Token em claro só sai no e-mail / botão da página; no banco fica `tokenHash`.
 * O token vigente também fica em `Order.metadata.activeDownloadToken` para a UI
 * de `/pedido` montar o link sem recriar o grant.
 */
import { addDays } from "date-fns";

import type { DownloadGrant, Prisma } from "@/generated/prisma/client";

import { hashToken, randomToken } from "@/lib/crypto";
import { partsInSaoPaulo, startOfDayInSaoPaulo } from "@/lib/dates";
import { db } from "@/lib/db";
import { conflict, notFound, validation } from "@/lib/errors";

export type Tx = Prisma.TransactionClient;

const MAX_RESENDS_PER_DAY = 3;

export type CreateGrantResult = {
  grant: DownloadGrant;
  /** Token em claro — só usar em e-mail / link; nunca logar. */
  token: string;
};

export type GrantFailureReason = "NOT_FOUND" | "EXPIRED" | "LIMIT" | "REVOKED";

export type ConsumableGrant = {
  grant: DownloadGrant;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
  productName: string;
  fileExt: string;
  publicCode: string;
};

export type ValidateGrantResult =
  | { ok: true; data: ConsumableGrant }
  | { ok: false; reason: GrantFailureReason; publicCode?: string };

type OrderMeta = Record<string, unknown>;

function asMeta(value: unknown): OrderMeta {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as OrderMeta) };
  }
  return {};
}

function extensionFromPath(storagePath: string, mimeType: string): string {
  const fromPath = storagePath.split(".").pop()?.toLowerCase();
  if (fromPath && /^[a-z0-9]{1,8}$/.test(fromPath)) return fromPath;
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "application/epub+zip") return "epub";
  return "bin";
}

/** Nome amigável para Content-Disposition (sem path, sem caracteres perigosos). */
export function downloadFileName(productName: string, ext: string): string {
  const base = productName
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  const safe = base.length > 0 ? base : "download";
  return `${safe}.${ext}`;
}

/** Header RFC 5987: `filename` ASCII + `filename*` UTF-8. */
export function contentDispositionAttachment(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(fileName)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function readDownloadSettings(tx: Tx | typeof db = db) {
  const settings = await tx.setting.findUnique({
    where: { id: 1 },
    select: { downloadGrantDays: true, downloadMaxCount: true },
  });
  return {
    downloadGrantDays: settings?.downloadGrantDays ?? 7,
    downloadMaxCount: settings?.downloadMaxCount ?? 5,
  };
}

/**
 * Cria grant para pedido DIGITAL pago. Revoga grants anteriores ativos.
 * Idempotente no sentido de “um vigente”: sempre gera token novo.
 */
export async function createGrant(
  orderId: string,
  tx: Tx | typeof db = db,
  now: Date = new Date(),
): Promise<CreateGrantResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      metadata: true,
      product: {
        select: {
          type: true,
          digitalFile: { select: { id: true } },
        },
      },
    },
  });

  if (!order) throw notFound("Pedido não encontrado.");
  if (order.status !== "PAID") {
    throw validation("Só pedidos pagos recebem link de download.");
  }
  if (order.product.type !== "DIGITAL" || !order.product.digitalFile) {
    throw validation("Produto sem arquivo digital.");
  }

  const { downloadGrantDays, downloadMaxCount } = await readDownloadSettings(tx);
  const token = randomToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = addDays(now, downloadGrantDays);

  await tx.downloadGrant.updateMany({
    where: { orderId, revokedAt: null },
    data: { revokedAt: now },
  });

  const grant = await tx.downloadGrant.create({
    data: {
      orderId,
      tokenHash,
      expiresAt,
      maxDownloads: downloadMaxCount,
    },
  });

  const meta = asMeta(order.metadata);
  meta.activeDownloadToken = token;
  await tx.order.update({
    where: { id: orderId },
    data: { metadata: meta as Prisma.InputJsonValue },
  });

  return { grant, token };
}

/** Revoga todos os grants do pedido (estorno / chargeback / admin). */
export async function revokeGrantsForOrder(
  orderId: string,
  tx: Tx | typeof db = db,
  now: Date = new Date(),
): Promise<number> {
  const result = await tx.downloadGrant.updateMany({
    where: { orderId, revokedAt: null },
    data: { revokedAt: now },
  });

  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });
  if (order) {
    const meta = asMeta(order.metadata);
    if ("activeDownloadToken" in meta) {
      delete meta.activeDownloadToken;
      await tx.order.update({
        where: { id: orderId },
        data: { metadata: meta as Prisma.InputJsonValue },
      });
    }
  }

  return result.count;
}

function classifyGrant(
  grant: DownloadGrant,
  now: Date,
): GrantFailureReason | null {
  if (grant.revokedAt) return "REVOKED";
  if (grant.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  if (grant.downloadCount >= grant.maxDownloads) return "LIMIT";
  return null;
}

/** Valida token sem consumir (para mensagens de erro). */
export async function validateGrant(
  token: string,
  now: Date = new Date(),
): Promise<ValidateGrantResult> {
  const grant = await db.downloadGrant.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      order: {
        select: {
          publicCode: true,
          productNameSnap: true,
          product: {
            select: {
              digitalFile: {
                select: {
                  storagePath: true,
                  mimeType: true,
                  sizeBytes: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!grant) return { ok: false, reason: "NOT_FOUND" };

  const reason = classifyGrant(grant, now);
  if (reason) {
    return { ok: false, reason, publicCode: grant.order.publicCode };
  }

  const file = grant.order.product.digitalFile;
  if (!file) {
    return { ok: false, reason: "NOT_FOUND", publicCode: grant.order.publicCode };
  }

  return {
    ok: true,
    data: {
      grant,
      storagePath: file.storagePath,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      productName: grant.order.productNameSnap,
      fileExt: extensionFromPath(file.storagePath, file.mimeType),
      publicCode: grant.order.publicCode,
    },
  };
}

/**
 * Valida e incrementa `downloadCount` **antes** do stream (transação).
 * Quem chama deve abrir o stream só se `ok`.
 */
export async function validateAndConsume(
  token: string,
  now: Date = new Date(),
): Promise<ValidateGrantResult> {
  const tokenHash = hashToken(token);

  return db.$transaction(async (tx) => {
    const grant = await tx.downloadGrant.findUnique({
      where: { tokenHash },
      include: {
        order: {
          select: {
            publicCode: true,
            productNameSnap: true,
            product: {
              select: {
                digitalFile: {
                  select: {
                    storagePath: true,
                    mimeType: true,
                    sizeBytes: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!grant) return { ok: false as const, reason: "NOT_FOUND" as const };

    const reason = classifyGrant(grant, now);
    if (reason) {
      return {
        ok: false as const,
        reason,
        publicCode: grant.order.publicCode,
      };
    }

    const file = grant.order.product.digitalFile;
    if (!file) {
      return {
        ok: false as const,
        reason: "NOT_FOUND" as const,
        publicCode: grant.order.publicCode,
      };
    }

    const updated = await tx.downloadGrant.update({
      where: { id: grant.id },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadAt: now,
      },
    });

    return {
      ok: true as const,
      data: {
        grant: updated,
        storagePath: file.storagePath,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        productName: grant.order.productNameSnap,
        fileExt: extensionFromPath(file.storagePath, file.mimeType),
        publicCode: grant.order.publicCode,
      },
    };
  });
}

/** Quantos reenvios já ocorreram hoje (exclui o grant inicial do pagamento). */
export async function countResendsToday(
  orderId: string,
  now: Date = new Date(),
  tx: Tx | typeof db = db,
): Promise<number> {
  const { year, month, day } = partsInSaoPaulo(now);
  const start = startOfDayInSaoPaulo(year, month, day);

  const [todayCount, olderCount] = await Promise.all([
    tx.downloadGrant.count({
      where: { orderId, createdAt: { gte: start } },
    }),
    tx.downloadGrant.count({
      where: { orderId, createdAt: { lt: start } },
    }),
  ]);

  if (olderCount > 0) return todayCount;
  return Math.max(0, todayCount - 1);
}

/**
 * Novo grant + revoga o anterior. Limite: 3 reenvios/dia (America/Sao_Paulo).
 */
export async function resendGrant(
  orderId: string,
  now: Date = new Date(),
): Promise<CreateGrantResult> {
  const resends = await countResendsToday(orderId, now);
  if (resends >= MAX_RESENDS_PER_DAY) {
    throw conflict(
      "Você já pediu o reenvio do link 3 vezes hoje. Tente de novo amanhã ou fale com o suporte.",
    );
  }

  return db.$transaction((tx) => createGrant(orderId, tx, now));
}

/** Grant vigente (não revogado, não expirado) para exibir na UI admin/pedido. */
export async function getActiveGrantSummary(orderId: string, now: Date = new Date()) {
  const grant = await db.downloadGrant.findFirst({
    where: {
      orderId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!grant) return null;

  const remaining = Math.max(0, grant.maxDownloads - grant.downloadCount);
  const metaOrder = await db.order.findUnique({
    where: { id: orderId },
    select: { metadata: true },
  });
  const token =
    typeof asMeta(metaOrder?.metadata).activeDownloadToken === "string"
      ? (asMeta(metaOrder?.metadata).activeDownloadToken as string)
      : null;

  return {
    id: grant.id,
    expiresAt: grant.expiresAt,
    maxDownloads: grant.maxDownloads,
    downloadCount: grant.downloadCount,
    remaining,
    lastDownloadAt: grant.lastDownloadAt,
    token,
  };
}

export async function listGrantsForOrder(orderId: string) {
  return db.downloadGrant.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Rotaciona o `accessToken` do pedido e devolve o token em claro
 * (recuperação por e-mail em `/pedido` sem `?t=`).
 */
export async function rotateOrderAccessToken(orderId: string): Promise<string> {
  const token = randomToken(32);
  await db.order.update({
    where: { id: orderId },
    data: { accessTokenHash: hashToken(token) },
  });
  return token;
}
