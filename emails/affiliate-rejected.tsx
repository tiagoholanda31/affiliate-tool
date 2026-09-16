import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, TEXT_STYLE } from "./layout";

export type AffiliateRejectedProps = {
  name: string;
  reason?: string;
  supportWhatsapp?: string;
};

export function AffiliateRejected({ name, reason, supportWhatsapp }: AffiliateRejectedProps) {
  return (
    <EmailLayout
      preview="Seu cadastro não foi aprovado"
      heading="Cadastro não aprovado"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {name}.</Text>
      <Text style={TEXT_STYLE}>
        Infelizmente não conseguimos aprovar seu cadastro no Programa de Afiliados desta vez.
      </Text>

      {reason ? <DetailRow label="Motivo" value={reason} /> : null}

      <Text style={TEXT_STYLE}>
        Você pode corrigir os dados e enviar o cadastro novamente pela sua conta. Se tiver dúvidas,
        fale com a gente pelo WhatsApp.
      </Text>
    </EmailLayout>
  );
}

export default AffiliateRejected;
