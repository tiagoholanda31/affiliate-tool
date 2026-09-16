/**
 * Drivers de envio de e-mail (docs/spec/07).
 *
 * - `resend`  — produção. Plano free: 3.000/mês, 100/dia, 1 domínio verificado.
 * - `smtp`    — alternativa (qualquer SMTP autenticado), caso o domínio no Resend caia.
 * - `log`     — dev, test e e2e: não envia nada, imprime e deixa o rastro no
 *               `EmailLog`, de onde o teste e2e lê o link de confirmação.
 *
 * Todos devolvem o mesmo formato. Quem chama (`sendMail`) não sabe qual está
 * ativo — trocar de provedor é mudar `MAIL_DRIVER`, não mudar código.
 *
 * `resend` e `nodemailer` são importados sob demanda: em dev e nos testes o
 * driver é `log`, e não faz sentido carregar o SDK de um provedor que não será
 * usado.
 */
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type MailSendResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export type MailDriver = {
  name: "resend" | "smtp" | "log";
  send: (message: MailMessage) => Promise<MailSendResult>;
};

/** Mensagem de erro curta, sem stack e sem corpo do e-mail. */
function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const logDriver: MailDriver = {
  name: "log",
  async send(message) {
    logger.info(
      { to: message.to, subject: message.subject, bytes: message.html.length },
      "E-mail (driver log) — nada foi enviado de verdade",
    );
    return Promise.resolve({ ok: true, providerId: null });
  },
};

const resendDriver: MailDriver = {
  name: "resend",
  async send(message) {
    if (!env.RESEND_API_KEY) {
      return { ok: false, error: "RESEND_API_KEY não configurada." };
    }

    try {
      const { Resend } = await import("resend");
      const client = new Resend(env.RESEND_API_KEY);

      const response = await client.emails.send({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });

      if (response.error) {
        return { ok: false, error: response.error.message };
      }
      return { ok: true, providerId: response.data.id };
    } catch (error) {
      return { ok: false, error: describeError(error) };
    }
  },
};

const smtpDriver: MailDriver = {
  name: "smtp",
  async send(message) {
    if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
      return { ok: false, error: "Credenciais SMTP incompletas." };
    }

    try {
      const nodemailer = await import("nodemailer");
      const port = env.SMTP_PORT ?? 465;

      const transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        // 465 é SSL implícito; 587 sobe para TLS com STARTTLS.
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      });

      const info = await transport.sendMail({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });

      return { ok: true, providerId: info.messageId };
    } catch (error) {
      return { ok: false, error: describeError(error) };
    }
  },
};

const DRIVERS: Record<typeof env.MAIL_DRIVER, MailDriver> = {
  resend: resendDriver,
  smtp: smtpDriver,
  log: logDriver,
};

export function getMailDriver(): MailDriver {
  return DRIVERS[env.MAIL_DRIVER];
}
