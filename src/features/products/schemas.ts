import { z } from "zod";

import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { slugify } from "@/lib/slugify";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const productTypeSchema = z.enum(["SERVICE", "DIGITAL"]);
export const productStatusSchema = z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]);
export const commissionTypeSchema = z.enum(["PERCENT", "FIXED"]);

export const productSlugSchema = z
  .string()
  .trim()
  .min(2, FIELD_ERRORS.minLength(2))
  .max(80, FIELD_ERRORS.maxLength(80))
  .regex(slugRegex, "Use apenas letras minúsculas, números e hífen.");

const digitalFileDraftSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1).max(200),
  mimeType: z.enum(["application/pdf", "application/epub+zip"]),
  sizeBytes: z.number().int().positive().max(50 * 1024 * 1024),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

/**
 * Formulário único para SERVICE e DIGITAL.
 * Campos condicionais: DIGITAL exige arquivo para ACTIVE; SERVICE aceita deliveryNote.
 */
export const productFormSchema = z
  .object({
    name: z.string().trim().min(3, FIELD_ERRORS.minLength(3)).max(120, FIELD_ERRORS.maxLength(120)),
    slug: productSlugSchema,
    type: productTypeSchema,
    status: productStatusSchema.default("DRAFT"),
    shortDescription: z
      .string()
      .trim()
      .min(10, FIELD_ERRORS.minLength(10))
      .max(280, FIELD_ERRORS.maxLength(280)),
    description: z.string().trim().min(20, FIELD_ERRORS.minLength(20)).max(20_000),
    priceCents: z
      .number()
      .int()
      .min(100, "Preço mínimo é R$ 1,00.")
      .max(10_000_000, "Preço máximo é R$ 100.000,00."),
    compareAtPriceCents: z.number().int().positive().max(10_000_000).nullable().optional(),
    commissionType: commissionTypeSchema,
    commissionValue: z.number().int().min(0),
    coverImagePath: z.string().min(1).nullable().optional(),
    allowPix: z.boolean(),
    allowCard: z.boolean(),
    maxInstallments: z.number().int().min(1).max(12),
    deliveryNote: z.string().trim().max(500).nullable().optional(),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    /** Upload já validado pelo Route Handler; ligado ao salvar. */
    digitalFile: digitalFileDraftSchema.nullable().optional(),
    /** Confirmação explícita ao mudar slug de produto publicado. */
    confirmSlugChange: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.compareAtPriceCents != null && data.compareAtPriceCents <= data.priceCents) {
      ctx.addIssue({
        code: "custom",
        path: ["compareAtPriceCents"],
        message: "O preço “de” precisa ser maior que o preço de venda.",
      });
    }

    if (data.commissionType === "PERCENT") {
      if (data.commissionValue > 10_000) {
        ctx.addIssue({
          code: "custom",
          path: ["commissionValue"],
          message: "Comissão percentual máxima é 100%.",
        });
      }
    } else if (data.commissionValue > data.priceCents) {
      ctx.addIssue({
        code: "custom",
        path: ["commissionValue"],
        message: "Comissão fixa não pode passar do preço.",
      });
    }

    if (!data.allowPix && !data.allowCard) {
      ctx.addIssue({
        code: "custom",
        path: ["allowPix"],
        message: "Marque pelo menos um meio de pagamento.",
      });
    }

    if (!data.allowCard && data.maxInstallments !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["maxInstallments"],
        message: "Parcelas só se aplicam quando cartão está liberado.",
      });
    }

    if (data.type === "DIGITAL" && data.status === "ACTIVE" && !data.digitalFile) {
      ctx.addIssue({
        code: "custom",
        path: ["digitalFile"],
        message: "Produto digital só pode ser publicado com arquivo PDF ou EPUB.",
      });
    }

    if (data.type === "SERVICE" && data.digitalFile) {
      ctx.addIssue({
        code: "custom",
        path: ["digitalFile"],
        message: "Serviço não leva arquivo digital.",
      });
    }
  });

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormValues = z.output<typeof productFormSchema>;

export const productIdSchema = z.string().min(1, "Produto não informado.");

export const createProductSchema = productFormSchema;
export const updateProductSchema = productFormSchema.extend({
  id: productIdSchema,
});

export const publishProductSchema = z.object({ id: productIdSchema });
export const archiveProductSchema = z.object({ id: productIdSchema });
export const deleteProductSchema = z.object({
  id: productIdSchema,
  /** Nome digitado para confirmar exclusão. */
  confirmName: z.string().trim().min(1),
});

export const reorderProductsSchema = z.object({
  orderedIds: z.array(productIdSchema).min(1).max(200),
});

/** Sugere slug a partir do nome (client e server). */
export function suggestSlug(name: string): string {
  return slugify(name);
}
