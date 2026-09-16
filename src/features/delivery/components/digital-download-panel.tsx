"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { resendDownloadAction } from "@/features/delivery/actions";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DigitalDownloadPanelProps = {
  publicCode: string;
  accessToken: string;
  downloadUrl: string | null;
  expiresAtLabel: string | null;
  remaining: number | null;
  maxDownloads: number | null;
};

export function DigitalDownloadPanel(props: DigitalDownloadPanelProps) {
  const [pending, startTransition] = useTransition();
  const [downloadUrl, setDownloadUrl] = useState(props.downloadUrl);
  const [expiresAtLabel, setExpiresAtLabel] = useState(props.expiresAtLabel);
  const [remaining, setRemaining] = useState(props.remaining);
  const [maxDownloads, setMaxDownloads] = useState(props.maxDownloads);

  function resend() {
    startTransition(async () => {
      const result = await resendDownloadAction({
        publicCode: props.publicCode,
        accessToken: props.accessToken,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setExpiresAtLabel(
        new Intl.DateTimeFormat("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(new Date(result.data.expiresAt)),
      );
      setMaxDownloads(result.data.maxDownloads);
      setRemaining(result.data.remaining);
      setDownloadUrl(result.data.downloadUrl);
      toast.success("Enviamos um novo link para o e-mail da compra.");
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-mist-200 bg-white p-6 text-center">
      <p className="font-display text-2xl text-navy-900">Pagamento confirmado</p>
      <p className="text-sm text-navy-700">Seu material digital está pronto para download.</p>

      {expiresAtLabel ? (
        <p className="text-sm text-muted-foreground">
          Válido até {expiresAtLabel}
          {remaining !== null && maxDownloads !== null
            ? ` · ${String(remaining)} de ${String(maxDownloads)} downloads restantes`
            : null}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Peça o reenvio do link por e-mail se o download não aparecer.
        </p>
      )}

      {downloadUrl ? (
        <a href={downloadUrl} className={cn(buttonVariants())}>
          Baixar livro
        </a>
      ) : null}

      <div>
        <Button type="button" variant="outline" disabled={pending} onClick={resend}>
          {pending ? "Enviando…" : "Reenviar link por e-mail"}
        </Button>
      </div>
    </div>
  );
}
