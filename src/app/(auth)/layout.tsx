import type { ReactNode } from "react";

import { Brand } from "@/components/layout/brand";

/**
 * Área de autenticação: entrar, cadastro, verificação de e-mail, recuperação.
 * Cartão branco centrado sobre `mist-100`, sem navegação — nada distrai do formulário.
 * As telas em si entram na fatia 01.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-mist-100 px-4 py-12">
      <Brand />
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-card sm:p-8">{children}</div>
    </div>
  );
}
