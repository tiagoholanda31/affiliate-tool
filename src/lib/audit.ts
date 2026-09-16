/**
 * Trilha de auditoria.
 *
 * Regra do CLAUDE.md: toda ação de admin e toda mudança de dinheiro ou de status
 * gera `AuditLog`. Quem registra é `safe-action.ts` (via a opção `audit`) ou,
 * quando o contexto não é uma action, o próprio serviço chamando `recordAudit`.
 *
 * `before`/`after` guardam o recorte relevante da entidade — nunca a entidade
 * inteira, para não copiar PII e chave Pix para dentro do log.
 */
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export type AuditActorRole = "ADMIN" | "AFFILIATE" | "SYSTEM";

export type AuditEntry = {
  /** `null` quando quem age é o sistema (job, webhook). */
  actorId: string | null;
  actorRole: AuditActorRole;
  /** Verbo pontuado: `auth.admin_login`, `affiliate.pix_change`, `payout.pay`. */
  action: string;
  entity: string;
  entityId: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
};

/**
 * Grava a entrada. Nunca lança: perder a trilha é ruim, mas desfazer a operação
 * que já aconteceu por causa disso seria pior. A falha vira log de erro.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorRole: entry.actorRole,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId,
        ...(entry.before === undefined ? {} : { before: entry.before }),
        ...(entry.after === undefined ? {} : { after: entry.after }),
        ip: entry.ip ?? null,
      },
    });
  } catch (error) {
    logger.error({ action: entry.action, entity: entry.entity, err: error }, "Falha ao auditar");
  }
}
