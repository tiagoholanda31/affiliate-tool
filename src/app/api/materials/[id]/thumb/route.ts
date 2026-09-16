import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

/** Thumb WebP do material IMAGE — admin ou afiliado APPROVED. */
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
    select: { thumbPath: true, isActive: true },
  });

  if (!material?.thumbPath) {
    return NextResponse.json({ ok: false, error: "Thumb não encontrado." }, { status: 404 });
  }

  if (session.user.role !== "ADMIN" && !material.isActive) {
    return NextResponse.json({ ok: false, error: "Thumb não encontrado." }, { status: 404 });
  }

  let absolute: string;
  try {
    absolute = resolveStoragePath(material.thumbPath);
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo inválido." }, { status: 400 });
  }

  let size: number;
  try {
    size = (await stat(absolute)).size;
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo não encontrado." }, { status: 404 });
  }

  const stream = createReadStream(absolute);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(size),
      "Cache-Control": "private, max-age=300",
    },
  });
}

async function canAccessMaterials(userId: string, role: string): Promise<boolean> {
  if (role === "ADMIN") return true;
  if (role !== "AFFILIATE") return false;
  const affiliate = await db.affiliate.findUnique({
    where: { userId },
    select: { status: true },
  });
  return affiliate?.status === "APPROVED";
}
