import { z } from "zod";

export const reprocessWebhookSchema = z.object({
  eventId: z.string().min(1),
});

export const retryEmailSchema = z.object({
  emailLogId: z.string().min(1),
});

export const listWebhooksFilterSchema = z.object({
  status: z.enum(["RECEIVED", "PROCESSED", "IGNORED", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const listEmailsFilterSchema = z.object({
  status: z.enum(["QUEUED", "SENT", "FAILED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const listAuditFilterSchema = z.object({
  entity: z.string().max(120).optional(),
  actorId: z.string().max(120).optional(),
  action: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
