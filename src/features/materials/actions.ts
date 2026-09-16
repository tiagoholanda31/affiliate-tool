"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { adminAction } from "@/lib/safe-action";

import {
  createMaterialSchema,
  deleteMaterialSchema,
  reorderMaterialsSchema,
  setMaterialActiveSchema,
  updateMaterialSchema,
} from "./schemas";
import {
  createMaterial,
  deleteMaterial,
  reorderMaterials,
  setMaterialActive,
  updateMaterial,
} from "./service";

function revalidateMaterials(): void {
  revalidateTag("materials", "max");
  revalidatePath("/admin/materiais", "layout");
  revalidatePath("/painel/materiais", "layout");
  revalidatePath("/painel/links");
}

export const createMaterialAction = adminAction({
  name: "material.create",
  schema: createMaterialSchema,
  async handler(input) {
    const result = await createMaterial(input);
    revalidateMaterials();
    return result;
  },
  audit: (result, input) => ({
    action: "material.create",
    entity: "Material",
    entityId: result.id,
    after: { title: input.title, type: input.type, isActive: input.isActive },
  }),
});

export const updateMaterialAction = adminAction({
  name: "material.update",
  schema: updateMaterialSchema,
  async handler(input) {
    const { id, ...data } = input;
    const result = await updateMaterial(id, {
      title: data.title,
      description: data.description,
      type: data.type,
      productId: data.productId,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      textContent: data.textContent,
      externalUrl: data.externalUrl,
      file: data.file,
    });
    revalidateMaterials();
    return result;
  },
  audit: (result, input) => ({
    action: "material.update",
    entity: "Material",
    entityId: result.id,
    after: { title: input.title, type: input.type, isActive: input.isActive },
  }),
});

export const setMaterialActiveAction = adminAction({
  name: "material.setActive",
  schema: setMaterialActiveSchema,
  async handler(input) {
    const result = await setMaterialActive(input.id, input.isActive);
    revalidateMaterials();
    return result;
  },
  audit: (_result, input) => ({
    action: input.isActive ? "material.activate" : "material.deactivate",
    entity: "Material",
    entityId: input.id,
    after: { isActive: input.isActive },
  }),
});

export const deleteMaterialAction = adminAction({
  name: "material.delete",
  schema: deleteMaterialSchema,
  async handler(input) {
    await deleteMaterial(input.id, input.confirmTitle);
    revalidateMaterials();
    return { id: input.id };
  },
  audit: (_result, input) => ({
    action: "material.delete",
    entity: "Material",
    entityId: input.id,
  }),
});

export const reorderMaterialsAction = adminAction({
  name: "material.reorder",
  schema: reorderMaterialsSchema,
  async handler(input) {
    await reorderMaterials(input.orderedIds);
    revalidateMaterials();
    return { ok: true as const };
  },
});
