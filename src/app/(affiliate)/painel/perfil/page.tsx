import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PasswordForm, PixKeyForm, ProfileDataForm } from "./profile-forms";
import { DateText } from "@/components/data-display/date-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { PageHeader } from "@/components/layout/page-header";
import { getAffiliateProfile } from "@/features/affiliates/queries";
import { AFFILIATE_ROUTES, toneForAffiliateStatus } from "@/features/affiliates/service";
import { requireAffiliate } from "@/lib/auth";
import { LABELS } from "@/lib/i18n/pt-BR";

export const metadata: Metadata = { title: "Meu perfil" };

/**
 * Perfil do afiliado.
 *
 * Acessível em qualquer status que ainda logue (`resolveAffiliateAccess`): quem
 * está em análise precisa corrigir dados, quem foi suspenso precisa conferir
 * para onde o que já foi apurado será pago.
 */
export default async function ProfilePage() {
  const session = await requireAffiliate(AFFILIATE_ROUTES.profile);
  const affiliate = await getAffiliateProfile(session.user.id);
  if (!affiliate) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Meu perfil"
        eyebrow={
          <StatusBadge
            label={LABELS.affiliateStatus[affiliate.status] ?? affiliate.status}
            tone={toneForAffiliateStatus(affiliate.status)}
          />
        }
        description="Seus dados de contato, chave Pix e senha."
      />

      <div className="space-y-6">
        <ProfileDataForm
          defaults={{
            name: affiliate.user.name,
            // O banco guarda E.164; o campo trabalha só com os dígitos locais.
            phone: affiliate.phone.replace(/^\+55/, ""),
            socialNetwork: affiliate.socialNetwork,
            socialHandle: affiliate.socialHandle,
          }}
        />

        <PixKeyForm currentType={affiliate.pixKeyType} currentMasked={affiliate.pixKeyMasked} />

        <PasswordForm />

        <section className="rounded-lg border border-mist-300 bg-mist-100 p-4 text-sm text-muted-foreground">
          <p>
            <span className="text-navy-900">E-mail da conta:</span>{" "}
            <span className="break-all">{affiliate.user.email}</span> — para trocar, fale com o
            suporte.
          </p>
          <p className="mt-1.5">
            Termos {affiliate.termsVersion} aceitos em{" "}
            <DateText date={affiliate.termsAcceptedAt} format="datetime" />.
          </p>
        </section>
      </div>
    </div>
  );
}
