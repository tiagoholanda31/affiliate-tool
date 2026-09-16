/**
 * Reenvio de e-mails QUEUED com backoff (cron `/api/cron/retry-emails`).
 */
import { render } from "@react-email/render";
import type { ReactElement } from "react";

import { EMAIL_TEMPLATES, type EmailTemplateName } from "@emails/registry";
import { Prisma } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/crypto";
import { db } from "@/lib/db";
import { notFound, validation } from "@/lib/errors";
import type { EmailPayload } from "@/lib/mail";
import { getMailDriver } from "@/lib/mail/drivers";
import { logger } from "@/lib/logger";

const MAX_ATTEMPTS = 3;

/** Backoff antes da próxima tentativa: 10m / 1h / 6h conforme `attempts` atuais. */
const BACKOFF_MS = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
] as const;

type LooseTemplate = {
  render: (props: unknown) => ReactElement;
  subject: (props: unknown) => string;
};

function isTemplateName(value: string): value is EmailTemplateName {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, value);
}

function parsePayload(raw: Prisma.JsonValue | null): EmailPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!("props" in obj)) return null;
  return {
    props: obj.props,
    ...(typeof obj.replyTo === "string" ? { replyTo: obj.replyTo } : {}),
  };
}

function backoffElapsed(attempts: number, createdAt: Date, now: Date): boolean {
  const idx = Math.min(Math.max(attempts, 0), BACKOFF_MS.length - 1);
  const wait = BACKOFF_MS[idx] ?? BACKOFF_MS[0];
  return now.getTime() - createdAt.getTime() >= wait;
}

async function renderStoredEmail(
  template: EmailTemplateName,
  props: unknown,
): Promise<{ html: string; text: string; subject: string }> {
  // Props gravadas por sendMail; o registry tipa por template, aqui vem de JSON.
  const definition = EMAIL_TEMPLATES[template] as LooseTemplate;
  const element = definition.render(props);
  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);
  return { html, text, subject: definition.subject(props) };
}

export type RetryEmailsSummary = {
  scanned: number;
  sent: number;
  failed: number;
  skipped: number;
};

/**
 * Processa até `limit` e-mails QUEUED elegíveis.
 * Sem payload ou template inválido → FAILED.
 * Após 3 tentativas sem sucesso → FAILED.
 */
export async function retryQueuedEmails(
  limit = 50,
  now: Date = new Date(),
): Promise<RetryEmailsSummary> {
  const queued = await db.emailLog.findMany({
    where: { status: "QUEUED", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: limit * 3,
  });

  const summary: RetryEmailsSummary = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  const driver = getMailDriver();

  for (const row of queued) {
    if (summary.sent + summary.failed + summary.skipped >= limit) break;
    summary.scanned += 1;

    if (!backoffElapsed(row.attempts, row.createdAt, now)) {
      summary.skipped += 1;
      continue;
    }

    if (!isTemplateName(row.template)) {
      await db.emailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "Template desconhecido" },
      });
      summary.failed += 1;
      continue;
    }

    const payload = parsePayload(row.payload);
    if (!payload) {
      await db.emailLog.update({
        where: { id: row.id },
        data: { status: "FAILED", error: "Sem payload para reenvio" },
      });
      summary.failed += 1;
      continue;
    }

    try {
      const { html, text, subject } = await renderStoredEmail(row.template, payload.props);

      const result = await driver.send({
        to: row.to,
        subject,
        html,
        text,
        ...(payload.replyTo ? { replyTo: payload.replyTo } : {}),
      });

      const nextAttempts = row.attempts + 1;

      if (result.ok) {
        await db.emailLog.update({
          where: { id: row.id },
          data: {
            status: "SENT",
            sentAt: now,
            providerId: result.providerId,
            attempts: nextAttempts,
            error: null,
            ...(driver.name === "log"
              ? { preview: html }
              : { payload: Prisma.DbNull, preview: null }),
          },
        });
        summary.sent += 1;
        continue;
      }

      if (nextAttempts >= MAX_ATTEMPTS) {
        await db.emailLog.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            attempts: nextAttempts,
            error: result.error.slice(0, 500),
          },
        });
        summary.failed += 1;
      } else {
        await db.emailLog.update({
          where: { id: row.id },
          data: {
            attempts: nextAttempts,
            error: result.error.slice(0, 500),
          },
        });
        summary.skipped += 1;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const nextAttempts = row.attempts + 1;
      await db.emailLog.update({
        where: { id: row.id },
        data: {
          attempts: nextAttempts,
          error: message.slice(0, 500),
          ...(nextAttempts >= MAX_ATTEMPTS ? { status: "FAILED" as const } : {}),
        },
      });
      logger.error(
        { emailLogId: row.id, to: maskEmail(row.to), err: error },
        "Falha no retry de e-mail",
      );
      if (nextAttempts >= MAX_ATTEMPTS) summary.failed += 1;
      else summary.skipped += 1;
    }
  }

  return summary;
}

/** Admin: recoloca e-mail na fila (attempts=0, QUEUED). */
export async function resetEmailForRetry(emailLogId: string): Promise<void> {
  const row = await db.emailLog.findUnique({ where: { id: emailLogId } });
  if (!row) throw notFound("E-mail não encontrado.");
  if (!row.payload) {
    throw validation("Este e-mail não tem payload para reenvio.");
  }
  await db.emailLog.update({
    where: { id: emailLogId },
    data: { status: "QUEUED", attempts: 0, error: null, sentAt: null, providerId: null },
  });
}
