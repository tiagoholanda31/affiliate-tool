"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Lock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { MaskedInput } from "@/components/forms/masked-input";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changePassword, changePixKey, updateProfile } from "@/features/affiliates/actions";
import {
  PIX_KEY_TYPES,
  SOCIAL_NETWORKS,
  changePasswordSchema,
  changePixKeySchema,
  updateProfileSchema,
  type PixKeyTypeValue,
} from "@/features/affiliates/schemas";
import { LABELS, MESSAGES } from "@/lib/i18n/pt-BR";

type ProfileValues = z.input<typeof updateProfileSchema>;
type PixValues = z.input<typeof changePixKeySchema>;
type PasswordValues = z.input<typeof changePasswordSchema>;

/** Indexado por `string`: é o que o `<select>` entrega, inclusive `""`. */
const PIX_MASK: Record<string, "cpf" | "cnpj" | "phone"> = {
  CPF: "cpf",
  CNPJ: "cnpj",
  PHONE: "phone",
};

/** Cartão que agrupa cada bloco do perfil. */
function Card({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof KeyRound;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-card">
      <div className="mb-4 flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-teal-700" aria-hidden="true" />
        <div className="space-y-0.5">
          <h2 className="font-display text-lg text-navy-900">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ─── Dados pessoais ──────────────────────────────────────────────────────────

const PROFILE_FIELDS = ["name", "phone", "socialNetwork", "socialHandle"] as const;

export function ProfileDataForm({ defaults }: { defaults: ProfileValues }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<ProfileValues>({
    resolver: zodResolver(updateProfileSchema),
    mode: "onBlur",
    defaultValues: defaults,
  });

  // `useWatch` no lugar de `watch()`: é um hook de verdade, então o React
  // Compiler consegue memoizar o componente (com `watch` ele pula a compilação).
  const phone = useWatch({ control, name: "phone" });
  const socialNetwork = useWatch({ control, name: "socialNetwork" });

  async function onSubmit(values: ProfileValues) {
    setFormError(null);

    const result = await updateProfile(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, PROFILE_FIELDS));
      return;
    }

    toast.success(MESSAGES.saved);
    router.refresh();
  }

  return (
    <Card
      title="Seus dados"
      description="Como o suporte entra em contato com você."
      icon={ShieldCheck}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>{formError}</FormAlert>

        <Field name="name" label="Nome completo" error={errors.name?.message} required>
          <Input
            {...fieldA11y("name", errors.name?.message)}
            {...register("name")}
            autoComplete="name"
          />
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
            error={errors.socialHandle?.message}
            required
          >
            <Input
              {...fieldA11y("socialHandle", errors.socialHandle?.message)}
              {...register("socialHandle")}
              autoComplete="off"
            />
          </Field>
        </div>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Salvar dados"}
        </Button>
      </form>
    </Card>
  );
}

// ─── Chave Pix ───────────────────────────────────────────────────────────────

const PIX_FIELDS = ["pixKeyType", "pixKey", "currentPassword"] as const;

export function PixKeyForm({
  currentType,
  currentMasked,
}: {
  currentType: PixKeyTypeValue;
  currentMasked: string;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    reset,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<PixValues>({
    resolver: zodResolver(changePixKeySchema),
    mode: "onBlur",
    defaultValues: { pixKeyType: currentType, pixKey: "", currentPassword: "" },
  });

  const pixKeyType = useWatch({ control, name: "pixKeyType" });
  const pixKey = useWatch({ control, name: "pixKey" });
  const pixMask = PIX_MASK[pixKeyType];

  async function onSubmit(values: PixValues) {
    setFormError(null);

    const result = await changePixKey(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, PIX_FIELDS));
      return;
    }

    toast.success("Chave Pix atualizada. Enviamos um aviso para o seu e-mail.");
    reset({ pixKeyType: values.pixKeyType, pixKey: "", currentPassword: "" });
    router.refresh();
  }

  return (
    <Card
      title="Chave Pix"
      description="É para esta chave que suas comissões são pagas."
      icon={KeyRound}
    >
      <p className="mb-4 rounded-md border border-mist-300 bg-mist-100 px-3 py-2 text-sm text-navy-900">
        <span className="text-muted-foreground">Chave atual: </span>
        {LABELS.pixKeyType[currentType] ?? currentType} · {currentMasked}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>{formError}</FormAlert>

        <Field
          name="pixKeyType"
          label="Tipo da nova chave"
          error={errors.pixKeyType?.message}
          required
        >
          <Select
            value={pixKeyType}
            onValueChange={(value) => {
              setValue("pixKeyType", value, { shouldValidate: true });
              setValue("pixKey", "");
            }}
          >
            <SelectTrigger {...fieldA11y("pixKeyType", errors.pixKeyType?.message)}>
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

        <Field name="pixKey" label="Nova chave Pix" error={errors.pixKey?.message} required>
          {pixMask ? (
            <MaskedInput
              {...fieldA11y("pixKey", errors.pixKey?.message)}
              mask={pixMask}
              value={pixKey}
              onValueChange={({ raw }) => {
                setValue("pixKey", raw, { shouldDirty: true });
              }}
              onBlur={() => void trigger("pixKey")}
              name="pixKey"
            />
          ) : (
            <Input
              {...fieldA11y("pixKey", errors.pixKey?.message)}
              {...register("pixKey")}
              type={pixKeyType === "EMAIL" ? "email" : "text"}
              autoComplete="off"
            />
          )}
        </Field>

        <Field
          name="currentPassword"
          label="Sua senha atual"
          hint="Pedimos a senha porque esta chave decide para onde o dinheiro vai."
          error={errors.currentPassword?.message}
          required
        >
          <Input
            {...fieldA11y("currentPassword", errors.currentPassword?.message, true)}
            {...register("currentPassword")}
            type="password"
            autoComplete="current-password"
          />
        </Field>

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Trocar chave Pix"}
        </Button>
      </form>
    </Card>
  );
}

// ─── Senha ───────────────────────────────────────────────────────────────────

const PASSWORD_FIELDS = ["currentPassword", "newPassword", "confirmPassword"] as const;

export function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    mode: "onBlur",
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function onSubmit(values: PasswordValues) {
    setFormError(null);

    const result = await changePassword(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, PASSWORD_FIELDS));
      return;
    }

    toast.success(result.data.message);
    reset();
  }

  return (
    <Card
      title="Senha"
      description="Trocar a senha encerra as sessões abertas em outros aparelhos."
      icon={Lock}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormAlert>{formError}</FormAlert>

        <Field
          name="currentPassword"
          label="Senha atual"
          error={errors.currentPassword?.message}
          required
        >
          <Input
            {...fieldA11y("currentPassword", errors.currentPassword?.message)}
            {...register("currentPassword")}
            type="password"
            autoComplete="current-password"
          />
        </Field>

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

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Salvando…" : "Trocar senha"}
        </Button>
      </form>
    </Card>
  );
}
