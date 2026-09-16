import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "./reset-password-form";
import { Button } from "@/components/ui/button";
import { AUTH_MESSAGES } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Criar nova senha" };

/**
 * O Better Auth valida o token antes de mandar a pessoa para cá: chega com
 * `?token=…` se estiver válido, ou `?error=INVALID_TOKEN` se não.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (error || !token) {
    return (
      <div className="space-y-5">
        <div className="space-y-1">
          <h1 className="font-display text-2xl text-navy-900">Link inválido</h1>
          <p className="text-sm text-navy-700">
            {AUTH_MESSAGES.linkExpired} Peça um novo — ele vale por 15 minutos.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/recuperar-senha">Pedir novo link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-navy-900">Criar nova senha</h1>
        <p className="text-sm text-muted-foreground">
          Escolha uma senha que você não use em outro site.
        </p>
      </div>

      <ResetPasswordForm token={token} />
    </div>
  );
}
