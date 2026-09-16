/**
 * Único ponto do sistema autorizado a ler `process.env`.
 *
 * Regra do CLAUDE.md: nenhum outro arquivo lê variáveis de ambiente diretamente
 * (há uma regra de ESLint que falha o build se tentarem). Variáveis que só serão
 * usadas em fatias futuras entram como `.optional()` para não travar o boot agora.
 *
 * `SKIP_ENV_VALIDATION=1` desliga a validação — usado só no `docker build`, onde
 * os segredos ainda não existem.
 */
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Segredo de 32 bytes em base64 (`openssl rand -base64 32`). */
const base64Key32 = z.string().refine(
  (value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  },
  { message: "Deve ser 32 bytes em base64 — gere com `openssl rand -base64 32`." },
);

const optionalString = z.string().optional();

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    // Banco
    DATABASE_URL: z.url(),
    DATABASE_URL_TEST: z.url().optional(),

    // Aplicação
    APP_URL: z.url(),
    ADMIN_EMAIL: z.email(),

    // Autenticação (fatia 01)
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),

    // Criptografia
    ENCRYPTION_KEY: base64Key32,
    REF_COOKIE_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(32),

    // Pagar.me (fatia 05)
    PAGARME_DRIVER: z.enum(["fake", "real"]).default("fake"),
    PAGARME_SECRET_KEY: optionalString,
    PAGARME_WEBHOOK_USER: optionalString,
    PAGARME_WEBHOOK_PASSWORD: optionalString,

    // E-mail (fatia 01+)
    MAIL_DRIVER: z.enum(["resend", "smtp", "log"]).default("log"),
    MAIL_FROM: z.string().default("Affiliate Tool <noreply@example.com>"),
    RESEND_API_KEY: optionalString,
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: optionalString,
    SMTP_PASSWORD: optionalString,

    // Arquivos
    STORAGE_DIR: z.string().default("./storage"),

    // Integrações opcionais (n8n)
    N8N_WEBHOOK_URL: z.url().optional().or(z.literal("")),
    N8N_WEBHOOK_SECRET: optionalString,

    // Build/observabilidade
    BUILD_SHA: optionalString,
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.url(),
    NEXT_PUBLIC_PAGARME_PUBLIC_KEY: optionalString,
  },

  // Next só substitui `process.env.NEXT_PUBLIC_*` estaticamente no client,
  // por isso as variáveis públicas precisam ser listadas literalmente.
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    DATABASE_URL_TEST: process.env.DATABASE_URL_TEST,
    APP_URL: process.env.APP_URL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    REF_COOKIE_SECRET: process.env.REF_COOKIE_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
    PAGARME_DRIVER: process.env.PAGARME_DRIVER,
    PAGARME_SECRET_KEY: process.env.PAGARME_SECRET_KEY,
    PAGARME_WEBHOOK_USER: process.env.PAGARME_WEBHOOK_USER,
    PAGARME_WEBHOOK_PASSWORD: process.env.PAGARME_WEBHOOK_PASSWORD,
    MAIL_DRIVER: process.env.MAIL_DRIVER,
    MAIL_FROM: process.env.MAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    STORAGE_DIR: process.env.STORAGE_DIR,
    N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
    N8N_WEBHOOK_SECRET: process.env.N8N_WEBHOOK_SECRET,
    BUILD_SHA: process.env.BUILD_SHA,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PAGARME_PUBLIC_KEY: process.env.NEXT_PUBLIC_PAGARME_PUBLIC_KEY,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  emptyStringAsUndefined: true,
});

export const isProduction = process.env.NODE_ENV === "production";
export const isTest = process.env.NODE_ENV === "test";
export const isDevelopment = process.env.NODE_ENV === "development";

/**
 * URL base da aplicação, sempre uma string utilizável.
 *
 * Lê `process.env` direto (não o proxy do t3): este módulo também é importado
 * por Client Components (`card-token`, `auth-client`). Acessar `env.APP_URL`
 * no browser explode com "server-side environment variable on the client".
 *
 * O fallback existe por causa do `docker build`, que roda com
 * `SKIP_ENV_VALIDATION=1` e sem nenhuma variável definida — sem ele, o
 * pré-render das páginas estáticas falha em `new URL(undefined)`. Para que os
 * links absolutos das páginas estáticas saiam corretos, passe `APP_URL` como
 * build arg (ver Dockerfile).
 */
const appUrlFromEnv = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
export const APP_URL: string =
  appUrlFromEnv && appUrlFromEnv.length > 0 ? appUrlFromEnv : "http://localhost:3000";
