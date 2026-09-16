/**
 * Pedido estornado — admin.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type OrderRefundedAdminProps = {
  publicCode: string;
  productName: string;
  amountLabel: string;
  affiliateLabel: string;
  orderUrl: string;
};

export function OrderRefundedAdmin({
  publicCode,
  productName,
  amountLabel,
  affiliateLabel,
  orderUrl,
}: OrderRefundedAdminProps) {
  return (
    <EmailLayout preview={`Estorno — ${publicCode}`} heading="Venda estornada">
      <Text style={TEXT_STYLE}>Um pedido pago foi estornado ou sofreu chargeback.</Text>

      <DetailRow label="Pedido" value={publicCode} />
      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Valor" value={amountLabel} />
      <DetailRow label="Afiliado" value={affiliateLabel} />

      <PrimaryButton href={orderUrl}>Abrir pedido</PrimaryButton>
    </EmailLayout>
  );
}

export default OrderRefundedAdmin;
