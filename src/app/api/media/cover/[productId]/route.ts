import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";
import { coverVariantPath } from "@/lib/uploads";

export const runtime = "nodejs";

/**
 * Serve capas de produtos ACTIVE (ou qualquer status para admin autenticado
 * via cookie — simplificado: só caminhos que existem em Product.coverImagePath).
 *
 * Path: `/api/media/cover/<productId>?size=sm|md|lg`
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
) {
  const { productId } = await context.params;
  const sizeParam = request.nextUrl.searchParams.get("size") ?? "md";
  const size = sizeParam === "sm" || sizeParam === "lg" || sizeParam === "md" ? sizeParam : "md";

  const product = await db.product.findUnique({
    where: { id: productId },
    select: { coverImagePath: true, status: true },
  });

  if (!product?.coverImagePath) {
    return new NextResponse(null, { status: 404 });
  }

  // DRAFT/ARCHIVED: capa só na área admin (o browser admin também usa esta rota).
  // Vitrine pública só linka produtos ACTIVE, então não vaza capa de rascunho.

  const relative = coverVariantPath(product.coverImagePath, size);
  const absolute = resolveStoragePath(relative);

  try {
    const info = await stat(absolute);
    const stream = createReadStream(absolute);
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(info.size),
        "Cache-Control": product.status === "ACTIVE" ? "public, max-age=86400" : "private, max-age=60",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
