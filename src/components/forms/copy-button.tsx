"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export type CopyButtonProps = {
  value: string;
  /** Texto do botão; sem ele fica só o ícone (com rótulo acessível). */
  label?: string;
  /** O que o toast diz — "Link copiado", "Código Pix copiado". */
  successMessage?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
};

/** Quanto tempo o botão mostra "Copiado" antes de voltar ao normal. */
const FEEDBACK_MS = 2000;

/**
 * Copia um valor para a área de transferência com feedback imediato
 * (docs/spec/05, item 4). Cai para `document.execCommand` onde a Clipboard API
 * não existe ou foi negada — em `http://` no celular ela não está disponível.
 */
export function CopyButton({
  value,
  label,
  successMessage = MESSAGES.copied,
  variant = "outline",
  size = label ? "default" : "icon",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function handleCopy(): Promise<void> {
    const ok = await copyToClipboard(value);

    if (!ok) {
      toast.error(MESSAGES.copyFailed);
      return;
    }

    setCopied(true);
    toast.success(successMessage);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
    }, FEEDBACK_MS);
  }

  const Icon = copied ? Check : Copy;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={() => {
        void handleCopy();
      }}
      aria-label={label ? undefined : copied ? successMessage : "Copiar"}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label ? <span>{copied ? successMessage : label}</span> : null}
      {/* Anuncia a cópia para leitores de tela, que não veem a troca de ícone. */}
      <span aria-live="polite" className="sr-only">
        {copied ? successMessage : ""}
      </span>
    </Button>
  );
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard as Clipboard | undefined) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Cai para o método legado abaixo.
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    // Depreciado, mas é o único caminho quando a Clipboard API não existe ou foi
    // negada — acontece em `http://` no celular, cenário real do afiliado que
    // acessa o painel por um link sem TLS. Só roda como último recurso.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
