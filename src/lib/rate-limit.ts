/**
 * Rate limit por token bucket em memória.
 *
 * O app roda em **uma** instância (ver docs/spec/08), então memória basta e evita
 * a dependência de um Redis. Consequência aceita: reiniciar o container zera os
 * contadores — o sistema falha **aberto**, e isso é registrado no log.
 *
 * Se um dia houver mais de uma instância, trocar a implementação do `Store` aqui
 * é a única mudança necessária: as chamadas não mudam.
 */
import { isDevelopment } from "@/lib/env";
import { logger } from "@/lib/logger";

export type RateLimitRule = {
  /** Quantas requisições são permitidas dentro da janela. */
  limit: number;
  /** Tamanho da janela em milissegundos. */
  windowMs: number;
};

export type RateLimitResult = {
  ok: boolean;
  /** Quantas requisições ainda cabem na janela atual. */
  remaining: number;
  /** Quando a janela zera (para o header `Retry-After`). */
  resetAt: Date;
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Limites definidos em docs/spec/02-arquitetura.md. */
export const RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * MINUTE },
  /**
   * Bloqueio por **conta**, não por IP (docs/spec/04): 5 senhas erradas seguidas
   * travam aquele e-mail por 15 minutos, mesmo que o atacante troque de rede.
   * Só consome em falha, e `reset` limpa no login bem-sucedido.
   */
  loginAttempt: { limit: 5, windowMs: 15 * MINUTE },
  signup: { limit: 5, windowMs: HOUR },
  checkout: { limit: 20, windowMs: HOUR },
  webhook: { limit: 600, windowMs: MINUTE },
  download: { limit: 30, windowMs: HOUR },
  passwordReset: { limit: 5, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Acima disto, limpamos as entradas expiradas para a memória não crescer sem fim. */
const CLEANUP_THRESHOLD = 10_000;

/**
 * Consome uma unidade do balde `name` para a chave `key` (IP, id de usuário, token).
 * Retorna `ok: false` quando o limite estourou.
 */
export function consume(
  name: RateLimitName,
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  // Desligado em desenvolvimento: o dev server fica no ar por horas e os
  // testes e2e repetidos encheriam o balde em memória sem isso.
  if (isDevelopment) {
    return { ok: true, remaining: Number.POSITIVE_INFINITY, resetAt: new Date(now + 60_000) };
  }

  const rule = RATE_LIMITS[name];
  const bucketKey = `${name}:${key}`;

  if (buckets.size > CLEANUP_THRESHOLD) {
    pruneExpired(now);
  }

  const existing = buckets.get(bucketKey);

  if (!existing || existing.resetAt <= now) {
    const bucket: Bucket = { count: 1, resetAt: now + rule.windowMs };
    buckets.set(bucketKey, bucket);
    return { ok: true, remaining: rule.limit - 1, resetAt: new Date(bucket.resetAt) };
  }

  if (existing.count >= rule.limit) {
    logger.warn({ rateLimit: name, key }, "Limite de requisições atingido");
    return { ok: false, remaining: 0, resetAt: new Date(existing.resetAt) };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: rule.limit - existing.count,
    resetAt: new Date(existing.resetAt),
  };
}

/** Consulta sem consumir — útil para exibir tentativas restantes num formulário. */
export function peek(name: RateLimitName, key: string, now: number = Date.now()): RateLimitResult {
  const rule = RATE_LIMITS[name];
  const existing = buckets.get(`${name}:${key}`);

  if (!existing || existing.resetAt <= now) {
    return { ok: true, remaining: rule.limit, resetAt: new Date(now + rule.windowMs) };
  }

  return {
    ok: existing.count < rule.limit,
    remaining: Math.max(0, rule.limit - existing.count),
    resetAt: new Date(existing.resetAt),
  };
}

/** Zera o contador — usado após um login bem-sucedido. */
export function reset(name: RateLimitName, key: string): void {
  buckets.delete(`${name}:${key}`);
}

/** Limpa tudo. Só para os testes. */
export function resetAll(): void {
  buckets.clear();
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
