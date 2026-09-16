/**
 * Entrar na conta — o caminho que a tela `/entrar` percorre.
 *
 * Login é a porta de entrada de tudo, então este arquivo tranca as decisões
 * de segurança da spec 04: e-mail não confirmado não entra, a resposta de
 * senha errada não distingue "e-mail não existe" de "senha errada", cinco
 * erros seguidos travam a conta, e o login de admin deixa trilha e alerta.
 *
 * O caso que nasceu de um bug real: ler a sessão depois do `signInEmail`
 * dentro da mesma action falhava (o cookie só existe na resposta), e o
 * afiliado via "algo deu errado" estando logado. O primeiro teste morre se
 * alguém reintroduzir essa releitura.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createCookieStore, requestContext, seedSettings, truncateAll } from "../helpers/integration";

const cookieStore = createCookieStore();

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(requestContext.headers),
  cookies: () => Promise.resolve(cookieStore),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined, revalidateTag: () => undefined }));

const { signIn } = await import("@/features/auth/actions");
const { auth } = await import("@/lib/auth");
const { db } = await import("@/lib/db");
const { resetAll } = await import("@/lib/rate-limit");

const PASSWORD = "trufaAzulNoTelhado";

/** Cria conta já verificada (o login exige) e com o papel pedido. */
async function createUser(email: string, role: "ADMIN" | "AFFILIATE"): Promise<string> {
  const signUp = await auth.api.signUpEmail({
    body: { name: "Maria Souza", email, password: PASSWORD },
  });

  const user = await db.user.update({
    where: { id: signUp.user.id },
    data: { emailVerified: true, role },
    select: { id: true },
  });

  return user.id;
}

beforeAll(async () => {
  await truncateAll();
});

beforeEach(async () => {
  await truncateAll();
  await seedSettings();
  resetAll();
  requestContext.reset();
  cookieStore.jar.clear();
});

afterAll(async () => {
  await db.$disconnect();
});

describe("signIn", () => {
  it("entra e devolve o destino padrão, sem precisar reler a sessão", async () => {
    await createUser("maria@exemplo.test", "AFFILIATE");

    const result = await signIn({ email: "maria@exemplo.test", password: PASSWORD, next: "" });

    expect(result).toEqual({ ok: true, data: { redirectTo: "/painel" } });
    // A sessão existe de verdade — o cookie no navegador é exercido no e2e.
    expect(await db.session.count()).toBe(1);
  });

  it("respeita um next interno e ignora um externo (open redirect)", async () => {
    await createUser("maria@exemplo.test", "AFFILIATE");

    const interno = await signIn({
      email: "maria@exemplo.test",
      password: PASSWORD,
      next: "/painel/perfil",
    });
    expect(interno).toEqual({ ok: true, data: { redirectTo: "/painel/perfil" } });

    cookieStore.jar.clear();
    const externo = await signIn({
      email: "maria@exemplo.test",
      password: PASSWORD,
      next: "//evil.example",
    });
    expect(externo).toEqual({ ok: true, data: { redirectTo: "/painel" } });
  });

  it("recusa quem ainda não confirmou o e-mail, com a mensagem específica", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Maria Souza", email: "maria@exemplo.test", password: PASSWORD },
    });
    expect(signUp.user.emailVerified).toBe(false);

    const result = await signIn({ email: "maria@exemplo.test", password: PASSWORD, next: "" });

    expect(result).toEqual({
      ok: false,
      error: "Confirme seu e-mail antes de entrar. Reenviamos o link para você.",
    });
    expect(cookieStore.jar.size).toBe(0);
  });

  it("responde igual para senha errada e para e-mail inexistente", async () => {
    await createUser("maria@exemplo.test", "AFFILIATE");

    const senhaErrada = await signIn({
      email: "maria@exemplo.test",
      password: "senhaErradaMesmo",
      next: "",
    });
    const naoExiste = await signIn({
      email: "fantasma@exemplo.test",
      password: "senhaErradaMesmo",
      next: "",
    });

    expect(senhaErrada).toEqual({ ok: false, error: "E-mail ou senha incorretos." });
    expect(naoExiste).toEqual({ ok: false, error: "E-mail ou senha incorretos." });
    expect(cookieStore.jar.size).toBe(0);
  });

  it("trava a conta no sexto erro seguido de senha", async () => {
    await createUser("maria@exemplo.test", "AFFILIATE");

    for (let index = 0; index < 5; index += 1) {
      const result = await signIn({
        email: "maria@exemplo.test",
        password: "senhaErradaMesmo",
        next: "",
      });
      expect(result).toEqual({ ok: false, error: "E-mail ou senha incorretos." });
    }

    // Nem com a senha certa: a janela de bloqueio precisa passar.
    const blocked = await signIn({ email: "maria@exemplo.test", password: PASSWORD, next: "" });
    expect(blocked).toEqual({
      ok: false,
      error:
        "Muitas tentativas de entrada. Aguarde alguns minutos antes de tentar de novo ou redefina sua senha.",
    });
  });

  it("login de admin vai ao /admin, grava auditoria e manda o alerta", async () => {
    const adminId = await createUser("admin@exemplo.test", "ADMIN");

    const result = await signIn({ email: "admin@exemplo.test", password: PASSWORD, next: "" });

    expect(result).toEqual({ ok: true, data: { redirectTo: "/admin" } });

    const audit = await db.auditLog.findFirstOrThrow({ where: { action: "auth.admin_login" } });
    expect(audit.actorId).toBe(adminId);
    expect(audit.actorRole).toBe("ADMIN");
    expect(audit.ip).toBe("203.0.113.10");

    const alert = await db.emailLog.findFirst({ where: { template: "admin-alert" } });
    expect(alert?.to).toBe("admin@teste.local");
    expect(alert?.status).toBe("SENT");
  });
});
