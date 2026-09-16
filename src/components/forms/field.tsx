"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Campo de formulário com rótulo, dica e mensagem de erro (docs/spec/05, item 5).
 *
 * A ligação de acessibilidade é feita por id derivado do `name`: o controle
 * aponta para a dica e para o erro em `aria-describedby`, e ganha
 * `aria-invalid` quando há erro. Sem isso, um leitor de tela anuncia o campo mas
 * não diz o que está errado nele.
 *
 * `fieldA11y()` devolve exatamente essas props para você espalhar no controle —
 * é a metade que o `Field` não consegue fazer sozinho, porque o controle vem de
 * fora (Input, Select, MaskedInput…).
 */

export function fieldIds(name: string) {
  return { inputId: name, hintId: `${name}-hint`, errorId: `${name}-error` };
}

/** Props de acessibilidade do controle. `hasHint` precisa refletir o `hint` do `Field`. */
export function fieldA11y(name: string, error?: string, hasHint = false) {
  const { inputId, hintId, errorId } = fieldIds(name);
  const describedBy = [hasHint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");

  return {
    id: inputId,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy || undefined,
  } as const;
}

export type FieldProps = {
  name: string;
  label: string;
  /** Texto de apoio permanente, acima do controle. */
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
};

export function Field({ name, label, hint, error, required, children, className }: FieldProps) {
  const { inputId, hintId, errorId } = fieldIds(name);

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>
        {label}
        {required ? (
          <span className="text-[color:var(--color-danger)]" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {children}

      {error ? (
        <p id={errorId} className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Resumo dos erros no topo do formulário, com link para cada campo.
 *
 * Existe para quem navega por teclado ou leitor de tela: sem ele, num
 * formulário longo, a pessoa descobre que algo falhou mas não onde. O
 * `aria-live` faz o resumo ser anunciado assim que aparece.
 */
export function FormErrorSummary({
  errors,
  title = "Confira os campos abaixo",
}: {
  /** Pares `nome do campo` → `rótulo visível`, na ordem do formulário. */
  errors: { name: string; label: string; message: string }[];
  title?: string;
}) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-bg)] p-3"
    >
      <p className="text-sm font-medium text-[color:var(--color-danger)]">{title}</p>
      <ul className="mt-1.5 space-y-1 text-sm text-[color:var(--color-danger)]">
        {errors.map((error) => (
          <li key={error.name}>
            <a href={`#${fieldIds(error.name).inputId}`} className="underline underline-offset-2">
              {error.label}
            </a>
            : {error.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Erro que não pertence a nenhum campo (falha do servidor, rate limit). */
export function FormAlert({ children }: { children: ReactNode }) {
  if (!children) return null;

  return (
    <p
      role="alert"
      aria-live="assertive"
      className="rounded-md border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger-bg)] p-3 text-sm text-[color:var(--color-danger)]"
    >
      {children}
    </p>
  );
}
