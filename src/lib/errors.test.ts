import { describe, expect, it } from "vitest";

import {
  AppError,
  conflict,
  forbidden,
  GENERIC_ERROR_MESSAGE,
  internal,
  invalidTransition,
  isAppError,
  notFound,
  rateLimited,
  toUserMessage,
  unauthenticated,
  validation,
} from "@/lib/errors";

describe("AppError", () => {
  it("usa o status HTTP padrão do código", () => {
    expect(new AppError("NOT_FOUND", "x").status).toBe(404);
    expect(new AppError("FORBIDDEN", "x").status).toBe(403);
    expect(new AppError("RATE_LIMITED", "x").status).toBe(429);
    expect(new AppError("INVALID_TRANSITION", "x").status).toBe(409);
  });

  it("aceita status customizado", () => {
    expect(new AppError("VALIDATION", "x", { status: 400 }).status).toBe(400);
  });

  it("expõe erros de domínio e esconde os internos por padrão", () => {
    expect(new AppError("VALIDATION", "x").expose).toBe(true);
    expect(new AppError("INTERNAL", "x").expose).toBe(false);
  });

  it("preserva a causa original para o log", () => {
    const cause = new Error("timeout no banco");
    expect(new AppError("INTERNAL", "falhou", { cause }).cause).toBe(cause);
  });

  it("guarda contexto em meta", () => {
    const error = new AppError("CONFLICT", "x", { meta: { orderId: "abc" } });
    expect(error.meta).toEqual({ orderId: "abc" });
  });

  it("continua sendo um Error de verdade", () => {
    const error = new AppError("NOT_FOUND", "sumiu");
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("sumiu");
    expect(error.name).toBe("AppError");
  });
});

describe("isAppError", () => {
  it("distingue AppError de outros erros", () => {
    expect(isAppError(new AppError("NOT_FOUND", "x"))).toBe(true);
    expect(isAppError(new Error("x"))).toBe(false);
    expect(isAppError("x")).toBe(false);
    expect(isAppError(null)).toBe(false);
  });
});

describe("toUserMessage", () => {
  it("mostra a mensagem de erros expostos", () => {
    expect(toUserMessage(notFound("Pedido não encontrado."))).toBe("Pedido não encontrado.");
  });

  it("esconde detalhe de erro interno", () => {
    expect(toUserMessage(internal("connection refused em 10.0.0.5:5432"))).toBe(
      GENERIC_ERROR_MESSAGE,
    );
  });

  it("esconde detalhe de erro desconhecido", () => {
    expect(toUserMessage(new Error("stack trace do Prisma"))).toBe(GENERIC_ERROR_MESSAGE);
    expect(toUserMessage("qualquer coisa")).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe("atalhos", () => {
  it("criam erros com o código correto", () => {
    expect(unauthenticated().code).toBe("UNAUTHENTICATED");
    expect(forbidden().code).toBe("FORBIDDEN");
    expect(notFound().code).toBe("NOT_FOUND");
    expect(validation("x").code).toBe("VALIDATION");
    expect(rateLimited().code).toBe("RATE_LIMITED");
    expect(conflict("x").code).toBe("CONFLICT");
    expect(internal("x").code).toBe("INTERNAL");
  });

  it("invalidTransition descreve a transição negada", () => {
    const error = invalidTransition("PENDING", "PAID");
    expect(error.message).toBe("Não é possível mudar de PENDING para PAID.");
    expect(error.meta).toEqual({ from: "PENDING", to: "PAID" });
    expect(error.status).toBe(409);
  });
});
