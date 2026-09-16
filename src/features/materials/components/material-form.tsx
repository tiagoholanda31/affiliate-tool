"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FileDropzone, type UploadedFileMeta } from "@/components/forms/file-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createMaterialAction,
  updateMaterialAction,
} from "@/features/materials/actions";
import {
  createMaterialSchema,
  updateMaterialSchema,
  type MaterialFormInput,
  type MaterialTypeValue,
} from "@/features/materials/schemas";
import { labelFor } from "@/lib/i18n/pt-BR";

export type MaterialFormProduct = { id: string; name: string; slug: string };

export type MaterialFormInitial = {
  id: string;
  title: string;
  description: string | null;
  type: MaterialTypeValue;
  productId: string | null;
  isActive: boolean;
  sortOrder: number;
  textContent: string | null;
  externalUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  thumbPath: string | null;
};

type MaterialFormProps = {
  mode: "create" | "edit";
  products: MaterialFormProduct[];
  initial?: MaterialFormInitial;
  onDone: () => void;
};

const TYPES: MaterialTypeValue[] = ["IMAGE", "PDF", "TEXT", "LINK"];

function toDefaults(initial?: MaterialFormInitial): MaterialFormInput {
  if (!initial) {
    return {
      title: "",
      description: null,
      type: "TEXT",
      productId: null,
      isActive: true,
      sortOrder: 0,
      textContent: "",
      externalUrl: null,
      file: null,
    };
  }

  const file =
    initial.filePath && initial.fileName && initial.mimeType && initial.sizeBytes
      ? {
          path: initial.filePath,
          originalName: initial.fileName,
          mimeType: initial.mimeType,
          sizeBytes: initial.sizeBytes,
          sha256: "0".repeat(64),
          thumbPath: initial.thumbPath ?? undefined,
        }
      : null;

  return {
    title: initial.title,
    description: initial.description,
    type: initial.type,
    productId: initial.productId,
    isActive: initial.isActive,
    sortOrder: initial.sortOrder,
    textContent: initial.textContent,
    externalUrl: initial.externalUrl,
    file,
  };
}

export function MaterialForm({ mode, products, initial, onDone }: MaterialFormProps) {
  const [pending, startTransition] = useTransition();

  const form = useForm<MaterialFormInput>({
    resolver: zodResolver(mode === "create" ? createMaterialSchema : updateMaterialSchema) as never,
    defaultValues: toDefaults(initial),
    mode: "onBlur",
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
    reset,
  } = form;

  useEffect(() => {
    reset(toDefaults(initial));
  }, [initial, reset]);

  const type = useWatch({ control, name: "type", defaultValue: "TEXT" });

  function onUploaded(meta: UploadedFileMeta | null) {
    if (!meta) {
      setValue("file", null, { shouldValidate: true });
      return;
    }
    setValue(
      "file",
      {
        path: meta.path,
        originalName: meta.originalName ?? meta.path.split("/").pop() ?? "arquivo",
        mimeType: meta.mime,
        sizeBytes: meta.size,
        sha256: meta.sha256,
        thumbPath: meta.thumbPath,
      },
      { shouldValidate: true },
    );
  }

  function submit(values: MaterialFormInput) {
    startTransition(async () => {
      const placeholderSha = "0".repeat(64);
      const existingPath = initial?.filePath ?? null;
      const fileIsNew =
        values.file != null &&
        values.file.sha256 !== placeholderSha &&
        (values.file.path !== existingPath || !existingPath);

      const payload = {
        ...values,
        description: values.description ?? null,
        productId: values.productId ?? null,
        textContent: values.type === "TEXT" ? values.textContent : null,
        externalUrl: values.type === "LINK" ? values.externalUrl : null,
        file:
          values.type === "IMAGE" || values.type === "PDF"
            ? fileIsNew
              ? values.file
              : null
            : null,
      };

      const result =
        mode === "create"
          ? await createMaterialAction(payload)
          : initial
            ? await updateMaterialAction({ ...payload, id: initial.id })
            : { ok: false as const, error: "Material não encontrado." };

      if (!result.ok) {
        toast.error(result.error);
        if (result.fieldErrors) {
          for (const [name, messages] of Object.entries(result.fieldErrors)) {
            setError(name as keyof MaterialFormInput, { message: messages[0] });
          }
        }
        return;
      }

      toast.success(mode === "create" ? "Material criado." : "Material atualizado.");
      onDone();
    });
  }

  const fileValue = useWatch({ control, name: "file" });
  const dropzoneValue: UploadedFileMeta | null = fileValue
    ? {
        path: fileValue.path,
        sha256: fileValue.sha256,
        size: fileValue.sizeBytes,
        mime: fileValue.mimeType,
        originalName: fileValue.originalName,
        thumbPath: fileValue.thumbPath,
      }
    : null;

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(submit)} noValidate>
      <div className="space-y-2">
        <Label htmlFor="material-title">Título</Label>
        <Input id="material-title" {...register("title")} aria-invalid={Boolean(errors.title)} />
        {errors.title ? (
          <p className="text-sm text-[color:var(--color-danger)]" role="alert">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="material-description">Descrição (opcional)</Label>
        <Textarea id="material-description" rows={2} {...register("description")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="material-type">Tipo</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  setValue("file", null);
                  setValue("textContent", null);
                  setValue("externalUrl", null);
                }}
              >
                <SelectTrigger id="material-type" aria-invalid={Boolean(errors.type)}>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {labelFor("materialType", t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="material-product">Produto (opcional)</Label>
          <Controller
            control={control}
            name="productId"
            render={({ field }) => (
              <Select
                value={field.value ?? "__none__"}
                onValueChange={(value) => {
                  field.onChange(value === "__none__" ? null : value);
                }}
              >
                <SelectTrigger id="material-product">
                  <SelectValue placeholder="Geral" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Geral (sem produto)</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="material-sort">Ordem</Label>
          <Input
            id="material-sort"
            type="number"
            min={0}
            {...register("sortOrder", { valueAsNumber: true })}
          />
        </div>
        <div className="flex items-end gap-3 pb-1">
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <>
                <Switch
                  id="material-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="material-active">Ativo (visível ao afiliado)</Label>
              </>
            )}
          />
        </div>
      </div>

      {type === "TEXT" ? (
        <div className="space-y-2">
          <Label htmlFor="material-text">Texto</Label>
          <Textarea
            id="material-text"
            rows={5}
            placeholder="Use {{link}} onde o link do afiliado deve aparecer."
            {...register("textContent")}
            aria-invalid={Boolean(errors.textContent)}
          />
          {errors.textContent ? (
            <p className="text-sm text-[color:var(--color-danger)]" role="alert">
              {errors.textContent.message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              O placeholder {"{{link}}"} vira o link do afiliado ao copiar.
            </p>
          )}
        </div>
      ) : null}

      {type === "LINK" ? (
        <div className="space-y-2">
          <Label htmlFor="material-url">URL</Label>
          <Input
            id="material-url"
            type="url"
            placeholder="https://"
            {...register("externalUrl")}
            aria-invalid={Boolean(errors.externalUrl)}
          />
          {errors.externalUrl ? (
            <p className="text-sm text-[color:var(--color-danger)]" role="alert">
              {errors.externalUrl.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {type === "IMAGE" || type === "PDF" ? (
        <div className="space-y-2">
          <Label>{type === "IMAGE" ? "Imagem" : "PDF"}</Label>
          <FileDropzone
            kind="material"
            accept={type === "IMAGE" ? "image/jpeg,image/png,image/webp" : "application/pdf"}
            label={
              type === "IMAGE"
                ? "Arraste a imagem (até 10 MB)"
                : "Arraste o PDF (até 20 MB)"
            }
            hint={
              mode === "edit" && initial?.filePath && !fileValue
                ? "Deixe em branco para manter o arquivo atual."
                : undefined
            }
            value={dropzoneValue}
            onUploaded={onUploaded}
            disabled={pending}
          />
          {errors.file?.message ? (
            <p className="text-sm text-[color:var(--color-danger)]" role="alert">
              {errors.file.message}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar material"}
        </Button>
      </div>
    </form>
  );
}
