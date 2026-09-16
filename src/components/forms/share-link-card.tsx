"use client";

import { Download, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/forms/copy-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type ShareLinkCardProps = {
  url: string;
  /** Nome do arquivo PNG do QR: `link-<code>-<slug>.png` ou `link-<code>.png`. */
  qrFileName: string;
  title: string;
  description?: string;
  /** Texto pré-preenchido no WhatsApp / Web Share. */
  shareText: string;
};

function subscribeNoop(): () => void {
  return () => undefined;
}

function getNativeShareSnapshot(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Card de link: input readonly + copiar + QR (PNG) + WhatsApp + Web Share.
 * Padrão UX 4 (docs/spec/05).
 */
export function ShareLinkCard({
  url,
  qrFileName,
  title,
  description,
  shareText,
}: ShareLinkCardProps) {
  const inputId = useId();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const canNativeShare = useSyncExternalStore(subscribeNoop, getNativeShareSnapshot, () => false);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#00172d", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;

  async function handleShare(): Promise<void> {
    if (!canNativeShare) return;
    try {
      await navigator.share({ title, text: shareText, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar.");
    }
  }

  function downloadQr(): void {
    if (!qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = qrFileName;
    anchor.click();
  }

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-mist-200 bg-white p-4 shadow-card">
      <div>
        <h3 className="font-medium text-navy-900">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={inputId}>Seu link</Label>
          <Input
            id={inputId}
            readOnly
            value={url}
            className="font-mono text-sm"
            onFocus={(e) => {
              e.target.select();
            }}
          />
        </div>
        <CopyButton value={url} label="Copiar" successMessage="Link copiado" className="shrink-0" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <QrCode className="size-4" aria-hidden />
              QR Code
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>QR Code</DialogTitle>
              <DialogDescription>
                Baixe o PNG para stories e materiais impressos.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-2">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL gerado no client
                <img src={qrDataUrl} alt={`QR Code de ${title}`} className="size-56 rounded-md border" />
              ) : (
                <div className="size-56 animate-pulse rounded-md bg-mist-100" aria-hidden />
              )}
              <Button type="button" onClick={downloadQr} disabled={!qrDataUrl}>
                <Download className="size-4" aria-hidden />
                Baixar PNG
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Button type="button" variant="outline" size="sm" asChild>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
        </Button>

        {canNativeShare ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void handleShare();
            }}
          >
            <Share2 className="size-4" aria-hidden />
            Compartilhar
          </Button>
        ) : null}
      </div>
    </article>
  );
}
