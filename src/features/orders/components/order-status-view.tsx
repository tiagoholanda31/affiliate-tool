"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { DigitalDownloadPanel } from "@/features/delivery/components/digital-download-panel";
import { CountdownTimer } from "@/components/data-display/countdown-timer";
import { MoneyText } from "@/components/data-display/money-text";
import { PixQr } from "@/components/data-display/pix-qr";
import { StatusBadge } from "@/components/data-display/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { labelFor } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

export type OrderStatusViewProps = {
  publicCode: string;
  accessToken: string;
  initialStatus: string;
  productName: string;
  productSlug: string;
  amountCents: number;
  paymentMethod: string;
  failureReason?: string | null;
  deliveryNote?: string | null;
  productType?: string;
  pixQrCode?: string | null;
  pixExpiresAt?: string | null;
  refundRequested?: boolean;
  downloadUrl?: string | null;
  downloadExpiresAtLabel?: string | null;
  downloadRemaining?: number | null;
  downloadMax?: number | null;
};

function toneFor(status: string) {
  switch (status) {
    case "PAID":
      return "success" as const;
    case "PENDING":
      return "warning" as const;
    case "FAILED":
    case "EXPIRED":
    case "CHARGEDBACK":
      return "danger" as const;
    case "REFUNDED":
    case "CANCELED":
      return "neutral" as const;
    default:
      return "info" as const;
  }
}

export function OrderStatusView(props: OrderStatusViewProps) {
  const [status, setStatus] = useState(props.initialStatus);
  const [failureReason, setFailureReason] = useState(props.failureReason);

  useEffect(() => {
    if (status !== "PENDING") return;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(props.publicCode)}/status?t=${encodeURIComponent(props.accessToken)}`,
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          status: string;
          failureReason?: string | null;
        };
        setStatus(json.status);
        if (json.failureReason) setFailureReason(json.failureReason);
      } catch {
        // silencioso — próximo tick tenta de novo
      }
    };

    const id = window.setInterval(() => void poll(), 4000);
    void poll();
    return () => {
      window.clearInterval(id);
    };
  }, [status, props.publicCode, props.accessToken]);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8" aria-live="polite">
      <div className="space-y-2 text-center">
        <StatusBadge label={labelFor("orderStatus", status)} tone={toneFor(status)} />
        <h1 className="font-display text-3xl text-navy-900">Pedido {props.publicCode}</h1>
        <p className="text-navy-700">{props.productName}</p>
        <MoneyText cents={props.amountCents} className="text-xl" />
      </div>

      {status === "PENDING" && props.paymentMethod === "PIX" && props.pixQrCode ? (
        <div className="space-y-4 rounded-lg border border-mist-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-navy-700">Tempo restante</p>
            {props.pixExpiresAt ? <CountdownTimer expiresAt={props.pixExpiresAt} /> : null}
          </div>
          <PixQr copyPaste={props.pixQrCode} />
          <ol className="list-decimal space-y-1 pl-5 text-sm text-navy-700">
            <li>Abra o app do seu banco</li>
            <li>Escolha pagar com Pix (QR ou copia-e-cola)</li>
            <li>Confirme o valor e aguarde a confirmação nesta página</li>
          </ol>
        </div>
      ) : null}

      {status === "PENDING" && props.paymentMethod === "CREDIT_CARD" ? (
        <div className="rounded-lg border border-mist-200 bg-white p-6 text-center">
          <p className="font-medium text-navy-900">Analisando pagamento…</p>
          <p className="mt-2 text-sm text-navy-700">
            Isso pode levar alguns instantes. Esta página atualiza sozinha.
          </p>
        </div>
      ) : null}

      {status === "PAID" ? (
        props.productType === "DIGITAL" ? (
          <DigitalDownloadPanel
            publicCode={props.publicCode}
            accessToken={props.accessToken}
            downloadUrl={props.downloadUrl ?? null}
            expiresAtLabel={props.downloadExpiresAtLabel ?? null}
            remaining={props.downloadRemaining ?? null}
            maxDownloads={props.downloadMax ?? null}
          />
        ) : (
          <div className="space-y-3 rounded-lg border border-mist-200 bg-white p-6 text-center">
            <p className="font-display text-2xl text-navy-900">Pagamento confirmado</p>
            {props.deliveryNote ? (
              <p className="text-sm text-navy-700">{props.deliveryNote}</p>
            ) : null}
          </div>
        )
      ) : null}

      {status === "FAILED" ? (
        <div className="space-y-4 rounded-lg border border-mist-200 bg-white p-6 text-center">
          <p className="font-medium text-navy-900">Pagamento não concluído</p>
          <p className="text-sm text-navy-700">
            {failureReason ?? "Não foi possível concluir o pagamento."}
          </p>
          <Link href={`/p/${props.productSlug}`} className={cn(buttonVariants())}>
            Tentar de novo
          </Link>
        </div>
      ) : null}

      {status === "EXPIRED" ? (
        <div className="space-y-4 rounded-lg border border-mist-200 bg-white p-6 text-center">
          <p className="font-medium text-navy-900">Pix expirado</p>
          <p className="text-sm text-navy-700">Gere um novo pagamento para continuar.</p>
          <Link href={`/p/${props.productSlug}`} className={cn(buttonVariants())}>
            Gerar novo Pix
          </Link>
        </div>
      ) : null}

      {status === "REFUNDED" || status === "CHARGEDBACK" ? (
        <div className="rounded-lg border border-mist-200 bg-white p-6 text-center">
          <p className="font-medium text-navy-900">
            {status === "REFUNDED" ? "Pagamento estornado" : "Chargeback registrado"}
          </p>
          {props.refundRequested ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Estorno solicitado — aguardando confirmação do gateway.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
