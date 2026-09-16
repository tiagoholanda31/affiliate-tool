/**
 * Digest diário: comissões liberadas hoje.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type CommissionsAvailableDigestProps = {
  affiliateName: string;
  releasedCount: number;
  releasedTotalLabel: string;
  nextPayoutLabel: string;
  panelUrl: string;
  supportWhatsapp?: string;
};

export function CommissionsAvailableDigest({
  affiliateName,
  releasedCount,
  releasedTotalLabel,
  nextPayoutLabel,
  panelUrl,
  supportWhatsapp,
}: CommissionsAvailableDigestProps) {
  return (
    <EmailLayout
      preview={`${releasedTotalLabel} liberados para pagamento`}
      heading="Comissões disponíveis"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {affiliateName}!</Text>
      <Text style={TEXT_STYLE}>
        {releasedCount === 1
          ? "1 comissão saiu da carência e já está disponível."
          : `${String(releasedCount)} comissões saíram da carência e já estão disponíveis.`}
      </Text>

      <DetailRow label="Liberado hoje" value={releasedTotalLabel} />
      <DetailRow label="Próximo pagamento previsto" value={nextPayoutLabel} />

      <Text style={MUTED_TEXT_STYLE}>
        O pagamento é feito manualmente pela equipe na data prevista (ou no próximo dia útil).
      </Text>

      <PrimaryButton href={panelUrl}>Ver extrato de comissões</PrimaryButton>
    </EmailLayout>
  );
}

export default CommissionsAvailableDigest;
