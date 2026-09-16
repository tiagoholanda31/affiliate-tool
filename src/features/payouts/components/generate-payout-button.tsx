"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { buildPayoutDraftAction } from "@/features/payouts/actions";
import { Button } from "@/components/ui/button";

type Props = {
  affiliateId: string;
  disabled?: boolean;
};

export function GeneratePayoutButton({ affiliateId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={disabled === true || pending}
      onClick={() => {
        startTransition(async () => {
          const result = await buildPayoutDraftAction({ affiliateId });
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success("Lote gerado.");
          router.push(`/admin/pagamentos/${result.data.payoutId}`);
        });
      }}
    >
      {pending ? "Gerando…" : "Gerar lote"}
    </Button>
  );
}
