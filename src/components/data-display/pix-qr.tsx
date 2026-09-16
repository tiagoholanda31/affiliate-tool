"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PixQrProps = {
  copyPaste: string;
  className?: string;
};

export function PixQr({ copyPaste, className }: PixQrProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(copyPaste, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [copyPaste]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyPaste);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- QR gerado no client
        <img src={dataUrl} alt="QR Code Pix" width={280} height={280} className="rounded-md bg-white p-2" />
      ) : (
        <div className="size-[280px] animate-pulse rounded-md bg-mist-100" aria-hidden />
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => void copy()}
        className="w-full max-w-sm"
        aria-live="polite"
      >
        {copied ? "Código copiado!" : "Copiar código Pix"}
      </Button>
      <p className="max-w-sm break-all text-center text-xs text-muted-foreground">{copyPaste}</p>
    </div>
  );
}
