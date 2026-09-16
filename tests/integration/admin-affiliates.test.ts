/**
 * Gestão de afiliados pelo admin.
 *
 * Protege: permissão negada para afiliado, aprovação gera código e envia e-mail,
 * reprovação exige motivo, suspender revoga sessão, revelar Pix registra audit.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  approveAffiliate,
  rejectAffiliate,
  revealPixKey,
  suspendAffiliate,
} from "@/features/affiliates/admin-actions";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

vi.mock("next/cache", () => ({
  revalidatePath: () => undefined,
  updateTag: () => undefined,
}));

const { registerAffiliate } = await import("@/features/affiliates/actions");

const PASSWORD = "trufaAzulNoTelhado";

async function createAdmin(email: string): Promise<{ email: string; password: string }> {
  await auth.api.signUpEmail({
    body: { name: "Admin Teste", email, password: PASSWORD, callbackURL: "/verificar-email?status=ok" },
    headers: requestContext.headers,
  });
  await db.user.update({ where: { email }, data: { role: "ADMIN", emailVerified: true } });
  return { email, password: PASSWORD };
}

async function createAffiliate(email: string): Promise<{ affiliateId: string; userId: string; email: string }> {
  await registerAffiliate({
    name: "Maria Souza",
    email,
    password: PASSWORD,
    phone: "11987654321",
    socialNetwork: "INSTAGRAM",
    socialHandle: "maria.afiliada",
    pixKeyType: "CPF",
    pixKey: "529.982.247-25",
    termsAccepted: true,
    website: "",
    startedAt: Date.now() - 10_000,
  });
  const user = await db.user.findUnique({ where: { email }, include: { affiliate: true } });
  if (!user?.affiliate) throw new Error("Afiliado não criado no teste");
  // Simula a confirmação de e-mail para permitir login.
  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  return { affiliateId: user.affiliate.id, userId: user.id, email };
}

beforeEach(async () => {
  await truncateAll();
  await seedSettings("v1");
  requestContext.reset();
  cookieStore.jar.clear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("admin affiliate actions", () => {
  it("afiliado não pode aprovar outro afiliado", async () => {
    const affiliate = await createAffiliate("afiliado@teste.local");
    const cookie = await signInAndGetCookie(auth, affiliate.email, PASSWORD);
    requestContext.setCookie(cookie);

    const result = await approveAffiliate({ affiliateId: affiliate.affiliateId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("permissão");
  });

  it("admin aprova afiliado pendente gerando código e enviando e-mail", async () => {
    const admin = await createAdmin("admin@teste.local");
    const affiliate = await createAffiliate("maria@teste.local");

    const cookie = await signInAndGetCookie(auth, admin.email, admin.password);
    requestContext.setCookie(cookie);

    const result = await approveAffiliate({ affiliateId: affiliate.affiliateId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.code).toHaveLength(7);

    const updated = await db.affiliate.findUnique({ where: { id: affiliate.affiliateId } });
    expect(updated?.status).toBe("APPROVED");
    expect(updated?.code).toBe(result.data.code);

    const email = await db.emailLog.findFirst({ where: { template: "affiliate-approved" } });
    expect(email?.to).toBe("maria@teste.local");
  });

  it("reprovar sem motivo é rejeitada", async () => {
    const admin = await createAdmin("admin@teste.local");
    const affiliate = await createAffiliate("maria@teste.local");

    const cookie = await signInAndGetCookie(auth, admin.email, admin.password);
    requestContext.setCookie(cookie);

    const result = await rejectAffiliate({ affiliateId: affiliate.affiliateId, reason: "curto" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.reason).toBeDefined();
  });

  it("suspender revoga a sessão do afiliado", async () => {
    const admin = await createAdmin("admin@teste.local");
    const affiliate = await createAffiliate("maria@teste.local");

    // Aprova e cria sessão do afiliado.
    const adminCookie = await signInAndGetCookie(auth, admin.email, admin.password);
    requestContext.setCookie(adminCookie);
    await approveAffiliate({ affiliateId: affiliate.affiliateId });

    const affiliateCookie = await signInAndGetCookie(auth, affiliate.email, PASSWORD);
    expect(affiliateCookie).toContain("better-auth.session_token");

    requestContext.setCookie(adminCookie);
    const result = await suspendAffiliate({
      affiliateId: affiliate.affiliateId,
      reason: "Compras com indícios de fraude detectadas.",
    });

    expect(result.ok).toBe(true);

    const sessions = await db.session.findMany({ where: { userId: affiliate.affiliateId } });
    expect(sessions).toHaveLength(0);
  });

  it("revelar Pix registra audit e retorna a chave", async () => {
    const admin = await createAdmin("admin@teste.local");
    const affiliate = await createAffiliate("maria@teste.local");

    const adminCookie = await signInAndGetCookie(auth, admin.email, admin.password);
    requestContext.setCookie(adminCookie);

    const result = await revealPixKey({ affiliateId: affiliate.affiliateId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.pixKey).toBe("52998224725");

    const audit = await db.auditLog.findFirst({
      where: { action: "pix.reveal", entityId: affiliate.affiliateId },
    });
    expect(audit).not.toBeNull();
  });
});
