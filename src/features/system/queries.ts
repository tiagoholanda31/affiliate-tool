/**
 * Consultas da página admin Sistema (webhooks, jobs, e-mails, auditoria).
 */
import type { EmailStatus, Prisma, WebhookStatus } from "@/generated/prisma/client";

import { db } from "@/lib/db";
import { formatRelative } from "@/lib/dates";

const PAGE_SIZE = 25;

export const JOB_SCHEDULE = [
  { name: "release-commissions", label: "Liberar comissões", intervalMs: 24 * 60 * 60 * 1000 },
  { name: "reconcile-orders", label: "Reconciliar pedidos", intervalMs: 15 * 60 * 1000 },
  { name: "anonymize-removed", label: "Anonimizar removidos", intervalMs: 24 * 60 * 60 * 1000 },
  { name: "retry-emails", label: "Reenviar e-mails", intervalMs: 10 * 60 * 1000 },
  { name: "purge-clicks", label: "Purgar cliques", intervalMs: 24 * 60 * 60 * 1000 },
] as const;

export type JobScheduleName = (typeof JOB_SCHEDULE)[number]["name"];

export type JobStatusRow = {
  name: string;
  label: string;
  intervalMs: number;
  lastStartedAt: Date | null;
  lastFinishedAt: Date | null;
  lastOk: boolean | null;
  lastError: string | null;
  overdue: boolean;
  relativeLabel: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listWebhookEvents(opts: {
  status?: WebhookStatus;
  page?: number;
}): Promise<Paginated<{
  id: string;
  eventId: string;
  type: string;
  status: WebhookStatus;
  error: string | null;
  receivedAt: Date;
  processedAt: Date | null;
}>> {
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.WebhookEventWhereInput = {};
  if (opts.status) where.status = opts.status;

  const [items, total] = await Promise.all([
    db.webhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        eventId: true,
        type: true,
        status: true,
        error: true,
        receivedAt: true,
        processedAt: true,
      },
    }),
    db.webhookEvent.count({ where }),
  ]);

  return { items, total, page, pageSize: PAGE_SIZE };
}

export async function listJobRuns(opts: {
  name?: string;
  page?: number;
}): Promise<Paginated<{
  id: string;
  name: string;
  startedAt: Date;
  finishedAt: Date | null;
  ok: boolean | null;
  summary: Prisma.JsonValue | null;
  error: string | null;
}>> {
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.JobRunWhereInput = {};
  if (opts.name) where.name = opts.name;

  const [items, total] = await Promise.all([
    db.jobRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.jobRun.count({ where }),
  ]);

  return { items, total, page, pageSize: PAGE_SIZE };
}

/** Última execução por job conhecido + flag overdue (> 2× intervalo ou nunca). */
export async function getJobScheduleStatus(now: Date = new Date()): Promise<JobStatusRow[]> {
  const names = JOB_SCHEDULE.map((j) => j.name);
  const latest = await db.jobRun.findMany({
    where: { name: { in: [...names] } },
    orderBy: { startedAt: "desc" },
    distinct: ["name"],
  });
  const byName = new Map(latest.map((r) => [r.name, r]));

  return JOB_SCHEDULE.map((job) => {
    const run = byName.get(job.name);
    const lastFinishedAt = run?.finishedAt ?? null;
    const overdue =
      !lastFinishedAt || now.getTime() - lastFinishedAt.getTime() > job.intervalMs * 2;

    return {
      name: job.name,
      label: job.label,
      intervalMs: job.intervalMs,
      lastStartedAt: run?.startedAt ?? null,
      lastFinishedAt,
      lastOk: run?.ok ?? null,
      lastError: run?.error ?? null,
      overdue,
      relativeLabel: lastFinishedAt
        ? formatRelative(lastFinishedAt, now)
        : "nunca executou",
    };
  });
}

export async function listEmailLogs(opts: {
  status?: EmailStatus;
  page?: number;
}): Promise<Paginated<{
  id: string;
  to: string;
  template: string;
  status: EmailStatus;
  attempts: number;
  error: string | null;
  createdAt: Date;
  sentAt: Date | null;
  hasPayload: boolean;
}>> {
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.EmailLogWhereInput = {};
  if (opts.status) where.status = opts.status;

  const [rows, total] = await Promise.all([
    db.emailLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        to: true,
        template: true,
        status: true,
        attempts: true,
        error: true,
        createdAt: true,
        sentAt: true,
        payload: true,
      },
    }),
    db.emailLog.count({ where }),
  ]);

  return {
    items: rows.map(({ payload, ...rest }) => ({
      ...rest,
      hasPayload: payload != null,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}

export async function listAuditLogs(opts: {
  entity?: string;
  actorId?: string;
  action?: string;
  page?: number;
}): Promise<Paginated<{
  id: string;
  actorId: string | null;
  actorRole: string;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  createdAt: Date;
}>> {
  const page = Math.max(1, opts.page ?? 1);
  const where: Prisma.AuditLogWhereInput = {};
  if (opts.entity?.trim()) {
    where.entity = { contains: opts.entity.trim(), mode: "insensitive" };
  }
  if (opts.actorId?.trim()) where.actorId = opts.actorId.trim();
  if (opts.action?.trim()) {
    where.action = { contains: opts.action.trim(), mode: "insensitive" };
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        actor: { select: { name: true } },
      },
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorRole: r.actorRole,
      actorName: r.actor?.name ?? null,
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      before: r.before,
      after: r.after,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  };
}
