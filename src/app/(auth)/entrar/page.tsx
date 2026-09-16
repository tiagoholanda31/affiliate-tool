import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignInForm } from "./sign-in-form";
import { getSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar" };

/** Avisos que chegam por query string, sempre vindos de um redirect nosso. */
const NOTICES: Record<string, string> = {
  "conta-removida": "Sua conta foi encerrada. Fale com o suporte se isso não estava previsto.",
  "sessao-expirada": "Sua sessão expirou. Entre novamente para continuar.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; motivo?: string }>;
}) {
  const { next, motivo } = await searchParams;

  // Quem já está autenticado não tem o que fazer na tela de login.
  const session = await getSession();
  if (session) redirect(session.user.role === "ADMIN" ? "/admin" : "/painel");

  const notice = motivo ? NOTICES[motivo] : undefined;
  // `next` só é aceito se for caminho interno — senão vira open redirect.
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-navy-900">Entrar</h1>
        <p className="text-sm text-muted-foreground">
          Acesse o painel do Programa de Afiliados.
        </p>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-md border border-[color:var(--color-info)]/25 bg-[color:var(--color-info-bg)] p-3 text-sm text-[color:var(--color-info)]"
        >
          {notice}
        </p>
      ) : null}

      <SignInForm next={safeNext} />
    </div>
  );
}
