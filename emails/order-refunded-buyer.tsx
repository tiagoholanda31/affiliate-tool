/**
 * Pedido estornado — comprador.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type OrderRefundedBuyerProps = {
  customerName: string;
  publicCode: string;
  productName: string;
  amountLabel: string;
  supportWhatsapp?: string;
};

export function OrderRefundedBuyer({
  customerName,
  publicCode,
  productName,
  amountLabel,
  supportWhatsapp,
}: OrderRefundedBuyerProps) {
  return (
    <EmailLayout
      preview={`Estorno do pedido ${publicCode}`}
      heading="Pagamento estornado"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {customerName}.</Text>
      <Text style={TEXT_STYLE}>
        O pagamento do pedido <strong>{publicCode}</strong> foi estornado. O valor volta conforme as
        regras do meio de pagamento (Pix ou cartão).
      </Text>

      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Valor" value={amountLabel} />

      <Text style={MUTED_TEXT_STYLE}>
        Se você não solicitou o estorno ou tiver dúvidas, fale conosco pelo WhatsApp de suporte.
      </Text>
    </EmailLayout>
  );
}

export default OrderRefundedBuyer;
