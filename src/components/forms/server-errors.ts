"use client";

/**
 * Ponte entre o `ActionResult` do servidor e o react-hook-form.
 *
 * O servidor revalida tudo (o client nunca é a autoridade), então ele pode
 * reprovar um campo que passou na validação do browser — e-mail já cadastrado,
 * chave Pix recusada, senha atual errada. Quando isso acontece, o erro precisa
 * aparecer **no campo certo**, não num alerta genérico no topo
 * (critério de aceite da fatia 01).
 */
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import type { ActionResult } from "@/lib/errors";

/**
 * Distribui os `fieldErrors` do servidor pelos campos do formulário e devolve o
 * que sobrou — mensagem geral, para o `FormAlert`.
 *
 * Campos que o formulário não tem (o servidor pode validar mais coisa do que a
 * tela mostra) não somem: viram parte da mensagem geral.
 */
export function applyServerErrors<TValues extends FieldValues>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  setError: UseFormSetError<TValues>,
  knownFields: readonly Path<TValues>[],
): string | null {
  const fieldErrors = result.fieldErrors;
  if (!fieldErrors) return result.error;

  const orphans: string[] = [];
  let placedAny = false;

  for (const [field, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (!message) continue;

    if ((knownFields as readonly string[]).includes(field)) {
      setError(field as Path<TValues>, { type: "server", message });
      placedAny = true;
    } else {
      orphans.push(message);
    }
  }

  if (orphans.length > 0) return orphans.join(" ");
  // Todos os erros couberam nos campos: o alerta geral seria ruído.
  return placedAny ? null : result.error;
}

/** Focar o primeiro campo com erro (docs/spec/05, item 5). */
export function focusFirstError(fieldOrder: readonly string[], errorNames: string[]): void {
  const first = fieldOrder.find((name) => errorNames.includes(name));
  if (!first) return;

  const element = document.getElementById(first);
  if (element instanceof HTMLElement) element.focus();
}
