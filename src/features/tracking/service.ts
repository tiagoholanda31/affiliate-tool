/**
 * Regras de clique e atribuição — funções testáveis + gravação no banco.
 *
 * O Route Handler `/r/...` é fino: resolve afiliado/produto, chama daqui,
 * seta cookie e redireciona. Persistência de clique é fire-and-forget
 * (`void` + catch/log) para manter o p95 do redirect baixo.
 */
import { randomBytes } from "node:crypto";

import { isBotUserAgent } from "@/features/tracking/bots";
import { getAffiliateByCodeCached } from "@/features/tracking/queries";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { partsInSaoPaulo, toIsoDate } from "@/lib/dates";

const UNIQUE_WINDOW_MS = 24 * 60 * 60 * 1000;
const PURGE_RETENTION_MONTHS = 13;

/** Salt diário: `sha256(REF_COOKIE_SECRET + ":" + YYYY-MM-DD)` em São Paulo. */
export function dailySalt(now: Date = new Date(), secret: string = env.REF_COOKIE_SECRET): string {
  const { year, month, day } = partsInSaoPaulo(now);
  const dateKey = `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return sha256(`${secret}:${dateKey}`);
}

/** `ipHash = sha256(ip + saltDoDia)`. */
export function hashIp(ip: string, now: Date = new Date()): string {
  return sha256(`${ip}${dailySalt(now)}`);
}

export function hashUserAgent(userAgent: string): string {
  return sha256(userAgent);
}

/**
 * Clique único se não houver outro do mesmo `ipHash`+afiliado nas últimas 24 h.
 * Puro — recebe a lista (ou flag) para testes unitários.
 */
export function computeIsUnique(hadRecentClick: boolean): boolean {
  return !hadRecentClick;
}

export type RecordClickInput = {
  affiliateId: string;
  productId?: string | null;
  ip: string;
  userAgent: string | null | undefined;
  referer: string | null | undefined;
  now?: Date;
};

export type RecordClickResult = {
  clickId: string;
  isUnique: boolean;
  isBot: boolean;
};

/**
 * Grava o clique. O id é gerado antes do insert para o handler poder setar o
 * cookie e redirecionar sem esperar o banco (`void` + catch/log).
 */
export async function recordClick(input: RecordClickInput): Promise<RecordClickResult> {
  const now = input.now ?? new Date();
  const ipHash = hashIp(input.ip, now);
  const ua = input.userAgent?.trim() ?? "";
  const uaHash = hashUserAgent(ua === "" ? "unknown" : ua);
  const isBot = isBotUserAgent(input.userAgent);
  const clickId = newClickId();

  const since = new Date(now.getTime() - UNIQUE_WINDOW_MS);
  const recent = await db.click.findFirst({
    where: {
      affiliateId: input.affiliateId,
      ipHash,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  const isUnique = computeIsUnique(Boolean(recent));

  await db.click.create({
    data: {
      id: clickId,
      affiliateId: input.affiliateId,
      productId: input.productId ?? null,
      ipHash,
      uaHash,
      referer: input.referer?.slice(0, 500) ?? null,
      isUnique,
      isBot,
      createdAt: now,
    },
  });

  return { clickId, isUnique, isBot };
}

/** Id estilo cuid o bastante curto para o JWT; não precisa ser criptográfico. */
export function newClickId(): string {
  return `clk_${randomBytes(12).toString("base64url")}`;
}

/**
 * Prepara o clique (id + hashes) e dispara o insert em background.
 * O handler usa o `clickId` imediatamente no cookie.
 */
export async function prepareClick(input: RecordClickInput): Promise<RecordClickResult> {
  const now = input.now ?? new Date();
  const ipHash = hashIp(input.ip, now);
  const ua = input.userAgent?.trim() ?? "";
  const uaHash = hashUserAgent(ua === "" ? "unknown" : ua);
  const isBot = isBotUserAgent(input.userAgent);
  const clickId = newClickId();

  const since = new Date(now.getTime() - UNIQUE_WINDOW_MS);
  const recent = await db.click.findFirst({
    where: {
      affiliateId: input.affiliateId,
      ipHash,
      createdAt: { gte: since },
    },
    select: { id: true },
  });

  const isUnique = computeIsUnique(Boolean(recent));

  void db.click
    .create({
      data: {
        id: clickId,
        affiliateId: input.affiliateId,
        productId: input.productId ?? null,
        ipHash,
        uaHash,
        referer: input.referer?.slice(0, 500) ?? null,
        isUnique,
        isBot,
        createdAt: now,
      },
    })
    .catch((err: unknown) => {
      logger.error({ err, affiliateId: input.affiliateId, clickId }, "Falha ao gravar clique");
    });

  return { clickId, isUnique, isBot };
}

/** Apaga cliques com mais de 13 meses. Retorna quantos foram removidos. */
export async function purgeOldClicks(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - PURGE_RETENTION_MONTHS);

  const result = await db.click.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return result.count;
}

export type AffiliateForRedirect = {
  id: string;
  code: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED" | "REMOVED";
};

/**
 * Só `APPROVED` gera clique e cookie. Demais status (ou código inexistente)
 * redirecionam ao destino sem atribuição.
 */
export function shouldTrackAffiliate(status: AffiliateForRedirect["status"]): boolean {
  return status === "APPROVED";
}

export type ResolveRedirectResult = {
  destination: string;
  /** Query `?aviso=` quando o slug não existe. */
  toast?: "produto-nao-encontrado";
  affiliate: AffiliateForRedirect | null;
  productId: string | null;
};

/**
 * Destino do 302 e se deve rastrear. Não grava clique — isso fica no handler.
 */
export async function resolveRedirectTarget(
  code: string,
  slug: string | undefined,
): Promise<ResolveRedirectResult> {
  const affiliate = await getAffiliateByCodeCached(code);

  if (!affiliate?.code) {
    return {
      destination: "/",
      affiliate: null,
      productId: null,
    };
  }

  const affiliateForRedirect: AffiliateForRedirect = {
    id: affiliate.id,
    code: affiliate.code,
    status: affiliate.status,
  };

  if (!slug) {
    return {
      destination: "/",
      affiliate: affiliateForRedirect,
      productId: null,
    };
  }

  const product = await db.product.findFirst({
    where: {
      OR: [{ slug }, { slugHistory: { some: { slug } } }],
      status: "ACTIVE",
    },
    select: { id: true, slug: true },
  });

  if (!product) {
    return {
      destination: "/?aviso=produto-nao-encontrado",
      toast: "produto-nao-encontrado",
      affiliate: affiliateForRedirect,
      productId: null,
    };
  }

  return {
    destination: `/p/${product.slug}`,
    affiliate: affiliateForRedirect,
    productId: product.id,
  };
}

/** Fire-and-forget com log — não atrasa o 302. */
/** Fire-and-forget com log — não atrasa o 302. Preferir `prepareClick`. */
export function recordClickInBackground(input: RecordClickInput): Promise<RecordClickResult> {
  return prepareClick(input);
}

export { toIsoDate };
