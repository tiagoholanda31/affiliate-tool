import type { Metadata } from "next";

import { Markdown } from "@/components/content/markdown";
import { PageHeader } from "@/components/layout/page-header";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Termos do Programa de Afiliados" };

/**
 * Sempre no servidor, a cada requisição. Dois motivos: o texto vem do banco e
 * pode mudar sem deploy, e o `docker build` roda sem banco — pré-renderizar esta
 * página quebraria a imagem.
 */
export const dynamic = "force-dynamic";

/**
 * Termos do programa.
 *
 * O texto vive em `Setting.termsMarkdown` e é renderizado com markdown
 * sanitizado (`rehype-sanitize`) — sem `dangerouslySetInnerHTML` cru.
 */
export default async function TermsPage() {
  const { termsMarkdown, termsVersion } = await getSettings();

  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader
        title="Termos do Programa de Afiliados"
        eyebrow={`Versão ${termsVersion}`}
        description="Estas são as condições que você aceita ao participar do programa."
      />

      <div className="rounded-lg bg-white p-6 shadow-card sm:p-8">
        {termsMarkdown ? (
          <Markdown className="text-sm leading-6 text-navy-700">{termsMarkdown}</Markdown>
        ) : (
          <p className="text-sm text-muted-foreground">
            O texto dos termos ainda está sendo finalizado. Fale com o Affiliate Tool se precisar
            dele antes de se cadastrar.
          </p>
        )}
      </div>
    </article>
  );
}
