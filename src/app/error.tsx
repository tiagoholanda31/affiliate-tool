"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/feedback/error-state";

/**
 * Fronteira de erro da aplicação. A mensagem é sempre genérica — detalhe de erro
 * fica no log do servidor, nunca na tela (regra do CLAUDE.md).
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O `digest` permite achar o erro completo nos logs do servidor.
    console.error("Erro na página", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-mist-100 px-4">
      <ErrorState
        className="w-full max-w-md"
        title="Algo deu errado"
        description="Tivemos um problema ao carregar esta página. Tente novamente em instantes."
        onRetry={reset}
      />
    </div>
  );
}
