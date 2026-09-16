/**
 * Pedido estornado — afiliado (comissão revertida ou ajuste).
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type OrderRefundedAffiliateProps = {
  affiliateName: string;
  publicCode: string;
  productName: string;
  commissionLabel: string;
  supportWhatsapp?: string;
};

export function OrderRefundedAffiliate({
  affiliateName,
  publicCode,
  productName,
  commissionLabel,
  supportWhatsapp,
}: OrderRefundedAffiliateProps) {
  return (
    <EmailLayout
      preview={`Estorno — comissão ${commissionLabel}`}
      heading="Venda estornada"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {affiliateName}.</Text>
      <Text style={TEXT_STYLE}>
        A venda <strong>{publicCode}</strong> foi estornada. A comissão correspondente foi
        revertida do seu saldo (ou gerou um ajuste se já tivesse sido paga).
      </Text>

      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Comissão" value={commissionLabel} />

      <Text style={MUTED_TEXT_STYLE}>
        Isso protege o programa contra chargebacks. Em caso de dúvida, fale com o suporte.
      </Text>
    </EmailLayout>
  );
}

export default OrderRefundedAffiliate;
