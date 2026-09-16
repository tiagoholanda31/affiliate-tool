"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordSchema } from "@/features/affiliates/schemas";
import { resetPassword } from "@/features/auth/actions";

type ResetValues = z.input<typeof resetPasswordSchema>;

const FIELDS = ["token", "newPassword", "confirmPassword"] as const;

export function ResetPasswordForm({ token }: { token: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onBlur",
    defaultValues: { token, newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetValues) {
    setFormError(null);

    const result = await resetPassword(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, FIELDS));
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center" role="status">
        <CheckCircle2
          className="mx-auto size-10 text-[color:var(--color-success)]"
          aria-hidden="true"
        />
        <p className="text-sm text-navy-700">
          Senha alterada. Por segurança, as sessões abertas em outros aparelhos foram encerradas.
        </p>
        <Button asChild className="w-full">
          <Link href="/entrar">Entrar com a nova senha</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormAlert>{formError}</FormAlert>
      <input type="hidden" {...register("token")} />

      <Field
        name="newPassword"
        label="Nova senha"
        hint="No mínimo 10 caracteres. Evite senhas óbvias ou usadas em outros sites."
        error={errors.newPassword?.message}
        required
      >
        <Input
          {...fieldA11y("newPassword", errors.newPassword?.message, true)}
          {...register("newPassword")}
          type="password"
          autoComplete="new-password"
          autoFocus
        />
      </Field>

      <Field
        name="confirmPassword"
        label="Repita a nova senha"
        error={errors.confirmPassword?.message}
        required
      >
        <Input
          {...fieldA11y("confirmPassword", errors.confirmPassword?.message)}
          {...register("confirmPassword")}
          type="password"
          autoComplete="new-password"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Salvando…" : "Salvar nova senha"}
      </Button>
    </form>
  );
}
