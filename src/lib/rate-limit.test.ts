import { beforeEach, describe, expect, it } from "vitest";

import { consume, peek, RATE_LIMITS, reset, resetAll } from "@/lib/rate-limit";

beforeEach(() => {
  resetAll();
});

describe("consume", () => {
  it("permite requisições até o limite da regra", () => {
    const limit = RATE_LIMITS.login.limit;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      const result = consume("login", "1.2.3.4");
      expect(result.ok).toBe(true);
      expect(result.remaining).toBe(limit - attempt);
    }

    const blocked = consume("login", "1.2.3.4");
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("isola chaves diferentes", () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i += 1) {
      consume("login", "1.2.3.4");
    }

    expect(consume("login", "1.2.3.4").ok).toBe(false);
    expect(consume("login", "5.6.7.8").ok).toBe(true);
  });

  it("isola regras diferentes para a mesma chave", () => {
    for (let i = 0; i < RATE_LIMITS.signup.limit; i += 1) {
      consume("signup", "1.2.3.4");
    }

    expect(consume("signup", "1.2.3.4").ok).toBe(false);
    expect(consume("login", "1.2.3.4").ok).toBe(true);
  });

  it("libera de novo quando a janela expira", () => {
    const start = 1_000_000;
    const { windowMs, limit } = RATE_LIMITS.login;

    for (let i = 0; i < limit; i += 1) {
      consume("login", "1.2.3.4", start);
    }
    expect(consume("login", "1.2.3.4", start).ok).toBe(false);

    // Um milissegundo depois do reset, o balde volta cheio.
    const afterWindow = start + windowMs + 1;
    const result = consume("login", "1.2.3.4", afterWindow);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBe(limit - 1);
  });

  it("informa quando a janela zera", () => {
    const start = 1_000_000;
    const result = consume("checkout", "1.2.3.4", start);
    expect(result.resetAt.getTime()).toBe(start + RATE_LIMITS.checkout.windowMs);
  });
});

describe("peek", () => {
  it("consulta sem consumir", () => {
    consume("login", "1.2.3.4");

    const before = peek("login", "1.2.3.4");
    const after = peek("login", "1.2.3.4");

    expect(before.remaining).toBe(RATE_LIMITS.login.limit - 1);
    expect(after.remaining).toBe(before.remaining);
  });

  it("devolve o limite cheio para chave nunca vista", () => {
    expect(peek("download", "token-novo").remaining).toBe(RATE_LIMITS.download.limit);
  });
});

describe("reset", () => {
  it("zera o contador — usado após login bem-sucedido", () => {
    for (let i = 0; i < RATE_LIMITS.login.limit; i += 1) {
      consume("login", "1.2.3.4");
    }
    expect(consume("login", "1.2.3.4").ok).toBe(false);

    reset("login", "1.2.3.4");
    expect(consume("login", "1.2.3.4").ok).toBe(true);
  });
});
