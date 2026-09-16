/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { describe, expect, it, vi } from "vitest";

import type { AffiliateStatus } from "@/generated/prisma/enums";
import {
  generateAffiliateCode,
  generateUniqueAffiliateCode,
  isValidVanityCode,
  transitionAffiliate,
  updateAffiliateCode,
} from "@/features/affiliates/admin-service";
import { AppError } from "@/lib/errors";

/** Prisma-like mínimo para testar geração de código sem banco. */
function createPrismaLike(usedCodes: string[] = []) {
  const findUniqueByCode = vi.fn(async ({ where }: { where: { code?: string } }) => {
    if (where.code && usedCodes.includes(where.code)) {
      return { id: "used" };
    }
    return null;
  });

  const tx = {
    affiliate: {
      findUnique: findUniqueByCode as unknown as Parameters<typeof transitionAffiliate>[3]["affiliate"]["findUnique"],
    },
    session: { deleteMany: vi.fn(async () => ({ count: 0 })) as unknown as Parameters<typeof transitionAffiliate>[3]["session"]["deleteMany"] },
    auditLog: { create: vi.fn(async () => ({ id: "audit" })) as unknown as Parameters<typeof transitionAffiliate>[3]["auditLog"]["create"] },
    user: { update: vi.fn(async () => ({ id: "user" })) as unknown as Parameters<typeof transitionAffiliate>[3]["user"]["update"] },
  };

  return tx as unknown as Parameters<typeof transitionAffiliate>[3];
}

/** Mock que distingue busca por id vs busca por code. */
function createAffiliateTx(usedCodes: string[] = [], affiliateOverrides: { code?: string | null } = {}) {
  const tx = createPrismaLike(usedCodes);
  const originalFindUnique = tx.affiliate.findUnique;

  tx.affiliate.findUnique = vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
    if (where.id) {
      return {
        id: "aff-1",
        userId: "user-1",
        status: "PENDING" as AffiliateStatus,
        code: affiliateOverrides.code ?? null,
        statusReason: null,
        user: { id: "user-1", name: "Maria", email: "maria@exemplo.test" },
      };
    }
    return originalFindUnique({ where } as Parameters<typeof tx.affiliate.findUnique>[0]);
  }) as unknown as typeof tx.affiliate.findUnique;

  tx.affiliate.update = vi.fn(async ({ data }: { data: { status?: string; code?: string } }) => ({
    id: "aff-1",
    userId: "user-1",
    status: (data.status ?? "PENDING") as AffiliateStatus,
    code: data.code ?? affiliateOverrides.code ?? null,
    statusReason: null,
    user: { id: "user-1", name: "Maria", email: "maria@exemplo.test" },
  })) as unknown as typeof tx.affiliate.update;

  return tx;
}

describe("generateAffiliateCode", () => {
  it("gera 7 caracteres do alfabeto permitido", () => {
    const code = generateAffiliateCode();
    expect(code).toHaveLength(7);
    expect(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/).toBeTruthy();
  });

  it("não contém caracteres ambíguos", () => {
    const alphabet = new Set("abcdefghjkmnpqrstuvwxyz23456789");
    for (let i = 0; i < 50; i += 1) {
      const code = generateAffiliateCode();
      expect(Array.from(code).every((char) => alphabet.has(char))).toBe(true);
    }
  });
});

describe("generateUniqueAffiliateCode", () => {
  it("retorna o primeiro código quando não há colisão", async () => {
    const tx = createPrismaLike();
    const code = await generateUniqueAffiliateCode(tx);
    expect(code).toHaveLength(7);
    expect(tx.affiliate.findUnique).toHaveBeenCalledTimes(1);
  });

  it("faz retry em colisão e retorna código livre", async () => {
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const tx = createPrismaLike(["aaaaaaa"]);

    // 7 calls para gerar "aaaaaaa" (colide), depois 7 calls para "bbbbbbb" (livre).
    const spy = vi.spyOn(Math, "random");
    for (let i = 0; i < 7; i += 1) spy.mockReturnValueOnce(0);
    for (let i = 0; i < 7; i += 1) spy.mockReturnValueOnce(1 / alphabet.length);

    const code = await generateUniqueAffiliateCode(tx);
    expect(code).toBe("bbbbbbb");
    expect(tx.affiliate.findUnique).toHaveBeenCalledTimes(2);

    spy.mockRestore();
  });
});

describe("isValidVanityCode", () => {
  it("aceita letras minúsculas, números e hífen", () => {
    expect(isValidVanityCode("grazi")).toBe(true);
    expect(isValidVanityCode("grazi-22")).toBe(true);
  });

  it("rejeita maiúsculas, espaços e caracteres especiais", () => {
    expect(isValidVanityCode("Grazi")).toBe(false);
    expect(isValidVanityCode("grazi_22")).toBe(false);
    expect(isValidVanityCode("abc")).toBe(false);
    expect(isValidVanityCode("a".repeat(21))).toBe(false);
  });
});

describe("transitionAffiliate", () => {
  const actorId = "admin-1";

  it("aprova PENDING gerando código e audit", async () => {
    const tx = createAffiliateTx();
    const result = await transitionAffiliate("aff-1", "APPROVED", { actorId }, tx);

    expect(result.newStatus).toBe("APPROVED");
    expect(result.code).toHaveLength(7);
    expect(tx.affiliate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", reviewedById: actorId }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalled();
    expect(result.emailEvent.template).toBe("affiliate-approved");
  });

  it("rejeita PENDING exigindo motivo", async () => {
    const tx = createAffiliateTx();
    await expect(
      transitionAffiliate("aff-1", "REJECTED", { actorId, reason: "curto" }, tx),
    ).rejects.toThrow(AppError);
  });

  it("suspender revoga sessões", async () => {
    const tx = createAffiliateTx([], { code: "abc1234" });
    tx.affiliate.findUnique = vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id) {
        return {
          id: "aff-1",
          userId: "user-1",
          status: "APPROVED" as AffiliateStatus,
          code: "abc1234",
          statusReason: null,
          user: { id: "user-1", name: "Maria", email: "maria@exemplo.test" },
        };
      }
      return null;
    }) as unknown as typeof tx.affiliate.findUnique;

    const result = await transitionAffiliate("aff-1", "SUSPENDED", { actorId, reason: "Motivo longo suficiente" }, tx);

    expect(result.newStatus).toBe("SUSPENDED");
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(result.emailEvent.template).toBe("affiliate-suspended");
  });

  it("remove revoga sessões", async () => {
    const tx = createAffiliateTx([], { code: "abc1234" });
    tx.affiliate.findUnique = vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id) {
        return {
          id: "aff-1",
          userId: "user-1",
          status: "APPROVED" as AffiliateStatus,
          code: "abc1234",
          statusReason: null,
          user: { id: "user-1", name: "Maria", email: "maria@exemplo.test" },
        };
      }
      return null;
    }) as unknown as typeof tx.affiliate.findUnique;

    const result = await transitionAffiliate("aff-1", "REMOVED", { actorId, reason: "Motivo longo suficiente" }, tx);

    expect(result.newStatus).toBe("REMOVED");
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("bloqueia transições inválidas", async () => {
    const tx = createAffiliateTx();
    await expect(
      transitionAffiliate("aff-1", "SUSPENDED", { actorId, reason: "Motivo longo suficiente" }, tx),
    ).rejects.toThrow(AppError);
  });
});

describe("updateAffiliateCode", () => {
  const actorId = "admin-1";

  it("atualiza código uma vez", async () => {
    const tx = createPrismaLike();
    tx.affiliate.findUnique = vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id) return { id: "aff-1", code: "abc1234", codeEditedAt: null };
      return null;
    }) as unknown as typeof tx.affiliate.findUnique;
    tx.affiliate.update = vi.fn(async () => ({ id: "aff-1" })) as unknown as typeof tx.affiliate.update;

    const result = await updateAffiliateCode("aff-1", "grazi", actorId, tx);

    expect(result.newCode).toBe("grazi");
    expect(tx.auditLog.create).toHaveBeenCalled();
  });

  it("recusa segunda alteração", async () => {
    const tx = createPrismaLike();
    tx.affiliate.findUnique = vi.fn(async () => ({ id: "aff-1", code: "grazi", codeEditedAt: new Date() })) as unknown as typeof tx.affiliate.findUnique;

    await expect(updateAffiliateCode("aff-1", "outro", actorId, tx)).rejects.toThrow(AppError);
  });

  it("recusa código duplicado", async () => {
    const tx = createPrismaLike();
    tx.affiliate.findUnique = vi.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
      if (where.id) return { id: "aff-1", code: "abc1234", codeEditedAt: null };
      if (where.code === "grazi") return { id: "aff-2" };
      return null;
    }) as unknown as typeof tx.affiliate.findUnique;

    await expect(updateAffiliateCode("aff-1", "grazi", actorId, tx)).rejects.toThrow(AppError);
  });
});
