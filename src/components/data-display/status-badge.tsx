import { AlertTriangle, Ban, CheckCircle2, Clock, FileText, XCircle } from "lucide-react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";

/**
 * Tons semânticos de status (docs/spec/05, item 10).
 *
 * Regra de acessibilidade: status é sempre **ícone + cor + texto**. Nunca só cor —
 * quem não distingue verde de vermelho precisa continuar entendendo a tela.
 */
export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

/**
 * Cada tom usa o par exato verificado em `src/lib/design-tokens.ts` — por isso
 * `--color-success` e não `teal-700`: o teal do guia tem só 4,08:1 sobre o fundo
 * do badge, abaixo de AA.
 */
const TONE_STYLES: Record<StatusTone, string> = {
  success:
    "bg-[color:var(--color-success-bg)] text-[color:var(--color-success)] ring-[color:var(--color-success)]/20",
  warning:
    "bg-[color:var(--color-warning-bg)] text-[color:var(--color-warning)] ring-[color:var(--color-warning)]/20",
  danger:
    "bg-[color:var(--color-danger-bg)] text-[color:var(--color-danger)] ring-[color:var(--color-danger)]/20",
  neutral: "bg-mist-100 text-navy-700 ring-mist-300",
  info: "bg-[color:var(--color-info-bg)] text-[color:var(--color-info)] ring-[color:var(--color-info)]/20",
};

const TONE_ICONS: Record<StatusTone, ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  warning: Clock,
  danger: XCircle,
  neutral: Ban,
  info: FileText,
};

export type StatusBadgeProps = {
  /** Texto visível — sempre em português, nunca o valor cru do enum. */
  label: string;
  tone: StatusTone;
  /** Ícone alternativo, quando o padrão do tom não descreve bem o status. */
  icon?: ComponentType<{ className?: string }>;
  /** Explicação extra lida por leitores de tela (ex. "libera em 12/09"). */
  hint?: string;
  className?: string;
};

export function StatusBadge({ label, tone, icon, hint, className }: StatusBadgeProps) {
  const Icon = icon ?? TONE_ICONS[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONE_STYLES[tone],
        className,
      )}
      title={hint}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {label}
      {hint ? <span className="sr-only"> — {hint}</span> : null}
    </span>
  );
}

/** Ícone de alerta exportado para status que precisam chamar mais atenção. */
export const StatusAlertIcon = AlertTriangle;
