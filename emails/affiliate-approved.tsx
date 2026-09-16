import { Text } from "@react-email/components";

import { DetailRow, EmailLayout, FallbackLink, PrimaryButton, TEXT_STYLE } from "./layout";

export type AffiliateApprovedProps = {
  name: string;
  code?: string;
  firstLink?: string;
  supportWhatsapp?: string;
};

export function AffiliateApproved({ name, code, firstLink, supportWhatsapp }: AffiliateApprovedProps) {
  return (
    <EmailLayout
      preview="Seu cadastro foi aprovado — bem-vindo ao Programa de Afiliados"
      heading="Cadastro aprovado"
      supportWhatsapp={supportWhatsapp}
    >
      <Text style={TEXT_STYLE}>Olá, {name}.</Text>
      <Text style={TEXT_STYLE}>
        Seu cadastro no Programa de Afiliados do Affiliate Tool foi aprovado. Agora você pode
        divulgar seus links e acompanhar suas comissões.
      </Text>

      {code ? <DetailRow label="Seu código" value={code} /> : null}

      {firstLink ? (
        <>
          <PrimaryButton href={firstLink}>Acessar meu link de afiliado</PrimaryButton>
          <FallbackLink href={firstLink} />
        </>
      ) : null}

      <Text style={TEXT_STYLE}>
        Você recebe comissão toda vez que alguém compra através do seu link. As comissões ficam
        disponíveis para pagamento após o prazo de carência do programa.
      </Text>
    </EmailLayout>
  );
}

export default AffiliateApproved;
