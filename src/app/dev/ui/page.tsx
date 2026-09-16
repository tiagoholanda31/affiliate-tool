import { notFound } from "next/navigation";

import { UiCatalog } from "@/app/dev/ui/ui-catalog";
import { isDevelopment } from "@/lib/env";

export const metadata = { title: "Componentes" };

/**
 * Prerenderizada, esta rota devolveria o HTML do 404 com status **200** — o
 * `notFound()` teria sido avaliado no build. Forçando o render em runtime, o
 * status HTTP fica correto.
 */
export const dynamic = "force-dynamic";

/**
 * Catálogo dos componentes base — "storybook" leve.
 *
 * Existe apenas em desenvolvimento: em produção a rota responde 404, para não
 * expor uma página interna no domínio público.
 */
export default function DevUiPage() {
  if (!isDevelopment) notFound();

  // As datas são calculadas no servidor e serializadas, como nas telas reais —
  // gerar `new Date()` dentro do componente cliente quebraria a hidratação.
  const agora = new Date();
  const ontem = new Date(agora.getTime() - 26 * 60 * 60 * 1000);

  return <UiCatalog agora={agora} ontem={ontem} />;
}
