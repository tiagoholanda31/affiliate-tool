/**
 * Envio de e-mail.
 *
 * `sendMail` é a única porta: grava `EmailLog QUEUED`, renderiza o template,
 * entrega ao driver e fecha o registro como `SENT` ou deixa `QUEUED` com
 * `attempts++` para o job de reenvio (`/api/cron/retry-emails`, fatia 10).
 *
 * Nunca lança. Um e-mail que não sai não pode derrubar o cadastro que o
 * disparou — o afiliado ficaria sem conta *e* sem e-mail. A falha vira log e
 * fica visível em `/admin/sistema`.
 */
import { render } from "@react-email/render";

import { EMAIL_TEMPLATES, type EmailTemplateName, type EmailTemplateProps } from "@emails/registry";
import { Prisma } from "@/generated/prisma/client";
import { maskEmail } from "@/lib/crypto";
import { db } from "@/lib/db";
import { getMailDriver } from "@/lib/mail/drivers";
import { logger } from "@/lib/logger";

/**
 * Teto diário de segurança do plano free do Resend (100/dia).
 * Ao encostar aqui, só o que a pessoa está esperando naquele instante sai; o
 * resto fica `QUEUED` e parte no dia seguinte (docs/spec/07, Regra de volume).
 */
const DAILY_SOFT_LIMIT = 90;

export type SendMailOptions<Name extends EmailTemplateName> = {
  to: string;
  template: Name;
  props: EmailTemplateProps[Name];
  replyTo?: string;
};

export type SendMailResult = {
  ok: boolean;
  emailLogId: string;
  /** `true` quando ficou para o dia seguinte por causa do limite diário. */
  deferred: boolean;
};

export type EmailPayload = {
  props: unknown;
  replyTo?: string;
};

/** Quantos e-mails já saíram hoje — base da regra de volume. */
async function sentToday(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  return db.emailLog.count({ where: { status: "SENT", sentAt: { gte: startOfDay } } });
}

export async function sendMail<Name extends EmailTemplateName>({
  to,
  template,
  props,
  replyTo,
}: SendMailOptions<Name>): Promise<SendMailResult> {
  const definition = EMAIL_TEMPLATES[template];

  const payload: EmailPayload = {
    props,
    ...(replyTo ? { replyTo } : {}),
  };

  const emailLog = await db.emailLog.create({
    data: {
      to,
      template,
      status: "QUEUED",
      payload: payload as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  try {
    if (definition.priority === "operational" && (await sentToday()) >= DAILY_SOFT_LIMIT) {
      logger.warn(
        { template, emailLogId: emailLog.id },
        "Limite diário de e-mails perto do teto; adiando envio operacional",
      );
      return { ok: false, emailLogId: emailLog.id, deferred: true };
    }

    const element = definition.render(props);
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    const driver = getMailDriver();
    const result = await driver.send({
      to,
      subject: definition.subject(props),
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });

    if (result.ok) {
      const driverIsLog = driver.name === "log";
      await db.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: result.providerId,
          attempts: { increment: 1 },
          error: null,
          // Só no driver `log`: em produção guardar corpo/payload seria guardar PII.
          ...(driverIsLog
            ? { preview: html }
            : { payload: Prisma.DbNull, preview: null }),
        },
      });
      return { ok: true, emailLogId: emailLog.id, deferred: false };
    }

    await db.emailLog.update({
      where: { id: emailLog.id },
      data: { attempts: { increment: 1 }, error: result.error },
    });
    logger.error({ template, to: maskEmail(to), error: result.error }, "Falha ao enviar e-mail");
    return { ok: false, emailLogId: emailLog.id, deferred: false };
  } catch (error) {
    // Render quebrado ou banco fora do ar: registra e segue. O job de reenvio
    // tenta de novo; o cadastro que disparou o e-mail não é desfeito por isso.
    await db.emailLog
      .update({
        where: { id: emailLog.id },
        data: {
          attempts: { increment: 1 },
          error: error instanceof Error ? error.message : String(error),
        },
      })
      .catch(() => undefined);

    logger.error({ template, to: maskEmail(to), err: error }, "Erro inesperado ao enviar e-mail");
    return { ok: false, emailLogId: emailLog.id, deferred: false };
  }
}

export { EMAIL_TEMPLATES, type EmailTemplateName, type EmailTemplateProps };
