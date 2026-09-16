/**
 * Utilitários dos testes de integração.
 *
 * O que existe aqui resolve dois problemas: dar às Server Actions um `next/headers`
 * que funcione fora de uma requisição, e limpar o banco entre os testes.
 */
import { db } from "@/lib/db";

/**
 * Contexto de requisição falso.
 *
 * As Server Actions leem `headers()` para descobrir IP e cookies. Fora do Next
 * essa função não existe, então cada teste instala este objeto no lugar dela e
 * escreve nele o que quer simular — o cookie de sessão de quem está logado, por
 * exemplo.
 */
export const requestContext = {
  headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),

  /** Zera os headers e volta ao IP padrão. */
  reset(): void {
    this.headers = new Headers({ "x-forwarded-for": "203.0.113.10" });
  },

  /** Passa a agir como quem tem estes cookies (o `cookie` de uma sessão). */
  setCookie(cookie: string): void {
    this.headers.set("cookie", cookie);
  },
};

/** Store de cookies mínimo, o suficiente para o plugin `nextCookies` não quebrar. */
export function createCookieStore() {
  const jar = new Map<string, string>();

  return {
    jar,
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  };
}

/**
 * Apaga tudo entre testes.
 *
 * `TRUNCATE ... CASCADE` num comando só resolve as dependências de chave
 * estrangeira sem precisar acertar a ordem à mão.
 */
export async function truncateAll(): Promise<void> {
  await db.$executeRawUnsafe(`
    TRUNCATE TABLE
      "DownloadGrant", "CommissionAdjustment", "Commission", "Payout",
      "WebhookEvent", "Order", "Click", "ProductSlugHistory", "DigitalFile", "Material", "Product",
      "Account", "Session", "Verification", "Affiliate", "User",
      "AuditLog", "EmailLog", "JobRun", "Setting"
    RESTART IDENTITY CASCADE
  `);
}

/** Cria a linha única de `Setting` que o cadastro lê para gravar os termos. */
export async function seedSettings(termsVersion = "v1"): Promise<void> {
  await db.setting.upsert({
    where: { id: 1 },
    update: { termsVersion },
    create: {
      id: 1,
      termsVersion,
      termsMarkdown: "Termos de teste.",
      adminNotifyEmail: "admin@teste.local",
      supportWhatsapp: "+5511912345678",
    },
  });
}

/**
 * Faz login de verdade e devolve o header `Cookie` da sessão criada.
 *
 * Passa por `asResponse: true` porque é a única forma de ler o `Set-Cookie` que
 * o Better Auth emite sem depender do `cookies()` do Next.
 */
export async function signInAndGetCookie(
  auth: { api: { signInEmail: (args: never) => Promise<unknown> } },
  email: string,
  password: string,
): Promise<string> {
  const response = (await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  } as never)) as Response;

  if (!response.ok) {
    throw new Error(`Login falhou no teste: ${String(response.status)}`);
  }

  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((cookie): cookie is string => Boolean(cookie))
    .join("; ");
}
