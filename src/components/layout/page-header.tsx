import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type PageHeaderProps = {
  title: string;
  /** Uma linha explicando a tela; some no mobile se for longa demais. */
  description?: string;
  /** Botões de ação alinhados à direita. */
  actions?: ReactNode;
  /** Breadcrumb ou badge acima do título. */
  eyebrow?: ReactNode;
  className?: string;
};

/**
 * Cabeçalho de página: H1 em Playfair (único lugar da fonte display junto com
 * os números de KPI) e ações à direita.
 */
export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow ? <div className="text-sm text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="font-display text-3xl text-navy-900">{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
