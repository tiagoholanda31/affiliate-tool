"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import {
  adminResendDownloadAction,
  adminRevokeGrantsAction,
} from "@/features/delivery/actions";
import { DateText } from "@/components/data-display/date-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";

export type GrantRow = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  maxDownloads: number;
  downloadCount: number;
  lastDownloadAt: Date | null;
  revokedAt: Date | null;
};

type Props = {
  orderId: string;
  grants: GrantRow[];
  canManage: boolean;
};

function grantTone(g: GrantRow) {
  if (g.revokedAt) return "neutral" as const;
  if (g.expiresAt.getTime() <= Date.now()) return "warning" as const;
  if (g.downloadCount >= g.maxDownloads) return "warning" as const;
  return "success" as const;
}

function grantLabel(g: GrantRow) {
  if (g.revokedAt) return "Revogado";
  if (g.expiresAt.getTime() <= Date.now()) return "Expirado";
  if (g.downloadCount >= g.maxDownloads) return "Limite";
  return "Ativo";
}

export function AdminDeliverySection({ orderId, grants, canManage }: Props) {
  const [pending, startTransition] = useTransition();

  function resend() {
    startTransition(async () => {
      const result = await adminResendDownloadAction({ orderId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Novo link enviado ao comprador.");
    });
  }

  function revoke() {
    if (!window.confirm("Revogar todos os links de download deste pedido?")) return;
    startTransition(async () => {
      const result = await adminRevokeGrantsAction({ orderId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.revoked > 0
          ? `${String(result.data.revoked)} link(s) revogado(s).`
          : "Nenhum link ativo para revogar.",
      );
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-mist-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg text-navy-900">Entrega digital</h2>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={resend}>
              Reenviar link
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={revoke}
            >
              Revogar acesso
            </Button>
          </div>
        ) : null}
      </div>

      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum grant criado ainda.</p>
      ) : (
        <ul className="divide-y divide-mist-100 text-sm">
          {grants.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge label={grantLabel(g)} tone={grantTone(g)} />
                  <span className="font-mono text-xs text-muted-foreground">
                    {g.id.slice(0, 8)}…
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Criado <DateText date={g.createdAt} /> · expira{" "}
                  <DateText date={g.expiresAt} /> · {String(g.downloadCount)}/
                  {String(g.maxDownloads)} downloads
                  {g.lastDownloadAt ? (
                    <>
                      {" "}
                      · último <DateText date={g.lastDownloadAt} />
                    </>
                  ) : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
