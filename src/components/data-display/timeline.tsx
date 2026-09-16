import { cn } from "@/lib/utils";

export type TimelineItem = {
  id: string;
  label: string;
  at?: string | null;
  active?: boolean;
  done?: boolean;
};

export type TimelineProps = {
  items: TimelineItem[];
  className?: string;
};

/** Timeline vertical simples para detalhe de pedido (admin e recibo). */
export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn("space-y-3", className)}>
      {items.map((item, index) => (
        <li key={item.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "mt-1 size-2.5 shrink-0 rounded-full",
                item.done || item.active ? "bg-teal-700" : "bg-mist-300",
              )}
              aria-hidden
            />
            {index < items.length - 1 ? (
              <span className="mt-1 w-px flex-1 bg-mist-200" aria-hidden />
            ) : null}
          </div>
          <div className="pb-3">
            <p
              className={cn(
                "text-sm font-medium",
                item.active ? "text-navy-900" : "text-navy-700",
              )}
            >
              {item.label}
            </p>
            {item.at ? <p className="text-xs text-muted-foreground">{item.at}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
