/**
 * Stream do arquivo digital por grant token.
 * Incrementa contador antes do stream; erros viram HTML amigável (sem path no disco).
 */
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import {
  contentDispositionAttachment,
  downloadFileName,
  validateAndConsume,
  type GrantFailureReason,
} from "@/features/delivery/service";
import { sha256 } from "@/lib/crypto";
import { getClientIp } from "@/lib/http";
import { logger } from "@/lib/logger";
import { consume } from "@/lib/rate-limit";
import { openStream } from "@/lib/storage";

export const runtime = "nodejs";

function errorPage(opts: {
  title: string;
  message: string;
  publicCode?: string;
}): NextResponse {
  const pedidoHref = opts.publicCode
    ? `/pedido/${encodeURIComponent(opts.publicCode)}`
    : "/";
  const cta = opts.publicCode ? "Ir para o pedido" : "Ir à vitrine";
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${opts.title} · Affiliate Tool</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0f2f4; color: #00172d;
      display: flex; min-height: 100vh; align-items: center; justify-content: center; margin: 0; }
    main { background: #fff; border-radius: 12px; padding: 2rem; max-width: 28rem;
      box-shadow: 0 1px 3px rgb(0 23 45 / 8%); text-align: center; }
    h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
    p { color: #163356; line-height: 1.5; }
    a { display: inline-block; margin-top: 1.25rem; padding: 0.75rem 1.25rem;
      background: #00172d; color: #fff; text-decoration: none; border-radius: 8px; }
    a:focus-visible { outline: 2px solid #e9be60; outline-offset: 2px; }
  </style>
</head>
<body>
  <main>
    <h1>${opts.title}</h1>
    <p>${opts.message}</p>
    <a href="${pedidoHref}">${cta}</a>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    status: opts.title.includes("encontrado") ? 404 : 403,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function messageFor(reason: GrantFailureReason): { title: string; message: string } {
  switch (reason) {
    case "EXPIRED":
      return {
        title: "Link expirado",
        message:
          "Este link de download expirou. Abra a página do pedido e peça um novo link por e-mail.",
      };
    case "LIMIT":
      return {
        title: "Limite atingido",
        message:
          "Você já usou todas as tentativas de download deste link. Peça um reenvio na página do pedido.",
      };
    case "REVOKED":
      return {
        title: "Link revogado",
        message:
          "Este link não é mais válido. Se o pedido foi estornado, o acesso foi removido. Caso contrário, peça um novo link.",
      };
    case "NOT_FOUND":
    default:
      return {
        title: "Link não encontrado",
        message: "Não encontramos um download válido para este endereço.",
      };
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token: rawToken } = await context.params;
  let token: string;
  try {
    token = decodeURIComponent(rawToken);
  } catch {
    const page = messageFor("NOT_FOUND");
    return errorPage({ ...page });
  }

  if (!token || token.length < 16) {
    const page = messageFor("NOT_FOUND");
    return errorPage({ ...page });
  }

  const ip = getClientIp(request.headers);
  const byToken = consume("download", `token:${sha256(token).slice(0, 16)}`);
  const byIp = consume("download", `ip:${ip}`);
  if (!byToken.ok || !byIp.ok) {
    return errorPage({
      title: "Muitas tentativas",
      message: "Aguarde um pouco e tente novamente.",
    });
  }

  let result;
  try {
    result = await validateAndConsume(token);
  } catch (error) {
    logger.error({ err: error }, "Falha ao validar grant de download");
    return errorPage({
      title: "Não foi possível baixar",
      message: "Tente novamente em instantes. Se o problema continuar, fale com o suporte.",
    });
  }

  if (!result.ok) {
    const page = messageFor(result.reason);
    return errorPage({
      ...page,
      publicCode: result.publicCode,
    });
  }

  const { data } = result;
  const fileName = downloadFileName(data.productName, data.fileExt);

  let stream;
  try {
    stream = openStream(data.storagePath);
  } catch (error) {
    logger.error(
      { grantId: data.grant.id, err: error },
      "Arquivo digital ausente no storage",
    );
    return errorPage({
      title: "Arquivo indisponível",
      message: "O arquivo não está disponível no momento. Fale com o suporte.",
      publicCode: data.publicCode,
    });
  }

  return new NextResponse(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": data.mimeType,
      "Content-Length": String(data.sizeBytes),
      "Content-Disposition": contentDispositionAttachment(fileName),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
