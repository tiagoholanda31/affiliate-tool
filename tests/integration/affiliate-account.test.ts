/**
 * Conta do afiliado depois do cadastro: reenvio após reprovação, troca da chave
 * Pix e troca de senha.
 *
 * São as três operações da fatia 01 que mexem em algo sensível — a fila de
 * análise, o destino do dinheiro e o acesso à conta —, então cada uma é testada
 * também pelo caminho de erro, não só pelo feliz.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCookieStore,
  requestContext,
  seedSettings,
  signInAndGetCookie,
  truncateAll,
} from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { changePassword, changePixKey, registerAffiliate, resubmitAffiliate } = await import(
  "@/features/affiliates/actions"
);
const { auth } = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { decrypt } = await import("@/lib/crypto");
const { resetAll } = await import("@/lib/rate-limit");

const EMAIL = "maria@exemplo.test";
const PASSWORD = "trufaAzulNoTelhado";

const REGISTRATION = {
  name: "Maria Souza",
  email: EMAIL,
  password: PASSWORD,
  phone: "11987654321",
  socialNetwork: "INSTAGRAM",
  socialHandle: "maria.afiliada",
  pixKeyType: "CPF",
  pixKey: "529.982.247-25",
  termsAccepted: true,
  website: "",
  startedAt: 0,
};

/** Cadastra, confirma o e-mail e entra. Devolve o id do usuário. */
async function createSignedInAffiliate(): Promise<string> {
  const result = await registerAffiliate({ ...REGISTRATION, startedAt: Date.now() - 10_000 });
  if (!result.ok) throw new Error("cadastro falhou no preparo do teste");

  // O login exige e-mail confirmado; aqui pulamos o clique no link.
  const user = await db.user.update({
    where: { email: EMAIL },
    data: { emailVerified: true },
    select: { id: true },
  });

  requestContext.setCookie(await signInAndGetCookie(auth, EMAIL, PASSWORD));
  return user.id;
}

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v1");
  resetAll();
  requestContext.reset();
  cookieStore.jar.clear();
});

beforeAll(async () => {
  await truncateAll();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("resubmitAffiliate", () => {
  it("devolve o cadastro reprovado para a fila e conta a revisão", async () => {
    const userId = await createSignedInAffiliate();

    await db.affiliate.update({
      where: { userId },
      data: { status: "REJECTED", statusReason: "Perfil fechado; não deu para conferir." },
    });

    const result = await resubmitAffiliate({
      name: "Maria Souza Lima",
      phone: "11999998888",
      socialNetwork: "TIKTOK",
      socialHandle: "@maria.lima",
      pixKeyType: "EMAIL",
      pixKey: "Maria@Exemplo.test",
    });

    expect(result).toEqual({ ok: true, data: { status: "PENDING" } });

    const affiliate = await db.affiliate.findUniqueOrThrow({ where: { userId } });
    expect(affiliate.status).toBe("PENDING");
    // O motivo antigo some: ele descreve uma decisão que já não vale.
    expect(affiliate.statusReason).toBeNull();
    expect(affiliate.reviewCount).toBe(1);
    expect(affiliate.socialNetwork).toBe("TIKTOK");
    expect(affiliate.socialHandle).toBe("maria.lima");
    expect(affiliate.phone).toBe("+5511999998888");
    expect(decrypt(affiliate.pixKeyEncrypted)).toBe("maria@exemplo.test");

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.name).toBe("Maria Souza Lima");

    // O admin é avisado de novo, agora como reenvio.
    const notice = await db.emailLog.findFirst({
      where: { template: "affiliate-pending-admin" },
      orderBy: { createdAt: "desc" },
    });
    expect(notice?.to).toBe("admin@teste.local");

    const audit = await db.auditLog.findFirst({ where: { action: "affiliate.resubmit" } });
    expect(audit?.actorId).toBe(userId);
    expect(audit?.actorRole).toBe("AFFILIATE");
  });

  it("recusa reenvio de quem não está reprovado", async () => {
    await createSignedInAffiliate(); // nasce PENDING

    const result = await resubmitAffiliate({
      name: "Maria Souza",
      phone: "11987654321",
      socialNetwork: "INSTAGRAM",
      socialHandle: "maria.afiliada",
      pixKeyType: "CPF",
      pixKey: "529.982.247-25",
    });

    expect(result).toEqual({ ok: false, error: "Seu cadastro não está reprovado." });
  });

  it("recusa sem sessão", async () => {
    requestContext.reset();

    const result = await resubmitAffiliate({
      name: "Maria Souza",
      phone: "11987654321",
      socialNetwork: "INSTAGRAM",
      socialHandle: "maria.afiliada",
      pixKeyType: "CPF",
      pixKey: "529.982.247-25",
    });

    expect(result).toEqual({ ok: false, error: "Sua sessão expirou. Entre novamente." });
  });
});

describe("changePixKey", () => {
  it("recusa com a senha errada e não toca na chave gravada", async () => {
    const userId = await createSignedInAffiliate();
    const before = await db.affiliate.findUniqueOrThrow({ where: { userId } });

    const result = await changePixKey({
      pixKeyType: "EMAIL",
      pixKey: "nova@exemplo.test",
      currentPassword: "senhaErradaMesmo",
    });

    expect(result).toEqual({ ok: false, error: "Senha atual incorreta." });

    const after = await db.affiliate.findUniqueOrThrow({ where: { userId } });
    expect(after.pixKeyEncrypted).toBe(before.pixKeyEncrypted);
    expect(after.pixKeyType).toBe("CPF");
    expect(await db.auditLog.count({ where: { action: "affiliate.pix_change" } })).toBe(0);
  });

  it("troca a chave com a senha certa, audita mascarado e avisa por e-mail", async () => {
    const userId = await createSignedInAffiliate();

    const result = await changePixKey({
      pixKeyType: "EMAIL",
      pixKey: "Nova@Exemplo.test",
      currentPassword: PASSWORD,
    });

    expect(result.ok).toBe(true);

    const affiliate = await db.affiliate.findUniqueOrThrow({ where: { userId } });
    expect(affiliate.pixKeyType).toBe("EMAIL");
    expect(decrypt(affiliate.pixKeyEncrypted)).toBe("nova@exemplo.test");
    expect(affiliate.pixKeyMasked).toBe("no***@exemplo.test");

    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "affiliate.pix_change" },
    });
    expect(audit.entityId).toBe(affiliate.id);
    expect(audit.actorId).toBe(userId);
    // A trilha guarda só o mascarado — não pode virar um depósito de chaves Pix.
    expect(JSON.stringify(audit.after)).not.toContain("nova@exemplo.test");
    expect(JSON.stringify(audit.before)).toContain("***.982.247-**");

    const alert = await db.emailLog.findFirst({ where: { template: "pix-key-changed" } });
    expect(alert?.to).toBe(EMAIL);
    expect(alert?.status).toBe("SENT");
  });

  it("recusa chave inválida para o tipo escolhido", async () => {
    await createSignedInAffiliate();

    const result = await changePixKey({
      pixKeyType: "CNPJ",
      pixKey: "11.222.333/0001-82",
      currentPassword: PASSWORD,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.pixKey).toEqual(["CNPJ inválido."]);
  });
});

describe("changePassword", () => {
  it("encerra as outras sessões e mantém a atual", async () => {
    const userId = await createSignedInAffiliate();

    // Segunda sessão: outro aparelho, mesma conta.
    await signInAndGetCookie(auth, EMAIL, PASSWORD);
    expect(await db.session.count({ where: { userId } })).toBe(2);

    const result = await changePassword({
      currentPassword: PASSWORD,
      newPassword: "girassolDeQuartaFeira",
      confirmPassword: "girassolDeQuartaFeira",
    });

    expect(result.ok).toBe(true);
    expect(await db.session.count({ where: { userId } })).toBe(1);

    // A senha nova é a que vale agora.
    await expect(
      signInAndGetCookie(auth, EMAIL, "girassolDeQuartaFeira"),
    ).resolves.toBeTruthy();
    await expect(signInAndGetCookie(auth, EMAIL, PASSWORD)).rejects.toThrow();
  });

  it("recusa com a senha atual errada", async () => {
    await createSignedInAffiliate();

    const result = await changePassword({
      currentPassword: "senhaErradaMesmo",
      newPassword: "girassolDeQuartaFeira",
      confirmPassword: "girassolDeQuartaFeira",
    });

    expect(result).toEqual({ ok: false, error: "Senha atual incorreta." });
  });

  it("recusa senha nova comum demais", async () => {
    await createSignedInAffiliate();

    const result = await changePassword({
      currentPassword: PASSWORD,
      newPassword: "senha123456",
      confirmPassword: "senha123456",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.newPassword?.[0]).toContain("muito comum");
  });
});
