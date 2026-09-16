/**
 * Acesso ao banco a partir dos testes ponta a ponta.
 *
 * O e2e roda contra o app de verdade (`pnpm dev`), que usa o banco de
 * desenvolvimento. Os testes precisam do banco por dois motivos: limpar o que
 * criaram e pegar o link de confirmação de e-mail — que, com `MAIL_DRIVER=log`,
 * fica no `preview` do `EmailLog` (docs/spec/07).
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL não definida — o e2e precisa do mesmo banco do app.");
}

export const e2eDb = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

/** Apaga o usuário de teste e o que pende dele (sessões, afiliado, cliques). */
export async function removeUserByEmail(email: string): Promise<void> {
  const user = await e2eDb.user.findUnique({
    where: { email },
    select: { id: true, affiliate: { select: { id: true } } },
  });
  if (!user) return;

  await e2eDb.emailLog.deleteMany({ where: { to: email } });

  if (user.affiliate) {
    const affiliateId = user.affiliate.id;
    await e2eDb.click.deleteMany({ where: { affiliateId } });
    await e2eDb.downloadGrant.deleteMany({
      where: { order: { affiliateId } },
    });
    await e2eDb.commission.deleteMany({ where: { affiliateId } });
    await e2eDb.commissionAdjustment.deleteMany({ where: { affiliateId } });
    await e2eDb.payout.deleteMany({ where: { affiliateId } });
    await e2eDb.order.deleteMany({ where: { affiliateId } });
  }

  await e2eDb.user.deleteMany({ where: { email } });
}

export async function waitForOrderStatus(
  publicCode: string,
  status: "PAID" | "REFUNDED" | "FAILED",
  timeoutMs = 15_000,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const order = await e2eDb.order.findUnique({
      where: { publicCode },
      select: { status: true },
    });
    if (order?.status === status) return;
    await new Promise((resolve) => {
      setTimeout(resolve, 300);
    });
  }
  throw new Error(`Pedido ${publicCode} não chegou a ${status}.`);
}

/**
 * Extrai o link de confirmação do último e-mail enviado ao endereço.
 *
 * O `preview` guarda o HTML renderizado; o link aparece nele duas vezes (botão e
 * texto de reserva), então a primeira ocorrência basta.
 */
export async function getVerificationLink(email: string): Promise<string> {
  const log = await e2eDb.emailLog.findFirst({
    where: { to: email, template: "verify-email" },
    orderBy: { createdAt: "desc" },
    select: { preview: true },
  });

  const html = log?.preview;
  if (!html) {
    throw new Error(`Nenhum e-mail de confirmação encontrado para ${email}.`);
  }

  const match = /href="([^"]*\/api\/auth\/verify-email[^"]*)"/.exec(html);
  if (!match?.[1]) {
    throw new Error("O e-mail de confirmação não trazia o link esperado.");
  }

  // O React Email escapa os `&` do HTML; a URL precisa deles literais.
  return match[1].replaceAll("&amp;", "&");
}
