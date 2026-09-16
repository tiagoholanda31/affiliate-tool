/**
 * Cadastro de afiliado, ponta a ponta no banco.
 *
 * O que estes testes protegem: que a conta e o cadastro nasçam juntos, que a
 * chave Pix nunca encoste no banco em texto claro, que os termos fiquem
 * registrados com versão e IP, e que o formulário não sirva para descobrir
 * quais e-mails já existem.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createCookieStore, requestContext, seedSettings, truncateAll } from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

// Fora de uma requisição do Next, revalidar cache lança. Nada do que testamos
// aqui depende disso.
vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { registerAffiliate } = await import("@/features/affiliates/actions");
const { db } = await import("@/lib/db");
const { decrypt } = await import("@/lib/crypto");
const { resetAll } = await import("@/lib/rate-limit");

const VALID = {
  name: "Maria Souza",
  email: "maria@exemplo.test",
  password: "trufaAzulNoTelhado",
  phone: "11987654321",
  socialNetwork: "INSTAGRAM",
  socialHandle: "@maria.afiliada",
  pixKeyType: "CPF",
  pixKey: "529.982.247-25",
  termsAccepted: true,
  website: "",
  // Passado o bastante para vencer o tempo mínimo de preenchimento.
  startedAt: Date.now() - 10_000,
};

beforeAll(async () => {
  await truncateAll();
});

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v3");
  resetAll();
  requestContext.reset();
  cookieStore.jar.clear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("registerAffiliate", () => {
  it("cria User e Affiliate, cifra a chave Pix e registra o aceite dos termos", async () => {
    const result = await registerAffiliate({ ...VALID, startedAt: Date.now() - 10_000 });

    expect(result).toEqual({ ok: true, data: { email: "maria@exemplo.test" } });

    const user = await db.user.findUnique({
      where: { email: "maria@exemplo.test" },
      include: { affiliate: true, accounts: true },
    });

    expect(user).not.toBeNull();
    expect(user?.role).toBe("AFFILIATE");
    // Sem e-mail confirmado não há login (docs/spec/04).
    expect(user?.emailVerified).toBe(false);

    const affiliate = user?.affiliate;
    expect(affiliate?.status).toBe("PENDING");
    expect(affiliate?.phone).toBe("+5511987654321");
    expect(affiliate?.socialHandle).toBe("maria.afiliada");
    expect(affiliate?.code).toBeNull();

    // A chave em claro não existe em nenhuma coluna: só cifrada e mascarada.
    expect(affiliate?.pixKeyEncrypted).not.toContain("52998224725");
    expect(affiliate?.pixKeyMasked).toBe("***.982.247-**");
    expect(decrypt(affiliate?.pixKeyEncrypted ?? "")).toBe("52998224725");

    expect(affiliate?.termsVersion).toBe("v3");
    expect(affiliate?.termsIp).toBe("203.0.113.10");
    expect(affiliate?.termsAcceptedAt).toBeInstanceOf(Date);

    // A senha fica no `Account`, como hash — nunca no `User`.
    expect(user?.accounts).toHaveLength(1);
    expect(user?.accounts[0]?.password).toBeTruthy();
    expect(user?.accounts[0]?.password).not.toContain("trufaAzulNoTelhado");
  });

  it("dispara o e-mail de confirmação e o registra em EmailLog", async () => {
    await registerAffiliate({ ...VALID, startedAt: Date.now() - 10_000 });

    const log = await db.emailLog.findFirst({ where: { template: "verify-email" } });
    expect(log?.to).toBe("maria@exemplo.test");
    expect(log?.status).toBe("SENT");
  });

  it("responde igual quando o e-mail já existe, sem criar nada novo", async () => {
    await registerAffiliate({ ...VALID, startedAt: Date.now() - 10_000 });
    const before = await db.user.count();

    const result = await registerAffiliate({
      ...VALID,
      name: "Outra Pessoa",
      startedAt: Date.now() - 10_000,
    });

    // Mesmíssima resposta do cadastro novo: nada indica que a conta existe.
    expect(result).toEqual({ ok: true, data: { email: "maria@exemplo.test" } });
    expect(await db.user.count()).toBe(before);
    expect(await db.user.findUnique({ where: { email: VALID.email } })).toMatchObject({
      name: "Maria Souza",
    });
  });

  it("recusa envio rápido demais para ter sido preenchido por gente", async () => {
    const result = await registerAffiliate({ ...VALID, startedAt: Date.now() });

    expect(result.ok).toBe(false);
    expect(await db.user.count()).toBe(0);
  });

  it("recusa quando o honeypot vem preenchido", async () => {
    const result = await registerAffiliate({
      ...VALID,
      website: "http://spam.example",
      startedAt: Date.now() - 10_000,
    });

    expect(result.ok).toBe(false);
    expect(await db.user.count()).toBe(0);
  });

  it("devolve o erro da chave Pix no campo pixKey", async () => {
    const result = await registerAffiliate({
      ...VALID,
      pixKey: "529.982.247-26",
      startedAt: Date.now() - 10_000,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.pixKey).toEqual(["CPF inválido."]);
  });

  it("corta o cadastro no sexto envio do mesmo IP em uma hora", async () => {
    for (let index = 0; index < 5; index += 1) {
      const result = await registerAffiliate({
        ...VALID,
        email: `maria${String(index)}@exemplo.test`,
        startedAt: Date.now() - 10_000,
      });
      expect(result.ok).toBe(true);
    }

    const blocked = await registerAffiliate({
      ...VALID,
      email: "maria6@exemplo.test",
      startedAt: Date.now() - 10_000,
    });

    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error).toContain("Muitas tentativas");
  });
});
