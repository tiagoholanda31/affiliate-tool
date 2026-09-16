import { z } from "zod";

import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { MATERIAL_IMAGE_MAX_BYTES, MATERIAL_PDF_MAX_BYTES } from "@/lib/upload-limits";

export const materialTypeSchema = z.enum(["IMAGE", "PDF", "TEXT", "LINK"]);
export type MaterialTypeValue = z.infer<typeof materialTypeSchema>;

const fileDraftSchema = z.object({
  path: z.string().min(1),
  originalName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  thumbPath: z.string().min(1).optional(),
});

/**
 * Formulário admin — campos condicionais por `type`.
 * IMAGE/PDF exigem arquivo; TEXT exige texto; LINK exige URL https.
 */
export const materialFormSchema = z
  .object({
    title: z.string().trim().min(3, FIELD_ERRORS.minLength(3)).max(120, FIELD_ERRORS.maxLength(120)),
    description: z
      .string()
      .trim()
      .max(500, FIELD_ERRORS.maxLength(500))
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    type: materialTypeSchema,
    productId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    textContent: z
      .string()
      .trim()
      .max(5_000, FIELD_ERRORS.maxLength(5_000))
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    externalUrl: z
      .string()
      .trim()
      .max(2_000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    file: fileDraftSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "IMAGE") {
      if (!data.file) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Envie uma imagem JPEG, PNG ou WebP.",
        });
      } else {
        if (!["image/jpeg", "image/png", "image/webp"].includes(data.file.mimeType)) {
          ctx.addIssue({
            code: "custom",
            path: ["file"],
            message: "Imagem inválida. Use JPEG, PNG ou WebP.",
          });
        }
        if (data.file.sizeBytes > MATERIAL_IMAGE_MAX_BYTES) {
          ctx.addIssue({
            code: "custom",
            path: ["file"],
            message: "Imagem muito grande. O limite é 10 MB.",
          });
        }
      }
      if (data.textContent) {
        ctx.addIssue({
          code: "custom",
          path: ["textContent"],
          message: "Imagem não leva texto.",
        });
      }
      if (data.externalUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "Imagem não leva URL externa.",
        });
      }
    }

    if (data.type === "PDF") {
      if (!data.file) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Envie um PDF.",
        });
      } else {
        if (data.file.mimeType !== "application/pdf") {
          ctx.addIssue({
            code: "custom",
            path: ["file"],
            message: "Arquivo inválido. Envie um PDF.",
          });
        }
        if (data.file.sizeBytes > MATERIAL_PDF_MAX_BYTES) {
          ctx.addIssue({
            code: "custom",
            path: ["file"],
            message: "PDF muito grande. O limite é 20 MB.",
          });
        }
      }
      if (data.textContent) {
        ctx.addIssue({
          code: "custom",
          path: ["textContent"],
          message: "PDF não leva texto.",
        });
      }
      if (data.externalUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "PDF não leva URL externa.",
        });
      }
    }

    if (data.type === "TEXT") {
      if (!data.textContent || data.textContent.length < 5) {
        ctx.addIssue({
          code: "custom",
          path: ["textContent"],
          message: "Informe o texto (mín. 5 caracteres). Use {{link}} para o link do afiliado.",
        });
      }
      if (data.file) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Texto não leva arquivo.",
        });
      }
      if (data.externalUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "Texto não leva URL externa.",
        });
      }
    }

    if (data.type === "LINK") {
      if (!data.externalUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "Informe a URL do material.",
        });
      } else {
        const parsed = z.url().safeParse(data.externalUrl);
        if (!parsed.success) {
          ctx.addIssue({
            code: "custom",
            path: ["externalUrl"],
            message: "URL inválida.",
          });
        } else if (!/^https?:\/\//i.test(data.externalUrl)) {
          ctx.addIssue({
            code: "custom",
            path: ["externalUrl"],
            message: "Use uma URL http ou https.",
          });
        }
      }
      if (data.file) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Link não leva arquivo.",
        });
      }
      if (data.textContent) {
        ctx.addIssue({
          code: "custom",
          path: ["textContent"],
          message: "Link não leva texto de copy.",
        });
      }
    }
  });

export type MaterialFormInput = z.input<typeof materialFormSchema>;
export type MaterialFormValues = z.output<typeof materialFormSchema>;

export const materialIdSchema = z.string().min(1, "Material não informado.");

export const createMaterialSchema = materialFormSchema;

/** Edição: arquivo opcional se o material já tiver um no banco (validado no service). */
export const updateMaterialSchema = z
  .object({
    id: materialIdSchema,
    title: z.string().trim().min(3, FIELD_ERRORS.minLength(3)).max(120, FIELD_ERRORS.maxLength(120)),
    description: z
      .string()
      .trim()
      .max(500, FIELD_ERRORS.maxLength(500))
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    type: materialTypeSchema,
    productId: z
      .string()
      .min(1)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    textContent: z
      .string()
      .trim()
      .max(5_000, FIELD_ERRORS.maxLength(5_000))
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    externalUrl: z
      .string()
      .trim()
      .max(2_000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    file: fileDraftSchema.nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "TEXT") {
      if (!data.textContent || data.textContent.length < 5) {
        ctx.addIssue({
          code: "custom",
          path: ["textContent"],
          message: "Informe o texto (mín. 5 caracteres). Use {{link}} para o link do afiliado.",
        });
      }
    }
    if (data.type === "LINK") {
      if (!data.externalUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["externalUrl"],
          message: "Informe a URL do material.",
        });
      } else {
        const parsed = z.url().safeParse(data.externalUrl);
        if (!parsed.success) {
          ctx.addIssue({
            code: "custom",
            path: ["externalUrl"],
            message: "URL inválida.",
          });
        }
      }
    }
    if (data.type === "IMAGE" && data.file) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(data.file.mimeType)) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Imagem inválida. Use JPEG, PNG ou WebP.",
        });
      }
      if (data.file.sizeBytes > MATERIAL_IMAGE_MAX_BYTES) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Imagem muito grande. O limite é 10 MB.",
        });
      }
    }
    if (data.type === "PDF" && data.file) {
      if (data.file.mimeType !== "application/pdf") {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "Arquivo inválido. Envie um PDF.",
        });
      }
      if (data.file.sizeBytes > MATERIAL_PDF_MAX_BYTES) {
        ctx.addIssue({
          code: "custom",
          path: ["file"],
          message: "PDF muito grande. O limite é 20 MB.",
        });
      }
    }
  });

export type UpdateMaterialInput = z.input<typeof updateMaterialSchema>;
export type UpdateMaterialValues = z.output<typeof updateMaterialSchema>;

export const setMaterialActiveSchema = z.object({
  id: materialIdSchema,
  isActive: z.boolean(),
});

export const deleteMaterialSchema = z.object({
  id: materialIdSchema,
  confirmTitle: z.string().trim().min(1),
});

export const reorderMaterialsSchema = z.object({
  orderedIds: z.array(materialIdSchema).min(1).max(200),
});

/** Filtros da galeria do afiliado (URL). */
export const affiliateMaterialsFilterSchema = z.object({
  type: z.enum(["ALL", "IMAGE", "PDF", "TEXT", "LINK"]).default("ALL"),
  productId: z.string().min(1).optional(),
  q: z.string().trim().max(80).optional(),
});

export type AffiliateMaterialsFilter = z.infer<typeof affiliateMaterialsFilterSchema>;
