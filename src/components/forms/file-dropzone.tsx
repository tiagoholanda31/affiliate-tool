"use client";

import { FileUp, Loader2, X } from "lucide-react";
import { useCallback, useRef, useState, type DragEvent, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploadedFileMeta = {
  path: string;
  sha256: string;
  size: number;
  mime: string;
  originalName?: string;
  /** Thumb WebP (materiais IMAGE). */
  thumbPath?: string;
};

type FileDropzoneProps = {
  kind: "cover" | "digital" | "proof" | "material";
  accept: string;
  label: string;
  hint?: string;
  value?: UploadedFileMeta | null;
  onUploaded: (meta: UploadedFileMeta | null) => void;
  disabled?: boolean;
};

/**
 * Dropzone com progresso via XHR (upload não trava a UI).
 * Envia para `/api/admin/uploads/[kind]`.
 */
export function FileDropzone({
  kind,
  accept,
  label,
  hint,
  value,
  onUploaded,
  disabled,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    (file: File) => {
      setError(null);
      setProgress(0);

      const body = new FormData();
      body.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/admin/uploads/${kind}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
      xhr.onload = () => {
        setProgress(null);
        try {
          const json = JSON.parse(xhr.responseText) as {
            ok: boolean;
            error?: string;
            data?: UploadedFileMeta;
          };
          if (!json.ok || !json.data) {
            setError(json.error ?? "Falha no upload.");
            return;
          }
          onUploaded(json.data);
        } catch {
          setError("Resposta inválida do servidor.");
        }
      };
      xhr.onerror = () => {
        setProgress(null);
        setError("Não foi possível enviar o arquivo.");
      };
      xhr.send(body);
    },
    [kind, onUploaded],
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (disabled || progress !== null) return;
    const file = event.dataTransfer.files[0];
    if (file) upload(file);
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) upload(file);
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => { setDragging(false); }}
        onDrop={onDrop}
        onClick={() => !disabled && progress === null && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-mist-300 bg-mist-50 px-4 py-8 text-center transition-colors",
          dragging && "border-teal-700 bg-teal-700/5",
          (disabled ?? false) || progress !== null ? "pointer-events-none opacity-60" : null,
        )}
      >
        {progress !== null ? (
          <>
            <Loader2 className="size-6 animate-spin text-teal-700" aria-hidden />
            <p className="text-sm text-navy-700">Enviando… {progress}%</p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-mist-200">
              <div className="h-full bg-teal-700 transition-all" style={{ width: `${String(progress)}%` }} />
            </div>
          </>
        ) : (
          <>
            <FileUp className="size-6 text-navy-700" aria-hidden />
            <p className="text-sm font-medium text-navy-900">{label}</p>
            {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={(disabled ?? false) || progress !== null}
          onChange={onChange}
        />
      </div>

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-mist-200 bg-white px-3 py-2 text-sm">
          <span className="truncate text-navy-800">
            {value.originalName ?? value.path.split("/").pop()}
            <span className="ml-2 text-xs text-muted-foreground">
              ({(value.size / 1024).toFixed(0)} KB)
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remover arquivo"
            onClick={() => { onUploaded(null); }}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[color:var(--color-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
