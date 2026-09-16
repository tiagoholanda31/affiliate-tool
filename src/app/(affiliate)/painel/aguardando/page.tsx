import { Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/data-display/status-badge";
import { DateText } from "@/components/data-display/date-text";
import { Button } from "@/components/ui/button";
import { AffiliateSummary } from "@/features/affiliates/components/affiliate-summary";
import { getAffiliateProfile } from "@/features/affiliates/queries";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { LABELS } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Cadastro em análise" };

/**
 * Tela do afiliado `PENDING`.
 *
 * Diz o que está acontecendo, quanto tempo costuma levar e mostra o que foi
 * enviado — quem espera sem saber o quê assume que deu errado e recadastra.
 */
export default async function PendingPage() {
  const session = await requireAffiliate(AFFILIATE_ROUTES.pending);
  const affiliate = await getAffiliateProfile(session.user.id);
  if (!affiliate) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Cadastro em análise"
        eyebrow={
          <StatusBadge
            label={LABELS.affiliateStatus.PENDING ?? "Em análise"}
            tone="warning"
            icon={Clock}
          />
        }
        description="Recebemos seus dados. Agora é com a nossa equipe."
      />

      <div className="space-y-6">
        <div className="rounded-lg bg-white p-6 shadow-card">
          <p className="text-sm leading-6 text-navy-700">
            Analisamos cada cadastro à mão para manter a qualidade do programa. Normalmente
            respondemos <strong>em até 2 dias úteis</strong>. Assim que houver uma decisão, avisamos
            no e-mail <strong className="break-all">{affiliate.user.email}</strong>.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Enviado <DateText date={affiliate.createdAt} format="relative" />.
            {affiliate.reviewCount > 0
              ? ` Esta é a ${String(affiliate.reviewCount + 1)}ª análise do seu cadastro.`
              : null}
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg text-navy-900">Dados enviados</h2>
            <Button asChild variant="outline" size="sm">
              <Link href={AFFILIATE_ROUTES.profile}>Editar dados</Link>
            </Button>
          </div>
          <AffiliateSummary affiliate={affiliate} />
        </section>
      </div>
    </div>
  );
}
