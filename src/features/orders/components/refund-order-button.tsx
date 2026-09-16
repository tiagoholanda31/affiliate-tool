"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";
import { refundOrderAction } from "@/features/orders/admin-actions";

export function RefundOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" disabled={pending}>
          Estornar
        </Button>
      }
      title="Estornar este pedido?"
      description="O estorno será solicitado no Pagar.me. O status final chega por webhook ou reconciliação."
      confirmLabel="Estornar"
      variant="destructive"
      typeToConfirm="ESTORNAR"
      typeToConfirmLabel="Digite ESTORNAR para confirmar"
      onConfirm={() => {
        startTransition(async () => {
          const result = await refundOrderAction({ orderId, confirm: "ESTORNAR" });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Estorno solicitado.");
          router.refresh();
        });
      }}
    />
  );
}
