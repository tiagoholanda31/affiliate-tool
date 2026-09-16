"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestPasswordResetSchema } from "@/features/affiliates/schemas";
import { requestPasswordReset } from "@/features/auth/actions";

type ForgotValues = z.input<typeof requestPasswordResetSchema>;

export function ForgotPasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ message: string; expiresInMinutes: number } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ForgotValues>({
    resolver: zodResolver(requestPasswordResetSchema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotValues) {
    setFormError(null);

    const result = await requestPasswordReset(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, ["email"]));
      return;
    }
    setSent(result.data);
  }

  if (sent) {
    return (
      <div className="space-y-3" role="status">
        <p className="rounded-md border border-[color:var(--color-info)]/25 bg-[color:var(--color-info-bg)] p-3 text-sm text-[color:var(--color-info)]">
          {sent.message}
        </p>
        <p className="text-sm text-muted-foreground">
          O link vale por {sent.expiresInMinutes} minutos e só pode ser usado uma vez. Se não chegar
          em alguns minutos, verifique a caixa de spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormAlert>{formError}</FormAlert>

      <Field name="email" label="E-mail do cadastro" error={errors.email?.message} required>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          {...register("email")}
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="voce@exemplo.com"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar link de redefinição"}
      </Button>
    </form>
  );
}
