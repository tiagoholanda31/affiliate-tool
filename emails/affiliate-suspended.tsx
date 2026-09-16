import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, TEXT_STYLE } from "./layout";

export type AffiliateSuspendedProps = {
  name: string;
  reason?: string;
  supportWhatsapp?: string;
};

export function AffiliateSuspended({ name, reason, supportWhatsapp }: AffiliateSuspendedProps) {
  return (
    <EmailLayout
      preview="Sua conta de afiliado foi suspensa"
      heading="Conta suspensa"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {name}.</Text>
      <Text style={TEXT_STYLE}>
        Sua conta no Programa de Afiliados foi suspensa temporariamente. Enquanto isso, seus links
        antigos continuam funcionando, mas não geram novas atribuições.
      </Text>

      {reason ? <DetailRow label="Motivo" value={reason} /> : null}

      <Text style={TEXT_STYLE}>
        Entre em contato pelo WhatsApp se precisar de mais informações sobre o caso.
      </Text>
    </EmailLayout>
  );
}

export default AffiliateSuspended;
