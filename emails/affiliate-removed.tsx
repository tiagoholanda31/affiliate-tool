import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, TEXT_STYLE } from "./layout";

export type AffiliateRemovedProps = {
  name: string;
  reason?: string;
  supportWhatsapp?: string;
};

export function AffiliateRemoved({ name, reason, supportWhatsapp }: AffiliateRemovedProps) {
  return (
    <EmailLayout
      preview="Sua conta de afiliado foi removida"
      heading="Conta removida"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {name}.</Text>
      <Text style={TEXT_STYLE}>
        Sua conta no Programa de Afiliados foi removida. Os dados pessoais serão anonimizados em
        até 30 dias, conforme nossa política de privacidade.
      </Text>

      {reason ? <DetailRow label="Motivo" value={reason} /> : null}

      <Text style={TEXT_STYLE}>
        Se acredita que houve um engano, entre em contato pelo WhatsApp.
      </Text>
    </EmailLayout>
  );
}

export default AffiliateRemoved;
