import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Brand } from "@/components/layout/brand";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-mist-100 px-4 text-center">
      <Brand />
      <div className="space-y-2">
        <p className="font-display text-4xl text-navy-900">Página não encontrada</p>
        <p className="max-w-prose text-sm text-muted-foreground">
          O endereço que você abriu não existe ou foi movido.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Voltar ao início</Link>
      </Button>
    </div>
  );
}
