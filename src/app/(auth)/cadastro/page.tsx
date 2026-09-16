import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { RegisterForm } from "./register-form";
import { getSession } from "@/lib/auth";
import { getTermsVersion } from "@/lib/settings";

export const metadata: Metadata = { title: "Criar conta de afiliado" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(session.user.role === "ADMIN" ? "/admin" : "/painel");

  const { erro } = await searchParams;
  const termsVersion = await getTermsVersion();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-navy-900">Criar sua conta</h1>
        <p className="text-sm text-muted-foreground">
          Dois passos rápidos. Depois é só confirmar o e-mail e aguardar a análise.
        </p>
      </div>

      {erro === "cadastro-incompleto" ? (
        <p
          role="alert"
          className="rounded-md border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning-bg)] p-3 text-sm text-[color:var(--color-warning)]"
        >
          Seu cadastro ficou incompleto. Refaça o preenchimento ou fale com o suporte.
        </p>
      ) : null}

      <RegisterForm termsVersion={termsVersion} />
    </div>
  );
}
