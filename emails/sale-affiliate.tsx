/**
 * Nova venda atribuída — e-mail para o afiliado.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type SaleAffiliateProps = {
  affiliateName: string;
  productName: string;
  amountLabel: string;
  commissionLabel: string;
  availableAtLabel: string;
  publicCode: string;
  panelUrl: string;
  supportWhatsapp?: string;
};

export function SaleAffiliate({
  affiliateName,
  productName,
  amountLabel,
  commissionLabel,
  availableAtLabel,
  publicCode,
  panelUrl,
  supportWhatsapp,
}: SaleAffiliateProps) {
  return (
    <EmailLayout
      preview={`Nova venda — comissão ${commissionLabel}`}
      heading="Você fez uma venda!"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {affiliateName}!</Text>
      <Text style={TEXT_STYLE}>
        Uma compra pelo seu link acabou de ser confirmada. Sua comissão entra no saldo pendente e
        fica disponível após a carência do programa.
      </Text>

      <DetailRow label="Pedido" value={publicCode} />
      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Valor da venda" value={amountLabel} />
      <DetailRow label="Sua comissão" value={commissionLabel} />
      <DetailRow label="Libera em" value={availableAtLabel} />

      <Text style={MUTED_TEXT_STYLE}>
        A carência protege contra estornos. Quando a data chegar, a comissão passa para
        &quot;Disponível&quot; automaticamente.
      </Text>

      <PrimaryButton href={panelUrl}>Ver minhas vendas</PrimaryButton>
    </EmailLayout>
  );
}

export default SaleAffiliate;
