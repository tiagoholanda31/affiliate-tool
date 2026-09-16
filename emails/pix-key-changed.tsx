/**
 * Aviso de segurança: a chave Pix do afiliado mudou (docs/spec/07).
 *
 * É a chave que decide para onde o dinheiro vai, então o afiliado precisa saber
 * da troca mesmo tendo sido ele a fazê-la — e precisa saber **na hora** se não foi.
 * Por isso a chave aparece mascarada: o e-mail confirma a mudança sem entregar
 * a chave a quem tenha acesso à caixa de entrada.
 */
import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, PrimaryButton, TEXT_STYLE } from "./layout";

export type PixKeyChangedProps = {
  name: string;
  pixKeyTypeLabel: string;
  pixKeyMasked: string;
  changedAt: string;
  profileUrl: string;
  supportWhatsapp?: string;
};

export function PixKeyChanged({
  name,
  pixKeyTypeLabel,
  pixKeyMasked,
  changedAt,
  profileUrl,
  supportWhatsapp,
}: PixKeyChangedProps) {
  return (
    <EmailLayout
      preview="Sua chave Pix foi alterada"
      heading="Sua chave Pix foi alterada"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>
        Olá, {name.split(" ")[0] ?? name}. A chave Pix cadastrada para receber suas comissões foi
        alterada. Os próximos pagamentos vão para a chave abaixo.
      </Text>

      <DetailRow label="Tipo" value={pixKeyTypeLabel} />
      <DetailRow label="Chave" value={pixKeyMasked} />
      <DetailRow label="Alterada em" value={changedAt} />

      <Text style={TEXT_STYLE}>
        <strong>Não foi você?</strong> Entre agora, troque sua senha e fale com a gente.
      </Text>

      <PrimaryButton href={profileUrl}>Ver meu perfil</PrimaryButton>
    </EmailLayout>
  );
}

export default PixKeyChanged;
