export type MaterialTypeValue = "IMAGE" | "PDF" | "TEXT" | "LINK";

/** Shape seguro para UI (sem caminhos absolutos). */
export type MaterialCard = {
  id: string;
  title: string;
  description: string | null;
  type: MaterialTypeValue;
  fileName: string | null;
  thumbPath: string | null;
  textContent: string | null;
  externalUrl: string | null;
  productId: string | null;
  product: { id: string; name: string; slug: string } | null;
};

export type AdminMaterialListItem = {
  id: string;
  title: string;
  type: MaterialTypeValue;
  isActive: boolean;
  sortOrder: number;
  thumbPath: string | null;
  productName: string | null;
  downloadCount: number;
  updatedAt: Date;
};
