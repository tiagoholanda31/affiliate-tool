import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { isAppError, toUserMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { PROOF_MAX_BYTES, saveProofUpload } from "@/lib/proof-upload";
import {
  COVER_MAX_BYTES,
  DIGITAL_MAX_BYTES,
  MATERIAL_IMAGE_MAX_BYTES,
  MATERIAL_PDF_MAX_BYTES,
  saveCoverUpload,
  saveDigitalUpload,
  saveMaterialUpload,
} from "@/lib/uploads";

export const runtime = "nodejs";

type Kind = "cover" | "digital" | "proof" | "material";

function parseKind(value: string): Kind | null {
  if (value === "cover" || value === "digital" || value === "proof" || value === "material") {
    return value;
  }
  return null;
}

/**
 * Upload autenticado de capa, arquivo digital, comprovante ou material de divulgação.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  const session = await getSession();
  if (session?.user.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });
  }

  const kind = parseKind((await context.params).kind);
  if (!kind) {
    return NextResponse.json({ ok: false, error: "Tipo de upload inválido." }, { status: 400 });
  }

  // Material aceita IMAGE (10 MB) ou PDF (20 MB); o teto do FormData é o maior.
  const maxBytes =
    kind === "cover"
      ? COVER_MAX_BYTES
      : kind === "digital"
        ? DIGITAL_MAX_BYTES
        : kind === "material"
          ? MATERIAL_PDF_MAX_BYTES
          : PROOF_MAX_BYTES;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Não foi possível ler o arquivo." }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Arquivo obrigatório." }, { status: 400 });
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return NextResponse.json(
      { ok: false, error: `Arquivo muito grande. O limite é ${String(mb)} MB.` },
      { status: 413 },
    );
  }

  // Rejeita PDF > 20 MB já coberto; imagem > 10 MB antes de processar.
  if (kind === "material" && file.size > MATERIAL_IMAGE_MAX_BYTES) {
    const name = file.name.toLowerCase();
    const looksPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    if (!looksPdf) {
      return NextResponse.json(
        { ok: false, error: "Arquivo muito grande. O limite é 10 MB." },
        { status: 413 },
      );
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (kind === "cover") {
      const stored = await saveCoverUpload(buffer);
      return NextResponse.json({
        ok: true,
        data: {
          path: stored.path,
          sha256: stored.sha256,
          size: stored.size,
          mime: stored.mime,
        },
      });
    }

    if (kind === "proof") {
      const stored = await saveProofUpload(buffer, file.name);
      return NextResponse.json({
        ok: true,
        data: {
          path: stored.path,
          sha256: stored.sha256,
          size: stored.size,
          mime: stored.mime,
          originalName: stored.originalName,
        },
      });
    }

    if (kind === "material") {
      const stored = await saveMaterialUpload(buffer, file.name);
      return NextResponse.json({
        ok: true,
        data: {
          path: stored.path,
          thumbPath: stored.thumbPath,
          sha256: stored.sha256,
          size: stored.size,
          mime: stored.mime,
          originalName: stored.originalName,
        },
      });
    }

    const stored = await saveDigitalUpload(buffer, file.name);
    return NextResponse.json({
      ok: true,
      data: {
        path: stored.path,
        sha256: stored.sha256,
        size: stored.size,
        mime: stored.mime,
        originalName: stored.originalName,
      },
    });
  } catch (error) {
    if (isAppError(error) && error.expose) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    logger.error({ err: error, kind }, "Falha no upload admin");
    return NextResponse.json({ ok: false, error: toUserMessage(error) }, { status: 500 });
  }
}
