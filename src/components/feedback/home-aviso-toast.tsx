"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TOAST_BY_AVISO: Record<string, string> = {
  "produto-nao-encontrado": "Produto não encontrado.",
};

/**
 * Lê `?aviso=` na vitrine e mostra um toast uma vez, depois limpa a URL.
 * Usado quando `/r/<code>/<slug>` aponta para slug inexistente.
 */
export function HomeAvisoToast({ aviso }: { aviso?: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!aviso) return;
    const message = TOAST_BY_AVISO[aviso] ?? "Não encontramos o que você procura.";
    toast.error(message);
    router.replace("/", { scroll: false });
  }, [aviso, router]);

  return null;
}
