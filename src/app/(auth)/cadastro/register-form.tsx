"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, FormErrorSummary, fieldA11y } from "@/components/forms/field";
import { MaskedInput } from "@/components/forms/masked-input";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerAffiliate } from "@/features/affiliates/actions";
import {
  PIX_KEY_TYPES,
  SOCIAL_NETWORKS,
  registerAffiliateSchema,
} from "@/features/affiliates/schemas";
import { LABELS } from "@/lib/i18n/pt-BR";

type RegisterValues = z.input<typeof registerAffiliateSchema>;

/** Ordem visual dos campos — usada para focar o primeiro erro e no resumo. */
const STEP_ONE_FIELDS = ["name", "email", "password", "phone", "socialNetwork", "socialHandle"] as const;
const STEP_TWO_FIELDS = ["pixKeyType", "pixKey", "termsAccepted"] as const;
const ALL_FIELDS = [...STEP_ONE_FIELDS, ...STEP_TWO_FIELDS] as const;

const LABEL_BY_FIELD: Record<string, string> = {
  name: "Nome completo",
  email: "E-mail",
  password: "Senha",
  phone: "Celular",
  socialNetwork: "Rede social",
  socialHandle: "Seu @",
  pixKeyType: "Tipo da chave Pix",
  pixKey: "Chave Pix",
  termsAccepted: "Termos do programa",
};

/**
 * Como cada tipo de chave Pix se comporta no campo.
 * Indexado por `string` porque é isso que o `<select>` entrega — inclusive `""`
 * antes de a pessoa escolher.
 */
const PIX_INPUT: Record<
  string,
  { mask?: "cpf" | "cnpj" | "phone"; type?: string; placeholder: string; hint: string }
> = {
  CPF: { mask: "cpf", placeholder: "000.000.000-00", hint: "Somente o CPF do titular da conta." },
  CNPJ: {
    mask: "cnpj",
    placeholder: "00.000.000/0000-00",
    hint: "Use o CNPJ se receber como pessoa jurídica.",
  },
  EMAIL: {
    type: "email",
    placeholder: "voce@exemplo.com",
    hint: "O e-mail precisa estar cadastrado como chave Pix no seu banco.",
  },
  PHONE: { mask: "phone", placeholder: "(11) 98765-4321", hint: "Celular cadastrado como chave Pix." },
  RANDOM: {
    placeholder: "00000000-0000-0000-0000-000000000000",
    hint: "A chave aleatória (EVP) que o app do seu banco gera.",
  },
};

export function RegisterForm({ termsVersion }: { termsVersion: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  // Instante em que o formulário foi montado: o servidor recusa envios rápidos
  // demais para serem humanos (docs/spec/04, Anti-bot).
  const [startedAt] = useState(() => Date.now());

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerAffiliateSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      phone: "",
      socialNetwork: "",
      socialHandle: "",
      pixKeyType: "",
      pixKey: "",
      termsAccepted: false,
      website: "",
      startedAt,
    },
  });

  // `useWatch` no lugar de `watch()`: é um hook de verdade, então o React
  // Compiler consegue memoizar o componente (com `watch` ele pula a compilação).
  const phone = useWatch({ control, name: "phone" });
  const socialNetwork = useWatch({ control, name: "socialNetwork" });
  const pixKeyType = useWatch({ control, name: "pixKeyType" });
  const pixKey = useWatch({ control, name: "pixKey" });
  const termsAccepted = useWatch({ control, name: "termsAccepted" });
  const pixConfig = PIX_INPUT[pixKeyType];

  if (submittedEmail) return <CheckYourEmail email={submittedEmail} />;

  async function goToStepTwo() {
    setFormError(null);
    const valid = await trigger([...STEP_ONE_FIELDS]);
    if (valid) {
      setStep(2);
      return;
    }
    focusFirst(STEP_ONE_FIELDS);
  }

  async function onSubmit(values: RegisterValues) {
    setFormError(null);
    const result = await registerAffiliate(values);

    if (!result.ok) {
      const general = applyServerErrors(result, setError, ALL_FIELDS);
      setFormError(general);
      // Um erro de servidor pode ser de um campo do passo 1 — voltar para lá,
      // senão a pessoa vê "confira os campos" sem campo nenhum destacado.
      const failed = Object.keys(result.fieldErrors ?? {});
      if (failed.some((field) => (STEP_ONE_FIELDS as readonly string[]).includes(field))) {
        setStep(1);
      }
      return;
    }

    setSubmittedEmail(result.data.email);
  }

  const visibleFields = step === 1 ? STEP_ONE_FIELDS : STEP_TWO_FIELDS;
  const summary = visibleFields
    .filter((name) => errors[name])
    .map((name) => ({
      name,
      label: LABEL_BY_FIELD[name] ?? name,
      message: errors[name]?.message ?? "",
    }));

  return (
    <div className="space-y-6">
      <StepProgress step={step} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormErrorSummary errors={summary} />
        <FormAlert>{formError}</FormAlert>

        {/* Honeypot: fora da tela e fora da ordem de tabulação. Só robô preenche. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
          <label htmlFor="website">Não preencha este campo</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...register("website")} />
        </div>
        <input type="hidden" {...register("startedAt", { valueAsNumber: true })} />

        {step === 1 ? (
          <>
            <Field name="name" label="Nome completo" error={errors.name?.message} required>
              <Input
                {...fieldA11y("name", errors.name?.message)}
                {...register("name")}
                autoComplete="name"
                autoFocus
                placeholder="Maria Souza"
              />
            </Field>

            <Field
              name="email"
              label="E-mail"
              hint="É para onde enviamos a confirmação e os avisos de comissão."
              error={errors.email?.message}
              required
            >
              <Input
                {...fieldA11y("email", errors.email?.message, true)}
                {...register("email")}
                type="email"
                autoComplete="email"
                placeholder="voce@exemplo.com"
              />
            </Field>

            <Field
              name="password"
              label="Senha"
              hint="No mínimo 10 caracteres. Evite senhas óbvias ou repetidas de outros sites."
              error={errors.password?.message}
              required
            >
              <div className="relative">
                <Input
                  {...fieldA11y("password", errors.password?.message, true)}
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
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

            <Field name="phone" label="Celular" error={errors.phone?.message} required>
              <MaskedInput
                {...fieldA11y("phone", errors.phone?.message)}
                mask="phone"
                value={phone}
                onValueChange={({ raw }) => {
                  setValue("phone", raw, { shouldDirty: true });
                }}
                onBlur={() => void trigger("phone")}
                name="phone"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="socialNetwork"
                label="Rede social"
                error={errors.socialNetwork?.message}
                required
              >
                <Select
                  value={socialNetwork}
                  onValueChange={(value) => {
                    setValue("socialNetwork", value, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger {...fieldA11y("socialNetwork", errors.socialNetwork?.message)}>
                    <SelectValue placeholder="Escolha" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOCIAL_NETWORKS.map((network) => (
                      <SelectItem key={network} value={network}>
                        {LABELS.socialNetwork[network] ?? network}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                name="socialHandle"
                label="Seu @"
                hint="Sem o @ — pode colar o link do perfil."
                error={errors.socialHandle?.message}
                required
              >
                <Input
                  {...fieldA11y("socialHandle", errors.socialHandle?.message, true)}
                  {...register("socialHandle")}
                  placeholder="maria.afiliada"
                  autoComplete="off"
                />
              </Field>
            </div>

            <Button type="button" className="w-full" onClick={() => void goToStepTwo()}>
              Continuar
            </Button>
          </>
        ) : (
          <>
            <Field
              name="pixKeyType"
              label="Tipo da chave Pix"
              hint="É a chave que vamos usar para pagar suas comissões."
              error={errors.pixKeyType?.message}
              required
            >
              <Select
                value={pixKeyType}
                onValueChange={(value) => {
                  setValue("pixKeyType", value, { shouldValidate: true });
                  // A chave anterior não serve para o novo tipo.
                  setValue("pixKey", "");
                }}
              >
                <SelectTrigger {...fieldA11y("pixKeyType", errors.pixKeyType?.message, true)}>
                  <SelectValue placeholder="Escolha o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {PIX_KEY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {LABELS.pixKeyType[type] ?? type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {pixConfig ? (
              <Field
                name="pixKey"
                label="Chave Pix"
                hint={pixConfig.hint}
                error={errors.pixKey?.message}
                required
              >
                {pixConfig.mask ? (
                  <MaskedInput
                    {...fieldA11y("pixKey", errors.pixKey?.message, true)}
                    mask={pixConfig.mask}
                    value={pixKey}
                    onValueChange={({ raw }) => {
                      setValue("pixKey", raw, { shouldDirty: true });
                    }}
                    onBlur={() => void trigger("pixKey")}
                    name="pixKey"
                    placeholder={pixConfig.placeholder}
                  />
                ) : (
                  <Input
                    {...fieldA11y("pixKey", errors.pixKey?.message, true)}
                    {...register("pixKey")}
                    type={pixConfig.type ?? "text"}
                    placeholder={pixConfig.placeholder}
                    autoComplete="off"
                  />
                )}
              </Field>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-start gap-3 rounded-md border border-mist-300 bg-mist-100 p-3">
                <Checkbox
                  id="termsAccepted"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => {
                    setValue("termsAccepted", checked === true, { shouldValidate: true });
                  }}
                  aria-invalid={errors.termsAccepted ? true : undefined}
                  aria-describedby={errors.termsAccepted ? "termsAccepted-error" : undefined}
                />
                <Label htmlFor="termsAccepted" className="text-sm leading-6 font-normal">
                  Li e aceito os{" "}
                  <Link
                    href="/termos"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 underline underline-offset-2"
                  >
                    Termos do Programa de Afiliados
                  </Link>{" "}
                  ({termsVersion}) e a{" "}
                  <Link
                    href="/privacidade"
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 underline underline-offset-2"
                  >
                    Política de Privacidade
                  </Link>
                  .
                </Label>
              </div>
              {errors.termsAccepted ? (
                <p id="termsAccepted-error" className="text-sm text-[color:var(--color-danger)]">
                  {errors.termsAccepted.message}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Enviando…" : "Criar minha conta"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto"
                onClick={() => {
                  setStep(1);
                }}
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Voltar
              </Button>
            </div>
          </>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Já tem conta?{" "}
        <Link href="/entrar" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
          Entrar
        </Link>
      </p>
    </div>
  );
}

function focusFirst(order: readonly string[]): void {
  for (const name of order) {
    const element = document.getElementById(name);
    if (element instanceof HTMLElement && element.getAttribute("aria-invalid") === "true") {
      element.focus();
      return;
    }
  }
}

function StepProgress({ step }: { step: 1 | 2 }) {
  const labels = ["Seus dados", "Pix e termos"];

  return (
    <div aria-label={`Passo ${String(step)} de 2`}>
      <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
        {labels.map((label, index) => (
          <span key={label} className={index + 1 === step ? "text-navy-900" : undefined}>
            {index + 1}. {label}
          </span>
        ))}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist-300">
        <div
          className="h-full rounded-full bg-teal-700 transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: step === 1 ? "50%" : "100%" }}
        />
      </div>
    </div>
  );
}

function CheckYourEmail({ email }: { email: string }) {
  return (
    <div className="space-y-4 text-center" role="status">
      <h1 className="font-display text-2xl text-navy-900">Confira seu e-mail</h1>
      <p className="text-sm text-navy-700">
        Enviamos um link de confirmação para <strong className="break-all">{email}</strong>. Ele vale
        por 24 horas.
      </p>
      <p className="text-sm text-muted-foreground">
        Depois de confirmar, seu cadastro entra na fila de análise — normalmente respondemos em até 2
        dias úteis.
      </p>
      <p className="text-sm text-muted-foreground">
        Não chegou? Verifique o spam ou{" "}
        <Link href="/verificar-email?reenviar=1" className="text-teal-700 underline underline-offset-2 hover:text-teal-600">
          peça um novo link
        </Link>
        .
      </p>
    </div>
  );
}
