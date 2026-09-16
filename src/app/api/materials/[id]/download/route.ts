import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { contentDispositionAttachment } from "@/features/delivery/service";
import { incrementDownloadCount } from "@/features/materials/service";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Download autenticado: admin ou afiliado APPROVED.
 * PENDING/SUSPENDED → 403.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const allowed = await canAccessMaterials(session.user.id, session.user.role);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  }

  const { id } = await context.params;
  const material = await db.material.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      isActive: true,
      filePath: true,
      fileName: true,
      mimeType: true,
    },
  });

  if (!material?.filePath || (material.type !== "IMAGE" && material.type !== "PDF")) {
    return NextResponse.json({ ok: false, error: "Material não encontrado." }, { status: 404 });
  }

  // Afiliado só vê ativos; admin pode baixar inativos.
  if (session.user.role !== "ADMIN" && !material.isActive) {
    return NextResponse.json({ ok: false, error: "Material não encontrado." }, { status: 404 });
  }

  let absolute: string;
  try {
    absolute = resolveStoragePath(material.filePath);
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo inválido." }, { status: 400 });
  }

  let size: number;
  try {
    size = (await stat(absolute)).size;
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo não encontrado no storage." }, { status: 404 });
  }

  await incrementDownloadCount(material.id).catch(() => undefined);

  const fileName = material.fileName ?? material.filePath.split("/").pop() ?? "material";
  const mime = material.mimeType ?? "application/octet-stream";
  const stream = createReadStream(absolute);

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": contentDispositionAttachment(fileName),
      "Cache-Control": "private, no-store",
    },
  });
}

async function canAccessMaterials(
  userId: string,
  role: string,
): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "AFFILIATE") return false;
  const affiliate = await db.affiliate.findUnique({
    where: { userId },
    select: { status: true },
  });
  return affiliate?.status === "APPROVED";
}
