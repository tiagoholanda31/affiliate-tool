import { CheckCircle2, MailWarning } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ResendVerificationForm } from "./resend-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Confirmar e-mail" };

/**
 * Destino do link de confirmação.
 *
 * Quem verifica o token é o Better Auth, em `/api/auth/verify-email`; ele
 * redireciona para cá com `?status=ok` no sucesso ou acrescenta `?error=…`
 * quando o token expirou ou já foi usado. Esta página só interpreta o resultado
 * — e, no caso de erro, oferece o reenvio ali mesmo, sem obrigar a pessoa a
 * procurar onde pedir outro link (critério de aceite da fatia 01).
 */
const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: "Este link expirou. Peça um novo abaixo — ele vale por 24 horas.",
  INVALID_TOKEN: "Este link não é mais válido. Pode ser que já tenha sido usado.",
  USER_NOT_FOUND: "Não encontramos uma conta para este link.",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; reenviar?: string }>;
}) {
  const { status, error, reenviar } = await searchParams;

  if (error) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <MailWarning
            className="mt-0.5 size-6 shrink-0 text-[color:var(--color-warning)]"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <h1 className="font-display text-2xl text-navy-900">Link não funcionou</h1>
            <p className="text-sm text-navy-700">
              {ERROR_MESSAGES[error] ?? "Não foi possível confirmar seu e-mail com este link."}
            </p>
          </div>
        </div>

        <ResendVerificationForm />
      </div>
    );
  }

  if (status === "ok") {
    return (
      <div className="space-y-5 text-center" role="status">
        <CheckCircle2
          className="mx-auto size-10 text-[color:var(--color-success)]"
          aria-hidden="true"
        />
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-navy-900">E-mail confirmado</h1>
          <p className="text-sm text-navy-700">
            Seu cadastro entrou na fila de análise. Assim que for revisado, avisamos por e-mail.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/entrar">Entrar na minha conta</Link>
        </Button>
      </div>
    );
  }

  // Sem `status` nem `error`: a pessoa chegou aqui pelo "peça um novo link".
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-navy-900">
          {reenviar ? "Reenviar confirmação" : "Confirmar e-mail"}
        </h1>
        <p className="text-sm text-navy-700">
          Informe o e-mail do cadastro e enviamos um novo link de confirmação.
        </p>
      </div>

      <ResendVerificationForm />

      <p className="text-center text-sm text-muted-foreground">
        Já confirmou?{" "}
        <Link href="/entrar" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
          Entrar
        </Link>
      </p>
    </div>
  );
}
