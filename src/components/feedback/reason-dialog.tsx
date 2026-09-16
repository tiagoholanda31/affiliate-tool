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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MESSAGES } from "@/lib/i18n/pt-BR";

export type ReasonDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  /** Rótulo do campo — deixe claro se o afiliado vai ler o motivo. */
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  /** Motivo curto demais não ajuda quem recebe a recusa. */
  minLength?: number;
  maxLength?: number;
  onConfirm: (reason: string) => void | Promise<void>;
};

/**
 * Diálogo que exige um motivo escrito — reprovar afiliado, suspender, estornar.
 * O motivo vai para o `AuditLog` e, em vários casos, para o e-mail do afiliado.
 */
export function ReasonDialog({
  trigger,
  title,
  description,
  label = "Motivo",
  placeholder = "Explique em poucas palavras…",
  confirmLabel = MESSAGES.confirm,
  variant = "default",
  minLength = 10,
  maxLength = 500,
  onConfirm,
}: ReasonDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fieldId = useId();

  const trimmed = reason.trim();
  const tooShort = trimmed.length < minLength;
  const canConfirm = !tooShort && !submitting;

  function handleOpenChange(next: boolean): void {
    setOpen(next);
    if (!next) setReason("");
  }

  async function handleConfirm(): Promise<void> {
    setSubmitting(true);
    try {
      await onConfirm(trimmed);
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
          {description ? (
            <DialogDescription asChild>
              <div className="text-sm text-muted-foreground">{description}</div>
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="grid gap-2">
          <Label htmlFor={fieldId}>{label}</Label>
          <Textarea
            id={fieldId}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value.slice(0, maxLength));
            }}
            placeholder={placeholder}
            rows={4}
            aria-describedby={`${fieldId}-hint`}
          />
          <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
            {tooShort
              ? `Escreva pelo menos ${String(minLength)} caracteres.`
              : `${String(trimmed.length)}/${String(maxLength)} caracteres.`}
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={submitting}>
              {MESSAGES.cancel}
            </Button>
          </DialogClose>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={!canConfirm}
            onClick={() => {
              void handleConfirm();
            }}
          >
            {submitting ? "Enviando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
