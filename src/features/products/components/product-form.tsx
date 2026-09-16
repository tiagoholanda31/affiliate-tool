"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Field, FormAlert, FormErrorSummary, fieldA11y } from "@/components/forms/field";
import { FileDropzone } from "@/components/forms/file-dropzone";
import { MaskedInput } from "@/components/forms/masked-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProduct, updateProduct } from "@/features/products/actions";
import type { ProductDetail } from "@/features/products/queries";
import {
  productFormSchema,
  suggestSlug,
  type ProductFormInput,
} from "@/features/products/schemas";
import { formatCommissionPreview, formatPercent, bpFromPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

type ProductFormProps = {
  mode: "create" | "edit";
  initial?: ProductDetail;
};

function toFormValues(initial?: ProductDetail): ProductFormInput {
  if (!initial) {
    return {
      name: "",
      slug: "",
      type: "SERVICE",
      status: "DRAFT",
      shortDescription: "",
      description: "",
      priceCents: 10000,
      compareAtPriceCents: null,
      commissionType: "PERCENT",
      commissionValue: 1500,
      coverImagePath: null,
      allowPix: true,
      allowCard: true,
      maxInstallments: 3,
      deliveryNote: "",
      sortOrder: 0,
      digitalFile: null,
      confirmSlugChange: false,
    };
  }

  return {
    name: initial.name,
    slug: initial.slug,
    type: initial.type,
    status: initial.status,
    shortDescription: initial.shortDescription,
    description: initial.description,
    priceCents: initial.priceCents,
    compareAtPriceCents: initial.compareAtPriceCents,
    commissionType: initial.commissionType,
    commissionValue: initial.commissionValue,
    coverImagePath: initial.coverImagePath,
    allowPix: initial.allowPix,
    allowCard: initial.allowCard,
    maxInstallments: initial.maxInstallments,
    deliveryNote: initial.deliveryNote ?? "",
    sortOrder: initial.sortOrder,
    digitalFile: initial.digitalFile
      ? {
          path: initial.digitalFile.path,
          originalName: initial.digitalFile.originalName,
          mimeType: initial.digitalFile.mimeType as "application/pdf" | "application/epub+zip",
          sizeBytes: initial.digitalFile.sizeBytes,
          sha256: initial.digitalFile.sha256,
        }
      : null,
    confirmSlugChange: false,
  };
}

export function ProductForm({ mode, initial }: ProductFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [slugConfirmOpen, setSlugConfirmOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  const form = useForm<ProductFormInput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: toFormValues(initial),
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = form;

  const watched = useWatch({ control });
  const type = watched.type ?? "SERVICE";
  const commissionType = watched.commissionType ?? "PERCENT";
  const priceCents = watched.priceCents ?? 0;
  const commissionValue = watched.commissionValue ?? 0;
  const allowCard = Boolean(watched.allowCard);

  const commissionPreview = useMemo(() => {
    try {
      return formatCommissionPreview({
        type: commissionType,
        value: commissionValue,
        priceCents,
      });
    } catch {
      return null;
    }
  }, [commissionType, commissionValue, priceCents]);

  const fieldErrors = Object.entries(errors).flatMap(([name, err]) => {
    if (!err.message) return [];
    return [{ name, label: FIELD_LABELS[name] ?? name, message: err.message }];
  });

  useEffect(() => {
    if (slugTouched) return;
    const name = watched.name ?? "";
    if (name.trim().length >= 3) {
      setValue("slug", suggestSlug(name), { shouldValidate: false });
    }
  }, [watched.name, slugTouched, setValue]);

  function submit(values: ProductFormInput, confirmedSlug = false) {
    setServerError(null);

    if (
      mode === "edit" &&
      initial?.status === "ACTIVE" &&
      values.slug !== initial.slug &&
      !confirmedSlug
    ) {
      setSlugConfirmOpen(true);
      return;
    }

    startTransition(async () => {
      const payload = {
        ...values,
        compareAtPriceCents: values.compareAtPriceCents ?? null,
        deliveryNote: values.deliveryNote ?? null,
        coverImagePath: values.coverImagePath ?? null,
        digitalFile: values.type === "DIGITAL" ? values.digitalFile : null,
        confirmSlugChange: confirmedSlug,
      };

      const result =
        mode === "create"
          ? await createProduct(payload)
          : initial
            ? await updateProduct({ ...payload, id: initial.id })
            : { ok: false as const, error: "Produto não encontrado." };

      if (!result.ok) {
        setServerError(result.error);
        if ("fieldErrors" in result && result.fieldErrors) {
          for (const [name, messages] of Object.entries(result.fieldErrors)) {
            form.setError(name as keyof ProductFormInput, { message: messages[0] });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Produto criado." : "Produto atualizado.");
      router.push(`/admin/produtos/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <>
      <form
        className="space-y-8"
        onSubmit={handleSubmit((values) => { submit(values); })}
        noValidate
      >
        <FormAlert>{serverError}</FormAlert>
        <FormErrorSummary errors={fieldErrors} />

        <section className="space-y-4">
          <h2 className="font-display text-lg text-navy-900">Básico</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="name" label="Nome" required error={errors.name?.message}>
              <Input {...register("name")} {...fieldA11y("name", errors.name?.message)} />
            </Field>
            <Field
              name="slug"
              label="Slug"
              required
              hint="Usado na URL pública /p/seu-slug"
              error={errors.slug?.message}
            >
              <Input
                {...register("slug")}
                {...fieldA11y("slug", errors.slug?.message, true)}
                onChange={(event) => {
                  setSlugTouched(true);
                  setValue("slug", event.target.value, { shouldValidate: true });
                }}
              />
            </Field>
            <Field name="type" label="Tipo" required error={errors.type?.message}>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mode === "edit"}
                  >
                    <SelectTrigger {...fieldA11y("type", errors.type?.message)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SERVICE">Serviço</SelectItem>
                      <SelectItem value="DIGITAL">Livro digital</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field name="status" label="Status" required error={errors.status?.message}>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldA11y("status", errors.status?.message)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DRAFT">Rascunho</SelectItem>
                      <SelectItem value="ACTIVE">Publicado</SelectItem>
                      <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              name="shortDescription"
              label="Descrição curta"
              required
              className="md:col-span-2"
              error={errors.shortDescription?.message}
            >
              <Textarea
                rows={2}
                {...register("shortDescription")}
                {...fieldA11y("shortDescription", errors.shortDescription?.message)}
              />
            </Field>
            <Field
              name="description"
              label="Descrição (markdown)"
              required
              className="md:col-span-2"
              error={errors.description?.message}
            >
              <Textarea
                rows={8}
                {...register("description")}
                {...fieldA11y("description", errors.description?.message)}
              />
            </Field>
            <Field name="sortOrder" label="Ordem na vitrine" error={errors.sortOrder?.message}>
              <Input
                type="number"
                min={0}
                {...register("sortOrder", { valueAsNumber: true })}
                {...fieldA11y("sortOrder", errors.sortOrder?.message)}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-navy-900">Preço e comissão</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="priceCents" label="Preço" required error={errors.priceCents?.message}>
              <Controller
                control={control}
                name="priceCents"
                render={({ field }) => (
                  <MaskedInput
                    mask="money"
                    value={String(field.value)}
                    onValueChange={({ raw }) => { field.onChange(Number(raw === "" ? 0 : raw)); }}
                    {...fieldA11y("priceCents", errors.priceCents?.message)}
                  />
                )}
              />
            </Field>
            <Field
              name="compareAtPriceCents"
              label="Preço “de” (opcional)"
              error={errors.compareAtPriceCents?.message}
            >
              <Controller
                control={control}
                name="compareAtPriceCents"
                render={({ field }) => (
                  <MaskedInput
                    mask="money"
                    value={field.value ? String(field.value) : ""}
                    onValueChange={({ raw }) => { field.onChange(raw ? Number(raw) : null); }}
                    {...fieldA11y("compareAtPriceCents", errors.compareAtPriceCents?.message)}
                  />
                )}
              />
            </Field>
            <Field
              name="commissionType"
              label="Tipo de comissão"
              required
              error={errors.commissionType?.message}
            >
              <Controller
                control={control}
                name="commissionType"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...fieldA11y("commissionType", errors.commissionType?.message)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERCENT">Percentual</SelectItem>
                      <SelectItem value="FIXED">Valor fixo</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              name="commissionValue"
              label={commissionType === "PERCENT" ? "Comissão (%)" : "Comissão (R$)"}
              required
              error={errors.commissionValue?.message}
            >
              {commissionType === "PERCENT" ? (
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  defaultValue={commissionValue / 100}
                  onBlur={(event) => {
                    const percent = Number(event.target.value.replace(",", "."));
                    setValue("commissionValue", Number.isFinite(percent) ? bpFromPercent(percent) : 0, {
                      shouldValidate: true,
                    });
                  }}
                  {...fieldA11y("commissionValue", errors.commissionValue?.message)}
                />
              ) : (
                <Controller
                  control={control}
                  name="commissionValue"
                  render={({ field }) => (
                    <MaskedInput
                      mask="money"
                      value={String(field.value)}
                      onValueChange={({ raw }) => { field.onChange(Number(raw === "" ? 0 : raw)); }}
                      {...fieldA11y("commissionValue", errors.commissionValue?.message)}
                    />
                  )}
                />
              )}
            </Field>
          </div>
          {commissionPreview ? (
            <p className="rounded-md bg-mist-100 px-3 py-2 text-sm text-navy-800" aria-live="polite">
              Preview: {commissionPreview}
              {commissionType === "PERCENT" ? (
                <span className="ml-2 text-muted-foreground">({formatPercent(commissionValue)})</span>
              ) : null}
            </p>
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-navy-900">Pagamento</h2>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="allowPix"
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={(v) => { field.onChange(v === true); }} />
                )}
              />
              Aceitar Pix
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Controller
                control={control}
                name="allowCard"
                render={({ field }) => (
                  <Checkbox checked={field.value} onCheckedChange={(v) => { field.onChange(v === true); }} />
                )}
              />
              Aceitar cartão
            </label>
          </div>
          {errors.allowPix?.message ? (
            <p className="text-sm text-[color:var(--color-danger)]">{errors.allowPix.message}</p>
          ) : null}
          <Field
            name="maxInstallments"
            label="Máximo de parcelas"
            hint="MVP: sempre sem juros até este limite."
            error={errors.maxInstallments?.message}
          >
            <Input
              type="number"
              min={1}
              max={12}
              disabled={!allowCard}
              {...register("maxInstallments", { valueAsNumber: true })}
              {...fieldA11y("maxInstallments", errors.maxInstallments?.message, true)}
            />
          </Field>
        </section>

        <section className="space-y-4">
          <h2 className="font-display text-lg text-navy-900">Arquivo / entrega</h2>
          <Field name="coverImagePath" label="Capa (4:3)" error={errors.coverImagePath?.message}>
            <Controller
              control={control}
              name="coverImagePath"
              render={({ field }) => (
                <FileDropzone
                  kind="cover"
                  accept="image/jpeg,image/png,image/webp"
                  label="Arraste a capa ou clique para enviar"
                  hint="JPEG, PNG ou WebP · até 8 MB · reprocessada em WebP"
                  value={
                    field.value
                      ? { path: field.value, sha256: "", size: 0, mime: "image/webp" }
                      : null
                  }
                  onUploaded={(meta) => { field.onChange(meta?.path ?? null); }}
                />
              )}
            />
          </Field>

          {type === "DIGITAL" ? (
            <Field
              name="digitalFile"
              label="Arquivo digital"
              required
              error={errors.digitalFile?.message}
            >
              <Controller
                control={control}
                name="digitalFile"
                render={({ field }) => (
                  <FileDropzone
                    kind="digital"
                    accept=".pdf,.epub,application/pdf,application/epub+zip"
                    label="Arraste o PDF ou EPUB"
                    hint="Até 50 MB · validado por assinatura do arquivo"
                    value={
                      field.value
                        ? {
                            path: field.value.path,
                            sha256: field.value.sha256,
                            size: field.value.sizeBytes,
                            mime: field.value.mimeType,
                            originalName: field.value.originalName,
                          }
                        : null
                    }
                    onUploaded={(meta) => {
                      if (!meta) {
                        field.onChange(null);
                        return;
                      }
                      field.onChange({
                        path: meta.path,
                        originalName: meta.originalName ?? "arquivo",
                        mimeType: meta.mime as "application/pdf" | "application/epub+zip",
                        sizeBytes: meta.size,
                        sha256: meta.sha256,
                      });
                    }}
                  />
                )}
              />
            </Field>
          ) : (
            <Field name="deliveryNote" label="Nota de entrega" error={errors.deliveryNote?.message}>
              <Textarea
                rows={3}
                placeholder="Entraremos em contato em até 1 dia útil pelo WhatsApp."
                {...register("deliveryNote")}
                {...fieldA11y("deliveryNote", errors.deliveryNote?.message)}
              />
            </Field>
          )}
        </section>

        <div className="flex flex-wrap gap-3 border-t border-mist-200 pt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar produto"}
          </Button>
          <Link href="/admin/produtos" className={cn(buttonVariants({ variant: "outline" }))}>
            Cancelar
          </Link>
        </div>
      </form>

      <Dialog open={slugConfirmOpen} onOpenChange={setSlugConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar slug do produto publicado?</DialogTitle>
            <DialogDescription>
              Links antigos (/p/slug-antigo) deixarão de abrir a página atual. Criaremos um
              redirecionamento 301, mas materiais externos com o slug antigo podem quebrar a
              percepção do comprador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setSlugConfirmOpen(false); }}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setSlugConfirmOpen(false);
                void handleSubmit((values) => { submit(values, true); })();
              }}
            >
              Alterar slug
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  slug: "Slug",
  type: "Tipo",
  status: "Status",
  shortDescription: "Descrição curta",
  description: "Descrição",
  priceCents: "Preço",
  compareAtPriceCents: "Preço de",
  commissionType: "Tipo de comissão",
  commissionValue: "Comissão",
  allowPix: "Pix",
  allowCard: "Cartão",
  maxInstallments: "Parcelas",
  digitalFile: "Arquivo digital",
  deliveryNote: "Nota de entrega",
  coverImagePath: "Capa",
  sortOrder: "Ordem",
};
