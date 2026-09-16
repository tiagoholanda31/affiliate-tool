/**
 * Mutação da linha única de Setting + re-aceite de termos pelo afiliado.
 */
import type { Prisma } from "@/generated/prisma/client";

import type { AcceptTermsInput, UpdateSettingsInput } from "@/features/settings/schemas";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { getSettings, type ProgramSettings } from "@/lib/settings";

export type SettingsSnapshot = ProgramSettings;

function toSnapshot(row: ProgramSettings): SettingsSnapshot {
  return { ...row };
}

/**
 * Atualiza Setting id=1.
 * Alterar o texto dos termos exige `termsVersion` diferente da atual.
 */
export async function updateSettings(
  input: UpdateSettingsInput,
): Promise<{ before: SettingsSnapshot; after: SettingsSnapshot }> {
  const current = await getSettings();
  const termsChanged = input.termsMarkdown.trim() !== current.termsMarkdown.trim();

  if (termsChanged && input.termsVersion.toLowerCase() === current.termsVersion.toLowerCase()) {
    throw new AppError(
      "VALIDATION",
      "Ao alterar o texto dos termos, informe uma nova versão (ex.: v2).",
      { expose: true },
    );
  }

  const before = toSnapshot(current);

  const data: Prisma.SettingUpdateInput = {
    holdDays: input.holdDays,
    payoutDay: input.payoutDay,
    attributionDays: input.attributionDays,
    pixExpirationMinutes: input.pixExpirationMinutes,
    downloadGrantDays: input.downloadGrantDays,
    downloadMaxCount: input.downloadMaxCount,
    termsVersion: input.termsVersion.trim(),
    termsMarkdown: input.termsMarkdown.trim(),
    adminNotifyEmail: input.adminNotifyEmail,
    supportWhatsapp: input.supportWhatsapp,
  };

  await db.setting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...data,
      termsMarkdown: input.termsMarkdown.trim(),
      adminNotifyEmail: input.adminNotifyEmail,
      supportWhatsapp: input.supportWhatsapp,
    } as Prisma.SettingCreateInput,
    update: data,
  });

  const after = toSnapshot(await getSettings());
  return { before, after };
}

/** Afiliado re-aceita a versão vigente dos termos (não bloqueante). */
export async function acceptCurrentTerms(
  affiliateId: string,
  input: AcceptTermsInput,
  ip: string,
): Promise<{ termsVersion: string }> {
  const settings = await getSettings();
  if (input.termsVersion !== settings.termsVersion) {
    throw new AppError(
      "VALIDATION",
      "A versão dos termos mudou. Recarregue a página e aceite novamente.",
      { expose: true },
    );
  }

  const affiliate = await db.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, termsVersion: true },
  });
  if (!affiliate) {
    throw new AppError("NOT_FOUND", "Afiliado não encontrado.");
  }

  if (affiliate.termsVersion === settings.termsVersion) {
    return { termsVersion: settings.termsVersion };
  }

  await db.affiliate.update({
    where: { id: affiliateId },
    data: {
      termsVersion: settings.termsVersion,
      termsAcceptedAt: new Date(),
      termsIp: ip,
    },
  });

  return { termsVersion: settings.termsVersion };
}

/** Validação pura dos limites — útil em testes unitários sem banco. */
export function assertSettingsLimits(input: UpdateSettingsInput): void {
  // Zod já cobre; esta função documenta as regras para testes de domínio.
  const checks: [number, number, number, string][] = [
    [input.holdDays, 0, 90, "holdDays"],
    [input.payoutDay, 1, 28, "payoutDay"],
    [input.attributionDays, 1, 90, "attributionDays"],
    [input.pixExpirationMinutes, 10, 120, "pixExpirationMinutes"],
    [input.downloadGrantDays, 1, 30, "downloadGrantDays"],
    [input.downloadMaxCount, 1, 20, "downloadMaxCount"],
  ];
  for (const [value, min, max, name] of checks) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new AppError("VALIDATION", `${name} fora dos limites (${String(min)}–${String(max)}).`);
    }
  }
}

/** Regra: texto novo exige versão nova. */
export function requiresNewTermsVersion(
  currentMarkdown: string,
  currentVersion: string,
  nextMarkdown: string,
  nextVersion: string,
): boolean {
  const changed = nextMarkdown.trim() !== currentMarkdown.trim();
  if (!changed) return false;
  return nextVersion.toLowerCase() === currentVersion.toLowerCase();
}
