"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Field, FormAlert, FormErrorSummary, fieldA11y } from "@/components/forms/field";
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
import { resubmitAffiliate } from "@/features/affiliates/actions";
import {
  PIX_KEY_TYPES,
  SOCIAL_NETWORKS,
  resubmitAffiliateSchema,
} from "@/features/affiliates/schemas";
import { LABELS } from "@/lib/i18n/pt-BR";

type ResubmitValues = z.input<typeof resubmitAffiliateSchema>;

const FIELDS = ["name", "phone", "socialNetwork", "socialHandle", "pixKeyType", "pixKey"] as const;

const LABEL_BY_FIELD: Record<string, string> = {
  name: "Nome completo",
  phone: "Celular",
  socialNetwork: "Rede social",
  socialHandle: "Seu @",
  pixKeyType: "Tipo da chave Pix",
  pixKey: "Chave Pix",
};

/** Indexado por `string`: é o que o `<select>` entrega, inclusive `""`. */
const PIX_MASK: Record<string, "cpf" | "cnpj" | "phone"> = {
  CPF: "cpf",
  CNPJ: "cnpj",
  PHONE: "phone",
};

export type ResubmitFormProps = {
  defaults: {
    name: string;
    /** Só dígitos: o E.164 do banco chega já sem o `+55`. */
    phone: string;
    socialNetwork: ResubmitValues["socialNetwork"];
    socialHandle: string;
  };
};

/**
 * Reenvio do cadastro corrigido (docs/spec/01, seção 1).
 *
 * A chave Pix não vem preenchida de propósito: o valor guardado está
 * criptografado e só existe mascarado para exibição — não dá para devolver ao
 * campo, e não deveria mesmo. Reenviar o cadastro é reconfirmar para onde o
 * dinheiro vai.
 */
export function ResubmitForm({ defaults }: ResubmitFormProps) {
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
  } = useForm<ResubmitValues>({
    resolver: zodResolver(resubmitAffiliateSchema),
    mode: "onBlur",
    defaultValues: { ...defaults, pixKeyType: "", pixKey: "" },
  });

  const phone = useWatch({ control, name: "phone" });
  const socialNetwork = useWatch({ control, name: "socialNetwork" });
  const pixKeyType = useWatch({ control, name: "pixKeyType" });
  const pixKey = useWatch({ control, name: "pixKey" });
  const pixMask = PIX_MASK[pixKeyType];

  async function onSubmit(values: ResubmitValues) {
    setFormError(null);

    const result = await resubmitAffiliate(values);
    if (!result.ok) {
      setFormError(applyServerErrors(result, setError, FIELDS));
      return;
    }

    router.refresh();
  }

  const summary = FIELDS.filter((name) => errors[name]).map((name) => ({
    name,
    label: LABEL_BY_FIELD[name] ?? name,
    message: errors[name]?.message ?? "",
  }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormErrorSummary errors={summary} />
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
          hint="Sem o @ — pode colar o link do perfil."
          error={errors.socialHandle?.message}
          required
        >
          <Input
            {...fieldA11y("socialHandle", errors.socialHandle?.message, true)}
            {...register("socialHandle")}
            autoComplete="off"
          />
        </Field>
      </div>

      <Field
        name="pixKeyType"
        label="Tipo da chave Pix"
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

      {pixKeyType ? (
        <Field
          name="pixKey"
          label="Chave Pix"
          hint="Confirme a chave, mesmo que ela não tenha mudado."
          error={errors.pixKey?.message}
          required
        >
          {pixMask ? (
            <MaskedInput
              {...fieldA11y("pixKey", errors.pixKey?.message, true)}
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
              {...fieldA11y("pixKey", errors.pixKey?.message, true)}
              {...register("pixKey")}
              type={pixKeyType === "EMAIL" ? "email" : "text"}
              autoComplete="off"
            />
          )}
        </Field>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar cadastro para nova análise"}
      </Button>
    </form>
  );
}
