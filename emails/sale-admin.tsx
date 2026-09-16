/**
 * Nova venda paga — resumo para o admin.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type SaleAdminProps = {
  publicCode: string;
  productName: string;
  amountLabel: string;
  commissionLabel?: string;
  affiliateLabel: string;
  sourceLabel: string;
  orderUrl: string;
};

export function SaleAdmin({
  publicCode,
  productName,
  amountLabel,
  commissionLabel,
  affiliateLabel,
  sourceLabel,
  orderUrl,
}: SaleAdminProps) {
  return (
    <EmailLayout preview={`Venda paga — ${publicCode}`} heading="Venda paga">
      <Text style={TEXT_STYLE}>Uma venda acabou de ser confirmada na plataforma.</Text>

      <DetailRow label="Pedido" value={publicCode} />
      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Valor" value={amountLabel} />
      <DetailRow label="Origem" value={sourceLabel} />
      <DetailRow label="Afiliado" value={affiliateLabel} />
      {commissionLabel ? <DetailRow label="Comissão" value={commissionLabel} /> : null}

      <PrimaryButton href={orderUrl}>Abrir pedido</PrimaryButton>
    </EmailLayout>
  );
}

export default SaleAdmin;
