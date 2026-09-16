import { render } from "@react-email/render";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_NAMES,
  isEmailTemplateName,
  type EmailTemplateName,
} from "@emails/registry";
import { cn } from "@/lib/utils";
import { isDevelopment } from "@/lib/env";

export const metadata: Metadata = { title: "Pré-visualização de e-mails" };

export const dynamic = "force-dynamic";

/**
 * Catálogo de e-mails, só em desenvolvimento (o proxy devolve 404 em produção).
 *
 * Renderiza o template com os dados de exemplo do próprio registry, dentro de um
 * `iframe` isolado por `srcDoc`: o HTML de e-mail traz estilos que atrapalhariam
 * a página, e o iframe também aproxima o resultado do que um cliente de e-mail
 * mostra. A versão em texto puro vem junto, porque é ela que chega a quem lê
 * e-mail sem HTML.
 */
export default async function EmailPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  if (!isDevelopment) notFound();

  const { template } = await searchParams;
  const selected: EmailTemplateName =
    template && isEmailTemplateName(template) ? template : (EMAIL_TEMPLATE_NAMES[0] ?? "verify-email");

  const definition = EMAIL_TEMPLATES[selected];
  // O `as never` existe porque o TypeScript não consegue estreitar `render` e
  // `preview` para o *mesmo* membro da união quando o nome vem de uma variável.
  const element = definition.render(definition.preview as never);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  const subject = definition.subject(definition.preview as never);

  return (
    <div className="min-h-dvh bg-mist-100 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-display text-2xl text-navy-900">E-mails</h1>
          <p className="text-sm text-muted-foreground">
            Pré-visualização com dados de exemplo. Disponível apenas em desenvolvimento.
          </p>
        </header>

        <nav aria-label="Templates" className="flex flex-wrap gap-2">
          {EMAIL_TEMPLATE_NAMES.map((name) => (
            <Link
              key={name}
              href={`/dev/emails?template=${name}`}
              aria-current={name === selected ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                name === selected
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-mist-300 bg-white text-navy-700 hover:border-navy-900",
              )}
            >
              {EMAIL_TEMPLATES[name].label}
            </Link>
          ))}
        </nav>

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="space-y-2">
            <p className="text-sm text-navy-700">
              <span className="text-muted-foreground">Assunto: </span>
              <strong>{subject}</strong>
            </p>
            <iframe
              title={`Pré-visualização de ${definition.label}`}
              srcDoc={html}
              sandbox=""
              className="h-[70vh] w-full rounded-lg border border-mist-300 bg-white"
            />
          </div>

          <aside className="space-y-2">
            <h2 className="text-sm font-semibold text-navy-900">Versão em texto</h2>
            <pre className="h-[70vh] overflow-auto rounded-lg border border-mist-300 bg-white p-4 text-xs leading-5 whitespace-pre-wrap text-navy-700">
              {text}
            </pre>
          </aside>
        </div>
      </div>
    </div>
  );
}
