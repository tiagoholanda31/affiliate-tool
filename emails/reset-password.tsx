/** Redefinição de senha (docs/spec/07). Link de uso único, válido por 15 min. */
import { Text } from "@react-email/components";

import { EmailLayout, FallbackLink, PrimaryButton, TEXT_STYLE } from "./layout";

export type ResetPasswordProps = {
  name: string;
  url: string;
  expiresInMinutes: number;
  supportWhatsapp?: string;
};

export function ResetPassword({
  name,
  url,
  expiresInMinutes,
  supportWhatsapp,
}: ResetPasswordProps) {
  return (
    <EmailLayout
      preview="Link para redefinir sua senha"
      heading="Redefinir sua senha"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>
        Olá, {name.split(" ")[0] ?? name}. Recebemos um pedido para redefinir a senha da sua conta.
      </Text>

      <PrimaryButton href={url}>Criar uma nova senha</PrimaryButton>

      <Text style={TEXT_STYLE}>
        O link vale por {String(expiresInMinutes)} minutos e só pode ser usado uma vez.{" "}
        <strong>Se não foi você que pediu</strong>, ignore este e-mail: sua senha continua a mesma.
      </Text>

      <FallbackLink href={url} />
    </EmailLayout>
  );
}

export default ResetPassword;
