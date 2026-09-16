/**
 * Cliente HTTP tipado da Pagar.me Core API v5.
 * Basic Auth com `secret_key:` (senha vazia). Timeout 15 s; retry 2× em 5xx/429.
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { PagarmeError } from "@/server/pagarme/types";

const BASE_URL = "https://api.pagar.me/core/v5";
const TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;

function authHeader(): string {
  const secret = env.PAGARME_SECRET_KEY;
  if (!secret) {
    throw new PagarmeError("MISSING_KEY", "PAGARME_SECRET_KEY não configurada.");
  }
  return `Basic ${Buffer.from(`${secret}:`, "utf8").toString("base64")}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jitter(attempt: number): number {
  const base = 300 * 2 ** attempt;
  return base + Math.floor(Math.random() * 200);
}

/** Mascara IDs longos e dados sensíveis nos logs. */
function maskForLog(body: unknown): unknown {
  if (body == null || typeof body !== "object") return body;
  const clone = structuredClone(body) as Record<string, unknown>;
  if (typeof clone.card_token === "string") clone.card_token = "[redacted]";
  if (clone.customer && typeof clone.customer === "object") {
    const customer = clone.customer as Record<string, unknown>;
    if (typeof customer.document === "string") {
      customer.document = `***${customer.document.slice(-4)}`;
    }
    if (typeof customer.email === "string") {
      const at = customer.email.indexOf("@");
      customer.email =
        at > 0 ? `${customer.email.slice(0, 2)}***${customer.email.slice(at)}` : "***";
    }
  }
  return clone;
}

export type PagarmeRequestOptions = {
  method: "GET" | "POST" | "DELETE" | "PATCH";
  path: string;
  body?: unknown;
};

export async function pagarmeFetch<T>(options: PagarmeRequestOptions): Promise<T> {
  const url = `${BASE_URL}${options.path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: options.method,
        headers: {
          Authorization: authHeader(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });

      const text = await response.text();
      let json: unknown = null;
      if (text) {
        try {
          json = JSON.parse(text) as unknown;
        } catch {
          json = { raw: text };
        }
      }

      if (response.ok) {
        return json as T;
      }

      const retryable = response.status === 429 || response.status >= 500;
      if (retryable && attempt < MAX_RETRIES) {
        logger.warn(
          { status: response.status, path: options.path, attempt },
          "Pagar.me: retry após erro transitório",
        );
        await sleep(jitter(attempt));
        continue;
      }

      const message =
        json && typeof json === "object" && "message" in json && typeof json.message === "string"
          ? json.message
          : `Pagar.me respondeu ${String(response.status)}.`;

      logger.error(
        {
          status: response.status,
          path: options.path,
          body: maskForLog(options.body),
          response: maskForLog(json),
        },
        "Pagar.me: erro na API",
      );

      throw new PagarmeError(String(response.status), message, json);
    } catch (error) {
      lastError = error;
      if (error instanceof PagarmeError) throw error;

      const isAbort = error instanceof Error && error.name === "AbortError";
      if (attempt < MAX_RETRIES) {
        logger.warn(
          { path: options.path, attempt, abort: isAbort },
          "Pagar.me: retry após falha de rede",
        );
        await sleep(jitter(attempt));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new PagarmeError(
    "NETWORK",
    "Não foi possível falar com o Pagar.me.",
    lastError,
  );
}
