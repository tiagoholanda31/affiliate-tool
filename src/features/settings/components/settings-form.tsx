"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Markdown } from "@/components/content/markdown";
import { Field, fieldA11y } from "@/components/forms/field";
import { MaskedInput } from "@/components/forms/masked-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateSettingsAction } from "@/features/settings/actions";
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from "@/features/settings/schemas";
import type { ProgramSettings } from "@/lib/settings";

export type SettingsFormProps = {
  initial: ProgramSettings;
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const [showPreview, setShowPreview] = useState(false);

  const form = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
    defaultValues: {
      holdDays: initial.holdDays,
      payoutDay: initial.payoutDay,
      attributionDays: initial.attributionDays,
      pixExpirationMinutes: initial.pixExpirationMinutes,
      downloadGrantDays: initial.downloadGrantDays,
      downloadMaxCount: initial.downloadMaxCount,
      termsVersion: initial.termsVersion,
      termsMarkdown: initial.termsMarkdown,
      adminNotifyEmail: initial.adminNotifyEmail,
      supportWhatsapp: initial.supportWhatsapp.replace(/^\+55/, ""),
    },
  });

  const termsMarkdown = form.watch("termsMarkdown");
  const termsChanged = useMemo(
    () => termsMarkdown.trim() !== initial.termsMarkdown.trim(),
    [termsMarkdown, initial.termsMarkdown],
  );

  function onSubmit(values: UpdateSettingsInput) {
    startTransition(async () => {
      const result = await updateSettingsAction(values);
      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) {
          for (const [key, messages] of Object.entries(result.fieldErrors)) {
            const message = messages[0];
            if (message) {
              form.setError(key as keyof UpdateSettingsInput, { message });
            }
          }
        }
        return;
      }
      toast.success("Configurações salvas.");
      form.reset({
        ...values,
        supportWhatsapp: values.supportWhatsapp.replace(/^\+55/, ""),
      });
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" noValidate>
      <section className="space-y-4 rounded-lg bg-white p-6 shadow-card">
        <h2 className="font-display text-xl text-navy-900">Regras do programa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            name="holdDays"
            label="Carência (dias)"
            hint="0–90. Só afeta comissões novas."
            error={form.formState.errors.holdDays?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y("holdDays", form.formState.errors.holdDays?.message, true)}
              {...form.register("holdDays", { valueAsNumber: true })}
            />
          </Field>
          <Field
            name="payoutDay"
            label="Dia de pagamento"
            hint="1–28 de cada mês."
            error={form.formState.errors.payoutDay?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y("payoutDay", form.formState.errors.payoutDay?.message, true)}
              {...form.register("payoutDay", { valueAsNumber: true })}
            />
          </Field>
          <Field
            name="attributionDays"
            label="Janela de atribuição (dias)"
            hint="1–90."
            error={form.formState.errors.attributionDays?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y(
                "attributionDays",
                form.formState.errors.attributionDays?.message,
                true,
              )}
              {...form.register("attributionDays", { valueAsNumber: true })}
            />
          </Field>
          <Field
            name="pixExpirationMinutes"
            label="Expiração do Pix (min)"
            hint="10–120."
            error={form.formState.errors.pixExpirationMinutes?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y(
                "pixExpirationMinutes",
                form.formState.errors.pixExpirationMinutes?.message,
                true,
              )}
              {...form.register("pixExpirationMinutes", { valueAsNumber: true })}
            />
          </Field>
          <Field
            name="downloadGrantDays"
            label="Validade do download (dias)"
            hint="1–30."
            error={form.formState.errors.downloadGrantDays?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y(
                "downloadGrantDays",
                form.formState.errors.downloadGrantDays?.message,
                true,
              )}
              {...form.register("downloadGrantDays", { valueAsNumber: true })}
            />
          </Field>
          <Field
            name="downloadMaxCount"
            label="Máximo de downloads"
            hint="1–20 por link."
            error={form.formState.errors.downloadMaxCount?.message}
            required
          >
            <Input
              type="number"
              {...fieldA11y(
                "downloadMaxCount",
                form.formState.errors.downloadMaxCount?.message,
                true,
              )}
              {...form.register("downloadMaxCount", { valueAsNumber: true })}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-card">
        <h2 className="font-display text-xl text-navy-900">Contato</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            name="adminNotifyEmail"
            label="E-mail de alertas do admin"
            error={form.formState.errors.adminNotifyEmail?.message}
            required
          >
            <Input
              type="email"
              {...fieldA11y(
                "adminNotifyEmail",
                form.formState.errors.adminNotifyEmail?.message,
              )}
              {...form.register("adminNotifyEmail")}
            />
          </Field>
          <Field
            name="supportWhatsapp"
            label="WhatsApp de suporte"
            hint="Com DDD."
            error={form.formState.errors.supportWhatsapp?.message}
            required
          >
            <MaskedInput
              mask="phone"
              {...fieldA11y(
                "supportWhatsapp",
                form.formState.errors.supportWhatsapp?.message,
                true,
              )}
              value={form.watch("supportWhatsapp")}
              onValueChange={({ raw }) => { form.setValue("supportWhatsapp", raw, { shouldValidate: true }); }
              }
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4 rounded-lg bg-white p-6 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-xl text-navy-900">Termos do programa</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => { setShowPreview((v) => !v); }}>
            {showPreview ? "Editar markdown" : "Pré-visualizar"}
          </Button>
        </div>
        {termsChanged ? (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-navy-800">
            Você alterou o texto. Informe uma <strong>nova versão</strong> (ex.: v
            {String(Number.parseInt(initial.termsVersion.replace(/\D/g, ""), 10) + 1 || 2)}) para
            que os afiliados vejam o banner de re-aceite.
          </p>
        ) : null}
        <Field
          name="termsVersion"
          label="Versão"
          hint="Formato v1, v2…"
          error={form.formState.errors.termsVersion?.message}
          required
        >
          <Input
            {...fieldA11y("termsVersion", form.formState.errors.termsVersion?.message, true)}
            {...form.register("termsVersion")}
            className="max-w-xs"
          />
        </Field>
        <Field
          name="termsMarkdown"
          label="Texto (markdown)"
          error={form.formState.errors.termsMarkdown?.message}
          required
        >
          {showPreview ? (
            <div className="rounded-md border border-mist-300 p-4">
              <Markdown>{termsMarkdown || "_Sem conteúdo_"}</Markdown>
            </div>
          ) : (
            <Textarea
              rows={16}
              {...fieldA11y("termsMarkdown", form.formState.errors.termsMarkdown?.message)}
              {...form.register("termsMarkdown")}
            />
          )}
        </Field>
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
