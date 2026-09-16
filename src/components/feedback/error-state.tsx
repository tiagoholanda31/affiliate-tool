"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export type ErrorStateProps = {
  title?: string;
  /** Mensagem já tratada — nunca passe o erro cru do servidor. */
  description?: string;
  /** Sem isto o usuário fica sem saída; use o `reset` do error.tsx. */
  onRetry?: () => void;
  className?: string;
};

/** Estado de erro de uma lista, painel ou segmento de rota. */
export function ErrorState({
  title = "Não foi possível carregar",
  description = MESSAGES.genericError,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-[color:var(--color-danger)]/20 bg-[color:var(--color-danger-bg)] px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-white">
        <AlertTriangle className="size-6 text-[color:var(--color-danger)]" aria-hidden="true" />
      </span>
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry} className="mt-2 bg-white">
          <RotateCcw className="size-4" aria-hidden="true" />
          {MESSAGES.tryAgain}
        </Button>
      ) : null}
    </div>
  );
}
