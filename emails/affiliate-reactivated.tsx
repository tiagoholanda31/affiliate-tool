import { Text } from "@react-email/components";

import { EmailLayout, TEXT_STYLE } from "./layout";

export type AffiliateReactivatedProps = {
  name: string;
  supportWhatsapp?: string;
};

export function AffiliateReactivated({ name, supportWhatsapp }: AffiliateReactivatedProps) {
  return (
    <EmailLayout
      preview="Sua conta de afiliado foi reativada"
      heading="Conta reativada"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {name}.</Text>
      <Text style={TEXT_STYLE}>
        Sua conta no Programa de Afiliados foi reativada. Seus links voltam a gerar comissões e você
        já pode acessar o painel normalmente.
      </Text>
      <Text style={TEXT_STYLE}>
        Se precisar de ajuda, fale com a gente pelo WhatsApp.
      </Text>
    </EmailLayout>
  );
}

export default AffiliateReactivated;
