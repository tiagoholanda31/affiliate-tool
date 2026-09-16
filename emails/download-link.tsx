/**
 * Link de download (reenvio) ou acesso ao pedido (recuperação sem ?t=).
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type DownloadLinkProps = {
  customerName: string;
  publicCode: string;
  productName: string;
  downloadUrl: string;
  expiresAtLabel: string;
  maxDownloads: number;
  orderUrl: string;
  /** Quando true, o CTA é o link do pedido (não o arquivo). */
  isOrderAccess?: boolean;
  supportWhatsapp?: string;
};

export function DownloadLink({
  customerName,
  publicCode,
  productName,
  downloadUrl,
  expiresAtLabel,
  maxDownloads,
  orderUrl,
  isOrderAccess,
  supportWhatsapp,
}: DownloadLinkProps) {
  if (isOrderAccess) {
    return (
      <EmailLayout
        preview={`Acesso ao pedido ${publicCode}`}
        heading="Seu link do pedido"
        supportWhatsapp={supportWhatsapp}
      >
        <Text style={TEXT_STYLE}>Olá, {customerName}!</Text>
        <Text style={TEXT_STYLE}>
          Segue o link para acompanhar o pedido <strong>{publicCode}</strong> (
          {productName}).
        </Text>
        <PrimaryButton href={downloadUrl}>Abrir pedido</PrimaryButton>
        <Text style={MUTED_TEXT_STYLE}>
          Se você não solicitou este e-mail, pode ignorá-lo com segurança.
        </Text>
      </EmailLayout>
    );
  }

  return (
    <EmailLayout
      preview={`Link de download — ${productName}`}
      heading="Seu link de download"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {customerName}!</Text>
      <Text style={TEXT_STYLE}>
        Geramos um novo link para baixar <strong>{productName}</strong> (pedido{" "}
        {publicCode}).
      </Text>

      <DetailRow label="Válido até" value={expiresAtLabel} />
      <DetailRow label="Downloads" value={`até ${String(maxDownloads)} vezes`} />

      <PrimaryButton href={downloadUrl}>Baixar arquivo</PrimaryButton>

      <Text style={MUTED_TEXT_STYLE}>
        O link anterior deixa de funcionar. Você também pode gerenciar o download em{" "}
        <a href={orderUrl} style={{ color: "#2f7f7a" }}>
          {orderUrl}
        </a>
        .
      </Text>
    </EmailLayout>
  );
}

export default DownloadLink;
