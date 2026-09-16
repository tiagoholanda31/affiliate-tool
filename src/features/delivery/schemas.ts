/**
 * Schemas Zod da entrega digital (reenvio, posse por e-mail, admin).
 */
import { z } from "zod";

import { emailSchema } from "@/features/affiliates/schemas";

export const resendDownloadSchema = z.object({
  publicCode: z.string().min(1),
  accessToken: z.string().min(1),
});

export const requestOrderLinkSchema = z.object({
  publicCode: z.string().min(1),
  email: emailSchema,
});

export const adminResendDownloadSchema = z.object({
  orderId: z.string().min(1),
});

export const adminRevokeGrantsSchema = z.object({
  orderId: z.string().min(1),
});
