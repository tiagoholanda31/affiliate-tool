/**
 * Aviso ao admin de que há um cadastro novo para analisar (docs/spec/07).
 * Disparado quando o afiliado **confirma o e-mail**, não no envio do formulário:
 * cadastro sem e-mail confirmado não vale análise.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type AffiliatePendingAdminProps = {
  affiliateName: string;
  affiliateEmailMasked: string;
  socialNetwork: string;
  socialHandle: string;
  reviewUrl: string;
  /** > 0 quando é reenvio de um cadastro que havia sido reprovado. */
  reviewCount: number;
};

export function AffiliatePendingAdmin({
  affiliateName,
  affiliateEmailMasked,
  socialNetwork,
  socialHandle,
  reviewUrl,
  reviewCount,
}: AffiliatePendingAdminProps) {
  const isResubmission = reviewCount > 0;

  return (
    <EmailLayout
      preview={`${affiliateName} está aguardando análise`}
      heading={isResubmission ? "Cadastro reenviado para análise" : "Novo cadastro de afiliado"}
    >
      <Text style={TEXT_STYLE}>
        {isResubmission
          ? `${affiliateName} corrigiu o cadastro e enviou de novo (${String(reviewCount)}ª revisão).`
          : `${affiliateName} confirmou o e-mail e está na fila de análise.`}
      </Text>

      <DetailRow label="Nome" value={affiliateName} />
      <DetailRow label="E-mail" value={affiliateEmailMasked} />
      <DetailRow label="Rede social" value={`${socialNetwork} · @${socialHandle}`} />

      <PrimaryButton href={reviewUrl}>Analisar cadastro</PrimaryButton>
    </EmailLayout>
  );
}

export default AffiliatePendingAdmin;
