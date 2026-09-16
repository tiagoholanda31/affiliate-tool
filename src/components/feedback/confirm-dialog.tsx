"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MESSAGES } from "@/lib/i18n/pt-BR";

export type ConfirmDialogProps = {
  /** Elemento que abre o diálogo (normalmente um botão). */
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `destructive` pinta o botão de vermelho. */
  variant?: "default" | "destructive";
  /**
   * Quando informado, o botão de confirmar só habilita se o usuário digitar
   * exatamente este texto. Use o nome do afiliado/produto em ações destrutivas
   * (docs/spec/05, item 3): fricção proporcional ao estrago.
   */
  typeToConfirm?: string;
  /** Rótulo do campo de digitação; por padrão explica o que digitar. */
  typeToConfirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

/**
 * Diálogo de confirmação, com modo "digite para confirmar".
 *
 * O botão só é desabilitado enquanto envia ou enquanto o texto não confere —
 * nunca por "formulário inválido" (docs/spec/05, item 5).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = MESSAGES.confirm,
  cancelLabel = MESSAGES.cancel,
  variant = "default",
  typeToConfirm,
  typeToConfirmLabel,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId();

  const needsTyping = typeToConfirm !== undefined && typeToConfirm !== "";
  const matches = !needsTyping || typed.trim() === typeToConfirm.trim();
  const canConfirm = matches && !submitting;

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) setTyped("");
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    try {
      await onConfirm();
      handleOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{description}</div>
          </DialogDescription>
        </DialogHeader>

        {needsTyping ? (
          <div className="grid gap-2">
            <Label htmlFor={inputId}>
              {typeToConfirmLabel ?? (
                <>
                  Para confirmar, digite <strong className="font-semibold">{typeToConfirm}</strong>
                </>
              )}
            </Label>
            <Input
              id={inputId}
              value={typed}
              onChange={(event) => {
                setTyped(event.target.value);
              }}
              autoComplete="off"
              aria-describedby={`${inputId}-hint`}
            />
            <p id={`${inputId}-hint`} className="sr-only">
              O botão de confirmação só é habilitado quando o texto digitado for exatamente igual.
            </p>
          </div>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {submitting ? "Confirmando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
