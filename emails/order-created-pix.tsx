/**
 * Pedido criado com Pix — QR / copia-e-cola + link de acompanhamento.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type OrderCreatedPixProps = {
  customerName: string;
  publicCode: string;
  productName: string;
  amountLabel: string;
  pixCopyPaste: string;
  expiresAtLabel: string;
  orderUrl: string;
  supportWhatsapp?: string;
};

export function OrderCreatedPix({
  customerName,
  publicCode,
  productName,
  amountLabel,
  pixCopyPaste,
  expiresAtLabel,
  orderUrl,
  supportWhatsapp,
}: OrderCreatedPixProps) {
  return (
    <EmailLayout
      preview={`Pix gerado — ${productName}`}
      heading="Quase lá — pague com Pix"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {customerName}!</Text>
      <Text style={TEXT_STYLE}>
        Seu pedido <strong>{publicCode}</strong> ({productName} — {amountLabel}) está aguardando o
        pagamento via Pix. O código expira em {expiresAtLabel}.
      </Text>

      <DetailRow label="Código Pix (copia e cola)" value={pixCopyPaste} />

      <PrimaryButton href={orderUrl}>Ver QR e acompanhar</PrimaryButton>

      <Text style={MUTED_TEXT_STYLE}>
        Depois de pagar, a confirmação costuma chegar em poucos segundos. Guarde este e-mail se
        precisar voltar à página do pedido.
      </Text>
    </EmailLayout>
  );
}

export default OrderCreatedPix;
