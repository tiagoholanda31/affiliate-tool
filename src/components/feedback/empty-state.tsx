import { Inbox } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  title: string;
  /** Explica o que fazer para sair do estado vazio. */
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  /** CTA — botão ou link. */
  action?: ReactNode;
  className?: string;
};

/**
 * Estado vazio de listas e painéis.
 *
 * Distinto de "sem resultados de filtro": vazio significa que ainda não existe
 * nada; sem resultados significa que o filtro escondeu tudo (docs/spec/05, item 1).
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-mist-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-mist-100">
        <Icon className="size-6 text-navy-700" aria-hidden="true" />
      </span>
      <p className="text-base font-medium text-foreground">{title}</p>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
