"use client";

import { useEffect, useState } from "react";

import { formatDate, formatDateTime, formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type DateTextProps = {
  date: Date;
  /**
   * `relative` para listas ("há 2 horas"), `date` e `datetime` para extratos.
   * Em `relative` a data absoluta vai no `title` e no `dateTime` do `<time>`,
   * então continua acessível a quem passa o mouse ou usa leitor de tela.
   */
  format?: "relative" | "date" | "datetime";
  className?: string;
};

/** De quanto em quanto tempo o texto relativo se atualiza sozinho. */
const REFRESH_MS = 60_000;

/**
 * Data formatada no fuso de São Paulo, dentro de um `<time>` semântico.
 *
 * O texto relativo depende de "agora", que é diferente no servidor e no
 * navegador — renderizar direto quebraria a hidratação. Por isso o primeiro
 * render mostra a data absoluta e o relativo entra depois da montagem, se
 * atualizando a cada minuto (assim "há 2 min" não fica velho na tela).
 */
export function DateText({ date, format = "date", className }: DateTextProps) {
  const absolute = formatDateTime(date);
  const [relative, setRelative] = useState<string | null>(null);

  useEffect(() => {
    if (format !== "relative") return;

    const update = (): void => {
      setRelative(formatRelative(date));
    };

    update();
    const timer = setInterval(update, REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [date, format]);

  const text =
    format === "datetime"
      ? absolute
      : format === "relative"
        ? (relative ?? formatDate(date))
        : formatDate(date);

  return (
    <time
      dateTime={date.toISOString()}
      title={format === "relative" ? absolute : undefined}
      className={cn("text-sm", className)}
    >
      {text}
    </time>
  );
}
