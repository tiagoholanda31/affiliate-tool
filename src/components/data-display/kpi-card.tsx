import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { formatPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

export type KpiCardProps = {
  label: string;
  /** Já formatado (use `MoneyText` ou `Intl` antes de passar). */
  value: ReactNode;
  /** Contexto curto abaixo do número: "nos últimos 30 dias". */
  hint?: string;
  icon?: ComponentType<{ className?: string }>;
  /**
   * Variação vs. período anterior, em **basis points** (1240 = 12,4%), como todo
   * percentual do sistema. Positivo sobe, negativo desce.
   */
  trend?: { value: number; label: string };
  /** `gold` destaca o KPI principal do afiliado (saldo disponível). */
  variant?: "default" | "gold";
  className?: string;
};

/**
 * Cartão de indicador do dashboard.
 *
 * A variante `gold` usa dourado sobre navy — o único par em que o dourado tem
 * contraste suficiente para números grandes (docs/spec/05).
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  variant = "default",
  className,
}: KpiCardProps) {
  const isGold = variant === "gold";
  const TrendIcon = trend && trend.value < 0 ? ArrowDownRight : ArrowUpRight;

  return (
    <Card
      className={cn("shadow-card", isGold && "border-navy-800 bg-navy-900 text-white", className)}
    >
      <CardContent className="flex flex-col gap-2 p-6">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-sm font-medium",
              isGold ? "text-mist-300" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          {Icon ? (
            <Icon
              className={cn("size-4 shrink-0", isGold ? "text-gold-500" : "text-mist-300")}
              aria-hidden="true"
            />
          ) : null}
        </div>

        <span
          data-tabular
          className={cn(
            "font-display text-3xl leading-tight",
            isGold ? "text-gold-500" : "text-foreground",
          )}
        >
          {value}
        </span>

        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs",
              trend.value < 0 ? "text-[color:var(--color-danger)]" : "text-teal-700",
              isGold && "text-mist-300",
            )}
          >
            <TrendIcon className="size-3.5" aria-hidden="true" />
            {formatPercent(Math.abs(trend.value))}
            <span className={isGold ? "text-mist-300" : "text-muted-foreground"}>
              {trend.label}
            </span>
          </span>
        ) : null}

        {hint ? (
          <span className={cn("text-xs", isGold ? "text-mist-300" : "text-muted-foreground")}>
            {hint}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
