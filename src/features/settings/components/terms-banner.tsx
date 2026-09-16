"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { acceptTermsAction } from "@/features/settings/actions";

export type TermsBannerProps = {
  /** Versão vigente em Setting — enviada no aceite. */
  termsVersion: string;
};

/**
 * Aviso não bloqueante quando o afiliado ainda não aceitou a versão atual dos termos.
 */
export function TermsBanner({ termsVersion }: TermsBannerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onAccept() {
    startTransition(async () => {
      const result = await acceptTermsAction({ termsVersion });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Termos aceitos. Obrigado!");
      router.refresh();
    });
  }

  return (
    <div
      role="status"
      className="mb-6 flex flex-col gap-3 rounded-lg border border-gold-600/30 bg-gold-100 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex gap-3">
        <FileText className="mt-0.5 size-5 shrink-0 text-gold-700" aria-hidden="true" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-navy-900">
            Atualizamos os termos do programa ({termsVersion})
          </p>
          <p className="text-sm text-navy-700">
            Revise as condições e aceite a nova versão.{" "}
            <Link
              href="/termos"
              className="font-medium text-teal-800 underline-offset-2 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver termos
            </Link>
          </p>
        </div>
      </div>
      <Button
        type="button"
        onClick={onAccept}
        disabled={pending}
        className="shrink-0 self-start sm:self-center"
      >
        {pending ? "Aceitando…" : "Aceitar termos"}
      </Button>
    </div>
  );
}
