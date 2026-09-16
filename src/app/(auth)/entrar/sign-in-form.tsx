"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn } from "@/features/auth/actions";
import { signInSchema } from "@/features/affiliates/schemas";

type SignInValues = z.input<typeof signInSchema>;

const FIELDS = ["email", "password"] as const;

export function SignInForm({ next }: { next?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    // Validação no blur, como manda a spec 05 (item 5) — não a cada tecla.
    mode: "onBlur",
    defaultValues: { email: "", password: "", next },
  });

  async function onSubmit(values: SignInValues) {
    setFormError(null);
    const result = await signIn(values);

    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, FIELDS));
      return;
    }

    // Navegação completa: após a autenticação o cookie de sessão mudou e o
    // destino costuma ser outro grupo de rotas (/painel/* ou /admin). Um push
    // SPA trocava de URL mas deixava a página em branco no teste e2e; o reload
    // faz o servidor renderizar a rota nova com a sessão já no request.
    window.location.assign(result.data.redirectTo);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormAlert>{formError}</FormAlert>

      <Field name="email" label="E-mail" error={errors.email?.message} required>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          {...register("email")}
          type="email"
          autoComplete="email"
          autoFocus
          placeholder="voce@exemplo.com"
        />
      </Field>

      <Field name="password" label="Senha" error={errors.password?.message} required>
        <div className="relative">
          <Input
            {...fieldA11y("password", errors.password?.message)}
            {...register("password")}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => {
              setShowPassword((visible) => !visible);
            }}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-navy-900 focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:outline-none"
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
          >
            {showPassword ? (
              <EyeOff className="size-4" aria-hidden="true" />
            ) : (
              <Eye className="size-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </Field>

      <input type="hidden" {...register("next")} />

      {/* Desabilitado só enquanto envia, nunca por invalidez (spec 05, item 5). */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Entrando…" : "Entrar"}
      </Button>

      <div className="flex flex-col gap-2 text-center text-sm">
        <Link href="/recuperar-senha" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
          Esqueci minha senha
        </Link>
        <p className="text-muted-foreground">
          Ainda não é afiliado?{" "}
          <Link href="/cadastro" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
            Criar conta
          </Link>
        </p>
      </div>
    </form>
  );
}
