"use server";

import { revalidatePath } from "next/cache";

import { reprocessWebhookEvent } from "@/features/orders/webhook";
import { retryEmailSchema, reprocessWebhookSchema } from "@/features/system/schemas";
import { AppError } from "@/lib/errors";
import { resetEmailForRetry } from "@/lib/mail/retry";
import { adminAction } from "@/lib/safe-action";

export const reprocessWebhookAction = adminAction({
  name: "system.reprocessWebhook",
  schema: reprocessWebhookSchema,
  async handler(input) {
    const result = await reprocessWebhookEvent(input.eventId);
    if (!result.ok) {
      throw new AppError("INTERNAL", result.error, { expose: true });
    }
    revalidatePath("/admin/sistema");
    return {
      ok: true as const,
      duplicateProcessed: result.duplicateProcessed ?? false,
      ignored: result.ignored ?? false,
    };
  },
  audit: (_result, input) => ({
    action: "system.reprocess_webhook",
    entity: "WebhookEvent",
    entityId: input.eventId,
  }),
});

export const retryEmailAction = adminAction({
  name: "system.retryEmail",
  schema: retryEmailSchema,
  async handler(input) {
    await resetEmailForRetry(input.emailLogId);
    revalidatePath("/admin/sistema");
    return { ok: true as const };
  },
  audit: (_result, input) => ({
    action: "system.retry_email",
    entity: "EmailLog",
    entityId: input.emailLogId,
  }),
});
