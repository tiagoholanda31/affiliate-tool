"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Eye } from "lucide-react";

import { revealPixKey } from "@/features/affiliates/admin-actions";
import {
  discardDraftAction,
  markPayoutPaidAction,
  removeCommissionFromDraftAction,
} from "@/features/payouts/actions";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { FileDropzone, type UploadedFileMeta } from "@/components/forms/file-dropzone";
import { MoneyText } from "@/components/data-display/money-text";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/money";
import { toIsoDate } from "@/lib/dates";
import { labelFor } from "@/lib/i18n/pt-BR";

export type PayoutDetailClientProps = {
  payout: {
    id: string;
    status: "DRAFT" | "PAID";
    totalCents: number;
    referenceMonth: string;
    paidAt: Date | null;
    proofReference: string | null;
    proofPath: string | null;
    notes: string | null;
    affiliate: {
      id: string;
      code: string | null;
      pixKeyType: string;
      pixKeyMasked: string;
      user: { name: string; email: string };
    };
    commissions: {
      id: string;
      amountCents: number;
      order: { publicCode: string; product: { name: string } };
    }[];
    adjustments: {
      id: string;
      amountCents: number;
      reason: string;
    }[];
  };
};

export function PayoutDetailClient({ payout }: PayoutDetailClientProps) {
  const router = useRouter();
  const isDraft = payout.status === "DRAFT";
  const [revealedPix, setRevealedPix] = useState<string | null>(null);
  const [paidAt, setPaidAt] = useState(toIsoDate(new Date()));
  const [proofReference, setProofReference] = useState("");
  const [proof, setProof] = useState<UploadedFileMeta | null>(null);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  async function runReveal() {
    const result = await revealPixKey({ affiliateId: payout.affiliate.id });
    if (result.ok) {
      setRevealedPix(result.data.pixKey);
      toast.success("Chave Pix revelada.");
    } else {
      toast.error(result.error);
    }
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiada.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Chave Pix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tipo: {labelFor("pixKeyType", payout.affiliate.pixKeyType)}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-mist-100 px-3 py-2 text-sm text-navy-900">
              {revealedPix ?? payout.affiliate.pixKeyMasked}
            </code>
            {revealedPix ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copy(revealedPix, "Chave")}
              >
                <Copy className="size-4" aria-hidden="true" />
                Copiar chave
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => void runReveal()}>
                <Eye className="size-4" aria-hidden="true" />
                Revelar
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void copy(formatBRL(payout.totalCents), "Valor")}
            >
              <Copy className="size-4" aria-hidden="true" />
              Copiar valor
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-lg">Comissões no lote</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                {isDraft ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {payout.commissions.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.order.publicCode}</TableCell>
                  <TableCell>{c.order.product.name}</TableCell>
                  <TableCell className="text-right">
                    <MoneyText cents={c.amountCents} />
                  </TableCell>
                  {isDraft ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending || payout.commissions.length <= 1}
                        onClick={() => {
                          startTransition(async () => {
                            const result = await removeCommissionFromDraftAction({
                              payoutId: payout.id,
                              commissionId: c.id,
                            });
                            if (!result.ok) {
                              toast.error(result.error);
                              return;
                            }
                            toast.success("Comissão removida do lote.");
                            router.refresh();
                          });
                        }}
                      >
                        Remover
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {payout.adjustments.length > 0 ? (
            <div className="mt-6 space-y-2">
              <h3 className="text-sm font-medium text-navy-900">Ajustes</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payout.adjustments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.reason}</TableCell>
                      <TableCell className="text-right">
                        <MoneyText cents={a.amountCents} showSign />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {isDraft ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Marcar como pago</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ao confirmar, {payout.commissions.length} comissão
              {payout.commissions.length === 1 ? "" : "ões"} ({formatBRL(payout.totalCents)})
              passam a &quot;Paga&quot; e o afiliado {payout.affiliate.user.name} recebe e-mail com o
              extrato.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paidAt">Data do pagamento</Label>
                <Input
                  id="paidAt"
                  type="date"
                  value={paidAt}
                  onChange={(e) => { setPaidAt(e.target.value); }}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proofReference">Referência Pix (E2E/ID)</Label>
                <Input
                  id="proofReference"
                  value={proofReference}
                  onChange={(e) => { setProofReference(e.target.value); }}
                  placeholder="Opcional se houver comprovante"
                />
              </div>
            </div>

            <FileDropzone
              kind="proof"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              label="Comprovante (PDF ou imagem, até 5 MB)"
              hint="Obrigatório se não informar a referência Pix."
              value={proof}
              onUploaded={setProof}
            />

            <div className="space-y-2">
              <Label htmlFor="notes">Observação</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => { setNotes(e.target.value); }}
                rows={3}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <ConfirmDialog
                trigger={
                  <Button type="button" disabled={pending}>
                    Marcar como pago
                  </Button>
                }
                title="Confirmar pagamento do lote"
                description={
                  <span>
                    Serão marcadas {payout.commissions.length} comissão
                    {payout.commissions.length === 1 ? "" : "ões"} como pagas, no valor de{" "}
                    <strong>{formatBRL(payout.totalCents)}</strong>. O afiliado receberá o e-mail
                    de extrato em {payout.affiliate.user.email}.
                  </span>
                }
                confirmLabel="Confirmar pagamento"
                onConfirm={async () => {
                  const result = await markPayoutPaidAction({
                    payoutId: payout.id,
                    paidAt,
                    proofReference: proofReference || null,
                    proofPath: proof?.path ?? null,
                    notes: notes || null,
                  });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Lote marcado como pago.");
                  router.refresh();
                }}
              />

              <ConfirmDialog
                trigger={
                  <Button type="button" variant="outline" disabled={pending}>
                    Descartar rascunho
                  </Button>
                }
                title="Descartar rascunho?"
                description="As comissões voltam ao saldo disponível do afiliado."
                confirmLabel="Descartar"
                variant="destructive"
                onConfirm={async () => {
                  const result = await discardDraftAction({ payoutId: payout.id });
                  if (!result.ok) {
                    toast.error(result.error);
                    return;
                  }
                  toast.success("Rascunho descartado.");
                  router.push("/admin/pagamentos");
                }}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Comprovante</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payout.proofReference ? (
              <p>
                Referência: <code>{payout.proofReference}</code>
              </p>
            ) : null}
            {payout.proofPath ? (
              <Button asChild variant="outline" size="sm">
                <a href={`/api/pagamentos/${payout.id}/comprovante`}>Baixar comprovante</a>
              </Button>
            ) : null}
            {payout.notes ? <p className="text-muted-foreground">Obs.: {payout.notes}</p> : null}
            <p className="text-muted-foreground">Lote pago — imutável.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
