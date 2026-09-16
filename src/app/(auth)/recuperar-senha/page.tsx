import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar senha" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl text-navy-900">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe seu e-mail e enviamos um link para você criar uma nova senha.
        </p>
      </div>

      <ForgotPasswordForm />

      <p className="text-center text-sm text-muted-foreground">
        Lembrou?{" "}
        <Link href="/entrar" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
          Voltar para entrar
        </Link>
      </p>
    </div>
  );
}
