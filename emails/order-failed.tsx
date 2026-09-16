/**
 * Pagamento falhou — motivo amigável + CTA para tentar de novo.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type OrderFailedProps = {
  customerName: string;
  publicCode: string;
  productName: string;
  reason: string;
  retryUrl: string;
  supportWhatsapp?: string;
};

export function OrderFailed({
  customerName,
  publicCode,
  productName,
  reason,
  retryUrl,
  supportWhatsapp,
}: OrderFailedProps) {
  return (
    <EmailLayout
      preview={`Pagamento não concluído — ${productName}`}
      heading="Não foi possível concluir o pagamento"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {customerName}!</Text>
      <Text style={TEXT_STYLE}>
        O pagamento do pedido <strong>{publicCode}</strong> ({productName}) não foi aprovado.
      </Text>

      <DetailRow label="Motivo" value={reason} />

      <PrimaryButton href={retryUrl}>Tentar novamente</PrimaryButton>
    </EmailLayout>
  );
}

export default OrderFailed;
