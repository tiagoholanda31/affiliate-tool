/**
 * Pagamento de comissão confirmado — extrato do lote para o afiliado.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE, MUTED_TEXT_STYLE } from "./layout";

export type PayoutPaidLineItem = {
  label: string;
  amountLabel: string;
};

export type PayoutPaidProps = {
  affiliateName: string;
  totalLabel: string;
  paidAtLabel: string;
  referenceMonthLabel: string;
  proofReference: string | null;
  hasProofFile: boolean;
  lineItems: PayoutPaidLineItem[];
  panelUrl: string;
  supportWhatsapp?: string;
};

export function PayoutPaid({
  affiliateName,
  totalLabel,
  paidAtLabel,
  referenceMonthLabel,
  proofReference,
  hasProofFile,
  lineItems,
  panelUrl,
  supportWhatsapp,
}: PayoutPaidProps) {
  return (
    <EmailLayout
      preview={`Pagamento de comissão — ${totalLabel}`}
      heading="Seu pagamento foi enviado"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {affiliateName}!</Text>
      <Text style={TEXT_STYLE}>
        Registramos o pagamento das suas comissões referentes a {referenceMonthLabel}. O valor já
        foi transferido via Pix para a chave cadastrada.
      </Text>

      <DetailRow label="Valor total" value={totalLabel} />
      <DetailRow label="Data do pagamento" value={paidAtLabel} />
      {proofReference ? <DetailRow label="Referência Pix" value={proofReference} /> : null}
      {hasProofFile ? (
        <Text style={MUTED_TEXT_STYLE}>O comprovante está disponível no seu painel.</Text>
      ) : null}

      {lineItems.length > 0 ? (
        <>
          <Text style={{ ...TEXT_STYLE, marginTop: 24, fontWeight: 600 }}>Extrato do lote</Text>
          {lineItems.map((item) => (
            <DetailRow key={`${item.label}-${item.amountLabel}`} label={item.label} value={item.amountLabel} />
          ))}
        </>
      ) : null}

      <PrimaryButton href={panelUrl}>Ver extrato no painel</PrimaryButton>
    </EmailLayout>
  );
}

export default PayoutPaid;
