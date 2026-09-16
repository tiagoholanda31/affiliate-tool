/**
 * Pagamento confirmado — recibo resumido para o comprador.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type OrderPaidProps = {
  customerName: string;
  publicCode: string;
  productName: string;
  amountLabel: string;
  orderUrl: string;
  /** Só para SERVICE — nota de entrega. */
  deliveryNote?: string;
  /** Produto DIGITAL. */
  isDigital?: boolean;
  /** Link `/download/<token>` quando o grant já foi criado. */
  downloadUrl?: string;
  expiresAtLabel?: string;
  maxDownloads?: number;
  supportWhatsapp?: string;
};

export function OrderPaid({
  customerName,
  publicCode,
  productName,
  amountLabel,
  orderUrl,
  deliveryNote,
  isDigital,
  downloadUrl,
  expiresAtLabel,
  maxDownloads,
  supportWhatsapp,
}: OrderPaidProps) {
  return (
    <EmailLayout
      preview={`Pagamento confirmado — ${productName}`}
      heading="Pagamento confirmado"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {customerName}!</Text>
      <Text style={TEXT_STYLE}>
        Recebemos o pagamento do pedido <strong>{publicCode}</strong>. Obrigado!
      </Text>

      <DetailRow label="Produto" value={productName} />
      <DetailRow label="Valor" value={amountLabel} />

      {deliveryNote ? (
        <Text style={TEXT_STYLE}>
          <strong>Próximos passos:</strong> {deliveryNote}
        </Text>
      ) : null}

      {isDigital && downloadUrl ? (
        <>
          {expiresAtLabel ? (
            <DetailRow label="Download válido até" value={expiresAtLabel} />
          ) : null}
          {maxDownloads ? (
            <DetailRow label="Downloads" value={`até ${String(maxDownloads)} vezes`} />
          ) : null}
          <PrimaryButton href={downloadUrl}>Baixar livro</PrimaryButton>
          <Text style={MUTED_TEXT_STYLE}>
            Guarde este e-mail. Você também pode baixar pela página do pedido.
          </Text>
        </>
      ) : null}

      {isDigital && !downloadUrl ? (
        <Text style={MUTED_TEXT_STYLE}>
          O link de download estará disponível na página do pedido em breve.
        </Text>
      ) : null}

      <PrimaryButton href={orderUrl}>Ver recibo do pedido</PrimaryButton>
    </EmailLayout>
  );
}

export default OrderPaid;
