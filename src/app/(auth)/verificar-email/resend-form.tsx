"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resendVerificationSchema } from "@/features/affiliates/schemas";
import { resendVerification } from "@/features/auth/actions";

type ResendValues = z.input<typeof resendVerificationSchema>;

/**
 * Pedir um novo link de confirmação.
 *
 * A mensagem de sucesso é a mesma exista ou não a conta, e apareça ou não o
 * e-mail já verificado (docs/spec/04, Enumeração de e-mail).
 */
export function ResendVerificationForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResendValues>({
    resolver: zodResolver(resendVerificationSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ResendValues) {
    setFormError(null);
    setMessage(null);

    const result = await resendVerification(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, ["email"]));
      return;
    }
    setMessage(result.data.message);
  }

  if (message) {
    return (
      <p
        role="status"
        className="rounded-md border border-[color:var(--color-info)]/25 bg-[color:var(--color-info-bg)] p-3 text-sm text-[color:var(--color-info)]"
      >
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormAlert>{formError}</FormAlert>

      <Field name="email" label="Seu e-mail" error={errors.email?.message} required>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          {...register("email")}
          type="email"
          autoComplete="email"
          placeholder="voce@exemplo.com"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar novo link"}
      </Button>
    </form>
  );
}
