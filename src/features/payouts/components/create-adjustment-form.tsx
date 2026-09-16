"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createManualAdjustmentAction } from "@/features/payouts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseBRL } from "@/lib/money";

type Props = {
  affiliateId: string;
};

export function CreateAdjustmentForm({ affiliateId }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3 rounded-lg border border-mist-300 bg-white p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const cents = parseBRL(amount);
        if (cents === null || cents === 0) {
          toast.error("Informe um valor diferente de zero.");
          return;
        }
        startTransition(async () => {
          const result = await createManualAdjustmentAction({
            affiliateId,
            amountCents: cents,
            reason,
          });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Ajuste criado.");
          setAmount("");
          setReason("");
          router.refresh();
        });
      }}
    >
      <p className="text-sm font-medium text-navy-900">Criar ajuste</p>
      <p className="text-xs text-muted-foreground">
        Use valor negativo para débito (ex. -50,00) e positivo para crédito.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="adj-amount">Valor (R$)</Label>
          <Input
            id="adj-amount"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); }}
            placeholder="-50,00"
            required
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="adj-reason">Motivo</Label>
          <Textarea
            id="adj-reason"
            value={reason}
            onChange={(e) => { setReason(e.target.value); }}
            required
            minLength={3}
            rows={2}
          />
        </div>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Salvando…" : "Salvar ajuste"}
      </Button>
    </form>
  );
}
