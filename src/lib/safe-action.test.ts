import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AppSession } from "@/lib/auth";
import type { AuditEntry } from "@/lib/audit";

/**
 * Os três módulos abaixo são substituídos porque só existem dentro de uma
 * requisição do Next (`next/headers`) ou tocam banco (`auth`, `audit`). O que
 * está sob teste é a ordem das checagens do wrapper, não a infraestrutura.
 */
const getSession = vi.fn<() => Promise<AppSession | null>>();
const recordAudit = vi.fn<(entry: AuditEntry) => Promise<void>>();

vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/audit", () => ({ recordAudit: (entry: AuditEntry) => recordAudit(entry) }));
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.7" })),
}));

const { adminAction, authedAction, publicAction } = await import("@/lib/safe-action");

const schema = z.object({ nome: z.string().min(3, "Nome curto demais.") });

function session(role: "ADMIN" | "AFFILIATE"): AppSession {
  return {
    sessionId: "ses_1",
    user: { id: "usr_1", name: "Maria", email: "maria@exemplo.com", emailVerified: true, role },
  };
}

beforeEach(() => {
  getSession.mockReset();
  recordAudit.mockReset();
  recordAudit.mockResolvedValue(undefined);
});

describe("authedAction", () => {
  it("recusa sem sessão, sem sequer olhar a entrada", async () => {
    getSession.mockResolvedValue(null);
    const handler = vi.fn();

    const action = authedAction({ name: "teste", schema, handler });
    const result = await action({ nome: "ok" });

    expect(result).toEqual({ ok: false, error: "Sua sessão expirou. Entre novamente." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("devolve fieldErrors no formato que o formulário consome", async () => {
    getSession.mockResolvedValue(session("AFFILIATE"));
    const handler = vi.fn();

    const action = authedAction({ name: "teste", schema, handler });
    const result = await action({ nome: "ab" });

    expect(result).toEqual({
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { nome: ["Nome curto demais."] },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("entrega ao handler a entrada já validada e o IP do cliente", async () => {
    getSession.mockResolvedValue(session("AFFILIATE"));
    const handler = vi.fn().mockResolvedValue({ feito: true });

    const action = authedAction({ name: "teste", schema, handler });
    const result = await action({ nome: "Maria" });

    expect(result).toEqual({ ok: true, data: { feito: true } });
    expect(handler).toHaveBeenCalledWith(
      { nome: "Maria" },
      expect.objectContaining({ ip: "203.0.113.7" }),
    );
  });

  it("expõe a mensagem de AppError de negócio", async () => {
    getSession.mockResolvedValue(session("AFFILIATE"));
    const { AppError } = await import("@/lib/errors");

    const action = authedAction({
      name: "teste",
      schema,
      handler: () => Promise.reject(new AppError("CONFLICT", "Esse código já existe.")),
    });

    expect(await action({ nome: "Maria" })).toEqual({
      ok: false,
      error: "Esse código já existe.",
    });
  });

  it("esconde o detalhe de erro inesperado atrás de mensagem genérica", async () => {
    getSession.mockResolvedValue(session("AFFILIATE"));

    const action = authedAction({
      name: "teste",
      schema,
      handler: () => Promise.reject(new Error("connect ECONNREFUSED 10.0.0.5:5432")),
    });

    expect(await action({ nome: "Maria" })).toEqual({
      ok: false,
      error: "Algo deu errado. Tente novamente.",
    });
  });
});

describe("adminAction", () => {
  it("recusa quem não é admin", async () => {
    getSession.mockResolvedValue(session("AFFILIATE"));
    const handler = vi.fn();

    const action = adminAction({ name: "teste", schema, handler });
    const result = await action({ nome: "Maria" });

    expect(result).toEqual({ ok: false, error: "Você não tem permissão para esta ação." });
    expect(handler).not.toHaveBeenCalled();
  });

  it("grava auditoria com autor, papel e IP do contexto", async () => {
    getSession.mockResolvedValue(session("ADMIN"));

    const action = adminAction({
      name: "teste",
      schema,
      handler: () => Promise.resolve({ id: "aff_9" }),
      audit: (result) => ({
        action: "affiliate.approve",
        entity: "Affiliate",
        entityId: result.id,
        after: { status: "APPROVED" },
      }),
    });

    await action({ nome: "Maria" });

    expect(recordAudit).toHaveBeenCalledWith({
      action: "affiliate.approve",
      entity: "Affiliate",
      entityId: "aff_9",
      after: { status: "APPROVED" },
      actorId: "usr_1",
      actorRole: "ADMIN",
      ip: "203.0.113.7",
    });
  });

  it("não audita quando a fábrica devolve null", async () => {
    getSession.mockResolvedValue(session("ADMIN"));

    const action = adminAction({
      name: "teste",
      schema,
      handler: () => Promise.resolve({ id: "aff_9" }),
      audit: () => null,
    });

    await action({ nome: "Maria" });
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("não audita quando o handler falhou", async () => {
    getSession.mockResolvedValue(session("ADMIN"));

    const action = adminAction({
      name: "teste",
      schema,
      handler: () => Promise.reject(new Error("falhou")),
      audit: () => ({ action: "x", entity: "y", entityId: "z" }),
    });

    await action({ nome: "Maria" });
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

describe("publicAction", () => {
  it("roda sem sessão nenhuma", async () => {
    getSession.mockResolvedValue(null);

    const action = publicAction({
      name: "teste",
      schema,
      handler: (input) => Promise.resolve({ eco: input.nome }),
    });

    expect(await action({ nome: "Maria" })).toEqual({ ok: true, data: { eco: "Maria" } });
    expect(getSession).not.toHaveBeenCalled();
  });

  it("valida a entrada como as demais", async () => {
    const action = publicAction({
      name: "teste",
      schema,
      handler: () => Promise.resolve(null),
    });

    const result = await action({ nome: "ab" });
    expect(result).toEqual({
      ok: false,
      error: "Confira os campos destacados.",
      fieldErrors: { nome: ["Nome curto demais."] },
    });
  });
});
