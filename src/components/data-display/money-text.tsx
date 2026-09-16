import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

export type MoneyTextProps = {
  /** Valor em centavos — nunca em reais (regra do CLAUDE.md). */
  cents: number;
  /**
   * `default` para tabelas; `highlight` é o dourado grande do card de ganhos e
   * **só funciona sobre navy** — gold-500 não atinge AA sobre fundo claro.
   */
  variant?: "default" | "highlight" | "muted";
  /** Mostra o sinal também quando positivo (extrato de ajustes). */
  showSign?: boolean;
  className?: string;
};

const VARIANTS = {
  default: "text-foreground",
  // Dourado só sobre navy ou em tamanho grande — nunca texto pequeno sobre branco.
  highlight: "font-display text-3xl text-gold-500",
  muted: "text-muted-foreground",
} as const satisfies Record<string, string>;

/**
 * Valor monetário formatado em pt-BR.
 *
 * `tabular-nums` mantém os dígitos alinhados quando aparecem empilhados numa
 * tabela ou lista de comissões.
 */
export function MoneyText({
  cents,
  variant = "default",
  showSign = false,
  className,
}: MoneyTextProps) {
  const formatted = formatBRL(cents);
  const withSign = showSign && cents > 0 ? `+${formatted}` : formatted;

  return (
    <span data-tabular className={cn("font-medium", VARIANTS[variant], className)}>
      {withSign}
    </span>
  );
}
