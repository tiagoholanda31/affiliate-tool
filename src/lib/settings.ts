/**
 * Leitura da linha única de `Setting` (docs/spec/01, seção 9).
 *
 * Escrita em `features/settings`. Sem cache de propósito: uma linha por PK;
 * invalidação em toda escrita não compensaria.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type ProgramSettings = {
  holdDays: number;
  payoutDay: number;
  attributionDays: number;
  pixExpirationMinutes: number;
  downloadGrantDays: number;
  downloadMaxCount: number;
  termsVersion: string;
  termsMarkdown: string;
  adminNotifyEmail: string;
  supportWhatsapp: string;
};

/** Valores usados enquanto o seed não rodou (banco recém-criado). */
export const SETTINGS_FALLBACK: ProgramSettings = {
  holdDays: 7,
  payoutDay: 10,
  attributionDays: 30,
  pixExpirationMinutes: 30,
  downloadGrantDays: 7,
  downloadMaxCount: 5,
  termsVersion: "v1",
  termsMarkdown: "",
  adminNotifyEmail: "",
  supportWhatsapp: "",
};

export async function getSettings(): Promise<ProgramSettings> {
  const setting = await db.setting.findUnique({
    where: { id: 1 },
    select: {
      holdDays: true,
      payoutDay: true,
      attributionDays: true,
      pixExpirationMinutes: true,
      downloadGrantDays: true,
      downloadMaxCount: true,
      termsVersion: true,
      termsMarkdown: true,
      adminNotifyEmail: true,
      supportWhatsapp: true,
    },
  });

  const settings = setting ?? SETTINGS_FALLBACK;
  return { ...settings, adminNotifyEmail: settings.adminNotifyEmail || env.ADMIN_EMAIL };
}

/** Versão dos termos aceita no cadastro — gravada junto com IP e data. */
export async function getTermsVersion(): Promise<string> {
  return (await getSettings()).termsVersion;
}

/**
 * WhatsApp de suporte já formatado para leitura (`+55 11 91234-5678`).
 * `undefined` quando o admin ainda não configurou — o rodapé some.
 */
export async function getSupportWhatsapp(): Promise<string | undefined> {
  return formatSupportWhatsapp((await getSettings()).supportWhatsapp);
}

/** Puro, para poder ser testado sem banco. */
export function formatSupportWhatsapp(raw: string): string | undefined {
  if (!raw) return undefined;

  const digits = raw.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10 || digits.length > 11) return raw;

  return `+55 ${digits.slice(0, 2)} ${digits.slice(2, -4)}-${digits.slice(-4)}`;
}
