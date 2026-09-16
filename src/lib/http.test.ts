import { describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import {
  badRequest,
  errorResponse,
  getBearerToken,
  getClientIp,
  notFound,
  ok,
  readJson,
  tooManyRequests,
  unauthorized,
} from "@/lib/http";

describe("respostas JSON", () => {
  it("ok devolve 200 com o payload", async () => {
    const response = ok({ ok: true, db: true });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, db: true });
  });

  it("usa o status certo em cada helper", () => {
    expect(badRequest().status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(notFound().status).toBe(404);
  });
});

describe("tooManyRequests", () => {
  it("inclui Retry-After em segundos", () => {
    const resetAt = new Date(Date.now() + 30_000);
    const response = tooManyRequests(resetAt);
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(25);
  });

  it("nunca devolve Retry-After menor que 1", () => {
    const response = tooManyRequests(new Date(Date.now() - 5_000));
    expect(response.headers.get("Retry-After")).toBe("1");
  });
});

describe("errorResponse", () => {
  it("repassa mensagem de AppError exposto", async () => {
    const response = errorResponse(new AppError("NOT_FOUND", "Pedido não encontrado."));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Pedido não encontrado.",
      code: "NOT_FOUND",
    });
  });

  it("esconde detalhe de erro interno", async () => {
    const response = errorResponse(new Error("connection refused em 10.0.0.5:5432"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).not.toContain("10.0.0.5");
  });
});

describe("getClientIp", () => {
  it("usa o primeiro IP de x-forwarded-for (o cliente real atrás do Traefik)", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.9");
  });

  it("cai para x-real-ip", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("devolve um valor neutro quando não há header", () => {
    expect(getClientIp(new Headers())).toBe("0.0.0.0");
  });
});

describe("getBearerToken", () => {
  it("extrai o token do header Authorization", () => {
    expect(getBearerToken(new Headers({ authorization: "Bearer abc123" }))).toBe("abc123");
    expect(getBearerToken(new Headers({ authorization: "bearer abc123" }))).toBe("abc123");
  });

  it("devolve null quando o header falta ou é de outro esquema", () => {
    expect(getBearerToken(new Headers())).toBeNull();
    expect(getBearerToken(new Headers({ authorization: "Basic abc" }))).toBeNull();
    expect(getBearerToken(new Headers({ authorization: "Bearer   " }))).toBeNull();
  });
});

describe("readJson", () => {
  it("lê o corpo JSON", async () => {
    const request = new Request("http://localhost/x", {
      method: "POST",
      body: JSON.stringify({ id: 1 }),
    });
    await expect(readJson<{ id: number }>(request)).resolves.toEqual({ id: 1 });
  });

  it("transforma corpo inválido em AppError de validação", async () => {
    const request = new Request("http://localhost/x", { method: "POST", body: "{ isso não" });
    await expect(readJson(request)).rejects.toThrow(AppError);
  });
});
