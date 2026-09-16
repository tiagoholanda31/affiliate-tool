/**
 * Layout base dos e-mails (docs/spec/07).
 *
 * Header navy com a marca em dourado, corpo branco, footer com endereço,
 * WhatsApp e a explicação de por que a pessoa recebeu a mensagem.
 *
 * Restrições de e-mail que valem para todos os templates: estilo **inline**
 * (nada de classe CSS), tabelas em vez de flex/grid, largura fixa de 600 px e
 * fonte com pilha de fallback — Poppins não existe na maioria dos clientes.
 */
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Espelha os tokens de `src/app/globals.css`; e-mail não lê CSS do app. */
export const COLORS = {
  navy900: "#00172d",
  navy700: "#163356",
  teal700: "#2f7f7a",
  gold500: "#e9be60",
  mist300: "#b8c6dd",
  mist100: "#f0f2f4",
  white: "#ffffff",
  danger: "#b42318",
} as const;

const FONT_STACK = "Poppins, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const TEXT_STYLE = {
  color: COLORS.navy700,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
} as const;

export const MUTED_TEXT_STYLE = {
  ...TEXT_STYLE,
  fontSize: "13px",
  lineHeight: "20px",
  color: COLORS.navy700,
} as const;

export type EmailLayoutProps = {
  /** Texto da prévia (a linha cinza ao lado do assunto na caixa de entrada). */
  preview: string;
  heading: string;
  children: ReactNode;
  /** WhatsApp de suporte em E.164; some do rodapé quando não configurado. */
  supportWhatsapp?: string;
};

export function EmailLayout({ preview, heading, children, supportWhatsapp }: EmailLayoutProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: COLORS.mist100, margin: 0, padding: "24px 0" }}>
        <Container style={{ width: "100%", maxWidth: "600px", margin: "0 auto" }}>
          <Section
            style={{
              backgroundColor: COLORS.navy900,
              padding: "24px",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <Text
              style={{
                margin: 0,
                color: COLORS.gold500,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "20px",
                letterSpacing: "0.04em",
              }}
            >
              Affiliate Tool
            </Text>
            <Text
              style={{
                margin: "4px 0 0",
                color: COLORS.mist300,
                fontFamily: FONT_STACK,
                fontSize: "12px",
              }}
            >
              Programa de Afiliados
            </Text>
          </Section>

          <Section
            style={{
              backgroundColor: COLORS.white,
              padding: "32px 24px",
              fontFamily: FONT_STACK,
            }}
          >
            <Heading
              as="h1"
              style={{
                margin: "0 0 20px",
                color: COLORS.navy900,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "24px",
                lineHeight: "32px",
                fontWeight: 600,
              }}
            >
              {heading}
            </Heading>
            {children}
          </Section>

          <Section
            style={{
              backgroundColor: COLORS.white,
              padding: "0 24px 28px",
              borderRadius: "0 0 12px 12px",
              fontFamily: FONT_STACK,
            }}
          >
            <Hr style={{ borderColor: COLORS.mist300, margin: "0 0 16px" }} />
            <Text style={{ ...MUTED_TEXT_STYLE, margin: "0 0 6px" }}>
              Affiliate Tool · Your Company Address
            </Text>
            {supportWhatsapp ? (
              <Text style={{ ...MUTED_TEXT_STYLE, margin: "0 0 6px" }}>
                Dúvidas? Fale com a gente no WhatsApp {supportWhatsapp}.
              </Text>
            ) : null}
            <Text style={{ ...MUTED_TEXT_STYLE, margin: 0 }}>
              Você recebeu este e-mail porque tem um cadastro no Programa de Afiliados do Affiliate
              Tool. Se não foi você, ignore esta mensagem.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Botão principal. `Button` do React Email já cuida do fallback em Outlook. */
export function PrimaryButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table cellPadding={0} cellSpacing={0} style={{ margin: "0 0 20px" }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: COLORS.navy900,
              borderRadius: "8px",
              padding: "12px 24px",
            }}
          >
            <Link
              href={href}
              style={{
                color: COLORS.white,
                fontFamily: FONT_STACK,
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * O mesmo link em texto, logo abaixo do botão.
 *
 * Vários clientes de e-mail corporativos removem botões; sem esta linha, quem
 * mais precisa do link é justamente quem não consegue clicar.
 */
export function FallbackLink({ href }: { href: string }) {
  return (
    <Text style={{ ...MUTED_TEXT_STYLE, wordBreak: "break-all" }}>
      Se o botão não funcionar, copie e cole este endereço no navegador:
      <br />
      <Link href={href} style={{ color: COLORS.teal700 }}>
        {href}
      </Link>
    </Text>
  );
}

/** Linha rótulo/valor usada nos resumos (dados do cadastro, alertas). */
export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Text style={{ ...TEXT_STYLE, margin: "0 0 8px" }}>
      <span style={{ color: COLORS.navy900, fontWeight: 600 }}>{label}: </span>
      {value}
    </Text>
  );
}
