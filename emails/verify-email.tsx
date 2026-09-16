/** Confirmação de e-mail do cadastro (docs/spec/07). Link válido por 24 h. */
import { Text } from "@react-email/components";

import { EmailLayout, FallbackLink, PrimaryButton, TEXT_STYLE } from "./layout";

export type VerifyEmailProps = {
  name: string;
  url: string;
  expiresInHours: number;
  supportWhatsapp?: string;
};

export function VerifyEmail({ name, url, expiresInHours, supportWhatsapp }: VerifyEmailProps) {
  return (
    <EmailLayout
      preview="Confirme seu e-mail para concluir o cadastro de afiliado"
      heading={`Falta pouco, ${name.split(" ")[0] ?? name}`}
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>
        Confirme seu e-mail para concluir o cadastro no Programa de Afiliados do Affiliate Tool.
      </Text>

      <PrimaryButton href={url}>Confirmar meu e-mail</PrimaryButton>

      <Text style={TEXT_STYLE}>
        O link vale por {String(expiresInHours)} horas. Depois de confirmar, nossa equipe analisa seu
        cadastro — normalmente em até 2 dias úteis — e você recebe um aviso por e-mail.
      </Text>

      <FallbackLink href={url} />
    </EmailLayout>
  );
}

export default VerifyEmail;
