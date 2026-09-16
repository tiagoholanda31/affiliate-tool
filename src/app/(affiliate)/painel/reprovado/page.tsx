import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ResubmitForm } from "./resubmit-form";
import { DateText } from "@/components/data-display/date-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { getAffiliateProfile } from "@/features/affiliates/queries";
import { AFFILIATE_ROUTES } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { LABELS } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Cadastro reprovado" };

/**
 * Tela do afiliado `REJECTED`.
 *
 * Mostra o motivo e, logo abaixo, o formulário de correção — reprovação sem
 * caminho de volta faz a pessoa criar outra conta com outro e-mail.
 */
export default async function RejectedPage() {
  const session = await requireAffiliate(AFFILIATE_ROUTES.rejected);
  const affiliate = await getAffiliateProfile(session.user.id);
  if (!affiliate) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Cadastro reprovado"
        eyebrow={
          <StatusBadge
            label={LABELS.affiliateStatus.REJECTED ?? "Reprovado"}
            tone="danger"
          />
        }
        description="Você pode corrigir os dados e enviar de novo."
      />

      <div className="space-y-6">
        <div className="rounded-lg border border-[color:var(--color-danger)]/25 bg-[color:var(--color-danger-bg)] p-4">
          <h2 className="text-sm font-semibold text-[color:var(--color-danger)]">
            Motivo da reprovação
          </h2>
          <p className="mt-1 text-sm text-navy-900">
            {affiliate.statusReason ?? "Nenhum motivo foi registrado. Fale com o suporte."}
          </p>
          <p className="mt-2 text-xs text-navy-700">
            Decidido em <DateText date={affiliate.statusChangedAt} format="datetime" />.
          </p>
        </div>

        <section className="space-y-3 rounded-lg bg-white p-6 shadow-card">
          <div className="space-y-1">
            <h2 className="font-display text-lg text-navy-900">Corrigir e reenviar</h2>
            <p className="text-sm text-muted-foreground">
              Ajuste o que for necessário. Ao enviar, seu cadastro volta para a fila de análise.
            </p>
          </div>

          <ResubmitForm
            defaults={{
              name: affiliate.user.name,
              phone: affiliate.phone.replace(/^\+55/, ""),
              socialNetwork: affiliate.socialNetwork,
              socialHandle: affiliate.socialHandle,
            }}
          />
        </section>
      </div>
    </div>
  );
}
