import Link from "next/link";

import { cn } from "@/lib/utils";

export type BrandProps = {
  /** `light` para uso sobre navy, `dark` sobre fundo claro. */
  tone?: "light" | "dark";
  href?: string;
  className?: string;
};

/**
 * Marca do Affiliate Tool.
 *
 * Placeholder tipográfico em Playfair até o SVG oficial chegar da designer
 * (pendência externa registrada em docs/PROGRESS.md).
 */
export function Brand({ tone = "dark", href = "/", className }: BrandProps) {
  const content = (
    <span className={cn("inline-flex items-baseline gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "inline-block size-2.5 shrink-0 translate-y-[-1px] rounded-full",
          tone === "light" ? "bg-gold-500" : "bg-gold-700",
        )}
      />
      <span
        className={cn(
          "font-display text-lg leading-none tracking-tight",
          tone === "light" ? "text-white" : "text-navy-900",
        )}
      >
        Affiliate Tool
      </span>
    </span>
  );

  if (href === "") return content;

  return (
    <Link href={href} className="rounded-sm" aria-label="Affiliate Tool — página inicial">
      {content}
    </Link>
  );
}
