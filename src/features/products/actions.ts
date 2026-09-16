"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import {
  archiveProductSchema,
  createProductSchema,
  deleteProductSchema,
  publishProductSchema,
  reorderProductsSchema,
  updateProductSchema,
} from "@/features/products/schemas";
import {
  createProduct as createProductService,
  deleteProduct as deleteProductService,
  reorderProducts as reorderProductsService,
  setProductStatus,
  updateProduct as updateProductService,
} from "@/features/products/service";
import { adminAction } from "@/lib/safe-action";

function revalidateProducts(paths: string[] = []): void {
  revalidateTag("products", "max");
  revalidatePath("/");
  revalidatePath("/admin/produtos", "layout");
  for (const path of paths) revalidatePath(path);
}

export const createProduct = adminAction({
  name: "product.create",
  schema: createProductSchema,
  async handler(input) {
    const result = await createProductService(input);
    revalidateProducts([`/admin/produtos/${result.id}`, `/p/${input.slug}`]);
    return result;
  },
  audit: (result, input) => ({
    action: "product.create",
    entity: "Product",
    entityId: result.id,
    after: { name: input.name, slug: input.slug, status: input.status, type: input.type },
  }),
});

export const updateProduct = adminAction({
  name: "product.update",
  schema: updateProductSchema,
  async handler(input) {
    const { id, ...data } = input;
    const result = await updateProductService(id, data);
    revalidateProducts([
      `/admin/produtos/${id}`,
      `/p/${data.slug}`,
      ...(result.previousSlug ? [`/p/${result.previousSlug}`] : []),
    ]);
    return result;
  },
  audit: (result, input) => ({
    action: "product.update",
    entity: "Product",
    entityId: result.id,
    after: {
      name: input.name,
      slug: input.slug,
      status: input.status,
      slugChanged: result.slugChanged,
    },
  }),
});

export const publishProduct = adminAction({
  name: "product.publish",
  schema: publishProductSchema,
  async handler(input) {
    const result = await setProductStatus(input.id, "ACTIVE");
    revalidateProducts([`/admin/produtos/${input.id}`]);
    return result;
  },
  audit: (_result, input) => ({
    action: "product.publish",
    entity: "Product",
    entityId: input.id,
    after: { status: "ACTIVE" },
  }),
});

export const archiveProduct = adminAction({
  name: "product.archive",
  schema: archiveProductSchema,
  async handler(input) {
    const result = await setProductStatus(input.id, "ARCHIVED");
    revalidateProducts([`/admin/produtos/${input.id}`]);
    return result;
  },
  audit: (_result, input) => ({
    action: "product.archive",
    entity: "Product",
    entityId: input.id,
    after: { status: "ARCHIVED" },
  }),
});

export const deleteProduct = adminAction({
  name: "product.delete",
  schema: deleteProductSchema,
  async handler(input) {
    const result = await deleteProductService(input.id, input.confirmName);
    revalidateProducts();
    return result;
  },
  audit: (_result, input) => ({
    action: "product.delete",
    entity: "Product",
    entityId: input.id,
    after: { deleted: true },
  }),
});

export const reorderProducts = adminAction({
  name: "product.reorder",
  schema: reorderProductsSchema,
  async handler(input) {
    await reorderProductsService(input.orderedIds);
    revalidateProducts();
    return { ok: true as const };
  },
  audit: (_result, input) => ({
    action: "product.reorder",
    entity: "Product",
    entityId: "batch",
    after: { orderedIds: input.orderedIds },
  }),
});
