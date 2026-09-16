import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Download do comprovante: admin (qualquer lote) ou afiliado dono (lote PAID).
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ payoutId: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const { payoutId } = await context.params;
  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      status: true,
      proofPath: true,
      affiliateId: true,
      affiliate: { select: { userId: true } },
    },
  });

  if (!payout?.proofPath) {
    return NextResponse.json({ ok: false, error: "Comprovante não encontrado." }, { status: 404 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const isOwner =
    session.user.role === "AFFILIATE" &&
    payout.affiliate.userId === session.user.id &&
    payout.status === "PAID";

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 403 });
  }

  let absolute: string;
  try {
    absolute = resolveStoragePath(payout.proofPath);
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo inválido." }, { status: 400 });
  }

  let size: number;
  try {
    size = (await stat(absolute)).size;
  } catch {
    return NextResponse.json({ ok: false, error: "Arquivo não encontrado no storage." }, { status: 404 });
  }

  const ext = payout.proofPath.split(".").pop()?.toLowerCase() ?? "bin";
  const mime =
    ext === "pdf"
      ? "application/pdf"
      : ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

  const stream = createReadStream(absolute);
  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="comprovante-${payout.id}.${ext}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
