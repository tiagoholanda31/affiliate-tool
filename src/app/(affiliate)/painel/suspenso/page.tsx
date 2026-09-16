import { Ban } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DateText } from "@/components/data-display/date-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getAffiliateProfile } from "@/features/affiliates/queries";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { LABELS } from "@/lib/i18n/pt-BR";
import { formatSupportWhatsapp, getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Conta suspensa" };

/**
 * Tela do afiliado `SUSPENDED`.
 *
 * Explica o que a suspensão significa na prática — o que ainda vale e o que
 * parou —, porque a dúvida real de quem é suspenso é sobre o dinheiro já
 * apurado (docs/spec/01, seção 1).
 */
export default async function SuspendedPage() {
  const session = await requireAffiliate(AFFILIATE_ROUTES.suspended);
  const affiliate = await getAffiliateProfile(session.user.id);
  if (!affiliate) notFound();

  const settings = await getSettings();
  const whatsapp = formatSupportWhatsapp(settings.supportWhatsapp);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Conta suspensa"
        eyebrow={
          <StatusBadge
            label={LABELS.affiliateStatus.SUSPENDED ?? "Suspenso"}
            tone="neutral"
            icon={Ban}
          />
        }
        description="Sua participação no programa está pausada."
      />

      <div className="space-y-6">
        <div className="rounded-lg border border-mist-300 bg-white p-4 shadow-card">
          <h2 className="text-sm font-semibold text-navy-900">Motivo da suspensão</h2>
          <p className="mt-1 text-sm text-navy-700">
            {affiliate.statusReason ?? "Nenhum motivo foi registrado. Fale com o suporte."}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Desde <DateText date={affiliate.statusChangedAt} format="datetime" />.
          </p>
        </div>

        <div className="space-y-3 rounded-lg bg-white p-6 shadow-card">
          <h2 className="font-display text-lg text-navy-900">O que isso significa</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-navy-700">
            <li>
              As comissões que você já tinha <strong>continuam válidas</strong> e seguem o fluxo
              normal de liberação e pagamento.
            </li>
            <li>
              Seus links continuam abrindo as páginas, mas <strong>não geram</strong> novos cliques
              nem novas comissões enquanto a suspensão durar.
            </li>
            <li>Você continua podendo entrar para acompanhar seu extrato e atualizar seus dados.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-mist-300 bg-mist-100 p-4">
          <p className="text-sm text-navy-700">
            Acha que houve engano? Fale com o suporte
            {whatsapp ? ` pelo WhatsApp ${whatsapp}` : ""}.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link href={AFFILIATE_ROUTES.profile}>Ver meus dados</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
