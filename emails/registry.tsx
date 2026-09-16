/**
 * Catálogo de templates de e-mail.
 *
 * Um lugar só define, para cada template: as props que ele aceita, o assunto, o
 * componente e um exemplo de dados. O exemplo alimenta `/dev/emails`, então todo
 * template nasce com pré-visualização — sem passo extra e sem template que só
 * quebra em produção.
 *
 * `priority` decide quem sai quando o limite diário do provedor aperta
 * (docs/spec/07): `transactional` é o que a pessoa está esperando naquele
 * instante (link de confirmação, reset, aviso de segurança) e sempre sai;
 * `operational` é aviso interno e pode esperar o dia seguinte.
 */
import type { ReactElement } from "react";

import { AdminAlert, type AdminAlertProps } from "./admin-alert";
import { AffiliateApproved, type AffiliateApprovedProps } from "./affiliate-approved";
import { AffiliatePendingAdmin, type AffiliatePendingAdminProps } from "./affiliate-pending-admin";
import { AffiliateReactivated, type AffiliateReactivatedProps } from "./affiliate-reactivated";
import { AffiliateRejected, type AffiliateRejectedProps } from "./affiliate-rejected";
import { AffiliateRemoved, type AffiliateRemovedProps } from "./affiliate-removed";
import { AffiliateSuspended, type AffiliateSuspendedProps } from "./affiliate-suspended";
import {
  CommissionsAvailableDigest,
  type CommissionsAvailableDigestProps,
} from "./commissions-available-digest";
import { DownloadLink, type DownloadLinkProps } from "./download-link";
import { OrderCreatedPix, type OrderCreatedPixProps } from "./order-created-pix";
import { OrderFailed, type OrderFailedProps } from "./order-failed";
import { OrderPaid, type OrderPaidProps } from "./order-paid";
import {
  OrderRefundedAdmin,
  type OrderRefundedAdminProps,
} from "./order-refunded-admin";
import {
  OrderRefundedAffiliate,
  type OrderRefundedAffiliateProps,
} from "./order-refunded-affiliate";
import {
  OrderRefundedBuyer,
  type OrderRefundedBuyerProps,
} from "./order-refunded-buyer";
import { PixKeyChanged, type PixKeyChangedProps } from "./pix-key-changed";
import { PayoutPaid, type PayoutPaidProps } from "./payout-paid";
import { ResetPassword, type ResetPasswordProps } from "./reset-password";
import { SaleAdmin, type SaleAdminProps } from "./sale-admin";
import { SaleAffiliate, type SaleAffiliateProps } from "./sale-affiliate";
import { VerifyEmail, type VerifyEmailProps } from "./verify-email";

export type EmailTemplateProps = {
  "verify-email": VerifyEmailProps;
  "reset-password": ResetPasswordProps;
  "affiliate-pending-admin": AffiliatePendingAdminProps;
  "affiliate-approved": AffiliateApprovedProps;
  "affiliate-rejected": AffiliateRejectedProps;
  "affiliate-suspended": AffiliateSuspendedProps;
  "affiliate-reactivated": AffiliateReactivatedProps;
  "affiliate-removed": AffiliateRemovedProps;
  "pix-key-changed": PixKeyChangedProps;
  "admin-alert": AdminAlertProps;
  "order-created-pix": OrderCreatedPixProps;
  "order-paid": OrderPaidProps;
  "order-failed": OrderFailedProps;
  "download-link": DownloadLinkProps;
  "sale-affiliate": SaleAffiliateProps;
  "sale-admin": SaleAdminProps;
  "order-refunded-buyer": OrderRefundedBuyerProps;
  "order-refunded-affiliate": OrderRefundedAffiliateProps;
  "order-refunded-admin": OrderRefundedAdminProps;
  "commissions-available-digest": CommissionsAvailableDigestProps;
  "payout-paid": PayoutPaidProps;
};

export type EmailTemplateName = keyof EmailTemplateProps;

export type EmailPriority = "transactional" | "operational";

type TemplateDefinition<Name extends EmailTemplateName> = {
  /** Rótulo em pt-BR para a lista de `/dev/emails`. */
  label: string;
  priority: EmailPriority;
  subject: (props: EmailTemplateProps[Name]) => string;
  render: (props: EmailTemplateProps[Name]) => ReactElement;
  /** Dados de exemplo — nunca de gente real. */
  preview: EmailTemplateProps[Name];
};

type Registry = { [Name in EmailTemplateName]: TemplateDefinition<Name> };

const PREVIEW_URL = "https://affiliates.example.com";

export const EMAIL_TEMPLATES: Registry = {
  "verify-email": {
    label: "Confirmação de e-mail",
    priority: "transactional",
    subject: () => "Confirme seu e-mail — Programa de Afiliados",
    render: (props) => <VerifyEmail {...props} />,
    preview: {
      name: "Maria Souza",
      url: `${PREVIEW_URL}/verificar-email?token=exemplo-de-token`,
      expiresInHours: 24,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "reset-password": {
    label: "Redefinir senha",
    priority: "transactional",
    subject: () => "Redefinir sua senha — Affiliate Tool",
    render: (props) => <ResetPassword {...props} />,
    preview: {
      name: "Maria Souza",
      url: `${PREVIEW_URL}/redefinir-senha?token=exemplo-de-token`,
      expiresInMinutes: 15,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "affiliate-pending-admin": {
    label: "Novo cadastro para analisar (admin)",
    priority: "operational",
    subject: (props) => `Novo cadastro de afiliado: ${props.affiliateName}`,
    render: (props) => <AffiliatePendingAdmin {...props} />,
    preview: {
      affiliateName: "Maria Souza",
      affiliateEmailMasked: "ma***@exemplo.com",
      socialNetwork: "Instagram",
      socialHandle: "maria.afiliada",
      reviewUrl: `${PREVIEW_URL}/admin/afiliados`,
      reviewCount: 0,
    },
  },

  "affiliate-approved": {
    label: "Cadastro aprovado (afiliado)",
    priority: "transactional",
    subject: () => "Seu cadastro foi aprovado — Affiliate Tool",
    render: (props) => <AffiliateApproved {...props} />,
    preview: {
      name: "Maria Souza",
      code: "x8k2p9m",
      firstLink: `${PREVIEW_URL}/r/x8k2p9m`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "affiliate-rejected": {
    label: "Cadastro não aprovado (afiliado)",
    priority: "transactional",
    subject: () => "Seu cadastro não foi aprovado — Affiliate Tool",
    render: (props) => <AffiliateRejected {...props} />,
    preview: {
      name: "Maria Souza",
      reason: "O @informado não é público ou não condiz com o perfil indicado.",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "affiliate-suspended": {
    label: "Conta suspensa (afiliado)",
    priority: "transactional",
    subject: () => "Sua conta de afiliado foi suspensa — Affiliate Tool",
    render: (props) => <AffiliateSuspended {...props} />,
    preview: {
      name: "Maria Souza",
      reason: "Compras com indícios de fraude detectadas em links recentes.",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "affiliate-reactivated": {
    label: "Conta reativada (afiliado)",
    priority: "transactional",
    subject: () => "Sua conta de afiliado foi reativada — Affiliate Tool",
    render: (props) => <AffiliateReactivated {...props} />,
    preview: {
      name: "Maria Souza",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "affiliate-removed": {
    label: "Conta removida (afiliado)",
    priority: "transactional",
    subject: () => "Sua conta de afiliado foi removida — Affiliate Tool",
    render: (props) => <AffiliateRemoved {...props} />,
    preview: {
      name: "Maria Souza",
      reason: "Solicitação de exclusão de dados.",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "pix-key-changed": {
    label: "Chave Pix alterada",
    priority: "transactional",
    subject: () => "Sua chave Pix foi alterada",
    render: (props) => <PixKeyChanged {...props} />,
    preview: {
      name: "Maria Souza",
      pixKeyTypeLabel: "CPF",
      pixKeyMasked: "***.456.789-**",
      changedAt: "05/09/2026 às 14:32",
      profileUrl: `${PREVIEW_URL}/painel/perfil`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "admin-alert": {
    label: "Alerta operacional (admin)",
    priority: "operational",
    subject: (props) => `[Afiliados] ${props.title}`,
    render: (props) => <AdminAlert {...props} />,
    preview: {
      title: "Novo login de administrador",
      message: "Um acesso administrativo acabou de ser feito na plataforma.",
      details: [
        { label: "Conta", value: "ad***@example.com" },
        { label: "IP", value: "187.12.34.56" },
        { label: "Navegador", value: "Chrome 141 · Windows" },
        { label: "Quando", value: "05/09/2026 às 14:32" },
      ],
      actionUrl: `${PREVIEW_URL}/admin/sistema`,
      actionLabel: "Ver auditoria",
    },
  },

  "order-created-pix": {
    label: "Pix gerado (comprador)",
    priority: "transactional",
    subject: (props) => `Pix gerado — ${props.productName}`,
    render: (props) => <OrderCreatedPix {...props} />,
    preview: {
      customerName: "Ana Costa",
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      amountLabel: "R$ 350,00",
      pixCopyPaste: "00020126...6304ABCD",
      expiresAtLabel: "05/09/2026 às 15:02",
      orderUrl: `${PREVIEW_URL}/pedido/IF-AB12CD?t=exemplo`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "order-paid": {
    label: "Pagamento confirmado (comprador)",
    priority: "transactional",
    subject: (props) => `Pagamento confirmado — ${props.productName}`,
    render: (props) => <OrderPaid {...props} />,
    preview: {
      customerName: "Ana Costa",
      publicCode: "IF-AB12CD",
      productName: "E-book Introdução",
      amountLabel: "R$ 49,00",
      orderUrl: `${PREVIEW_URL}/pedido/IF-AB12CD?t=exemplo`,
      isDigital: true,
      downloadUrl: `${PREVIEW_URL}/download/exemplo-token`,
      expiresAtLabel: "16/09/2026",
      maxDownloads: 5,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "order-failed": {
    label: "Pagamento falhou (comprador)",
    priority: "transactional",
    subject: (props) => `Pagamento não concluído — ${props.productName}`,
    render: (props) => <OrderFailed {...props} />,
    preview: {
      customerName: "Ana Costa",
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      reason: "Cartão recusado pelo banco. Tente outro cartão ou Pix.",
      retryUrl: `${PREVIEW_URL}/p/consulta-online`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "download-link": {
    label: "Link de download (reenvio)",
    priority: "transactional",
    subject: (props) =>
      props.isOrderAccess
        ? `Acesso ao pedido ${props.publicCode}`
        : `Seu link de download — ${props.productName}`,
    render: (props) => <DownloadLink {...props} />,
    preview: {
      customerName: "Ana Costa",
      publicCode: "IF-AB12CD",
      productName: "E-book Introdução",
      downloadUrl: `${PREVIEW_URL}/download/exemplo-token`,
      expiresAtLabel: "16/09/2026",
      maxDownloads: 5,
      orderUrl: `${PREVIEW_URL}/pedido/IF-AB12CD`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "sale-affiliate": {
    label: "Nova venda (afiliado)",
    priority: "transactional",
    subject: (props) => `Nova venda — ${props.productName}`,
    render: (props) => <SaleAffiliate {...props} />,
    preview: {
      affiliateName: "Maria Souza",
      productName: "Consulta online",
      amountLabel: "R$ 199,90",
      commissionLabel: "R$ 29,99",
      availableAtLabel: "16/09/2026",
      publicCode: "IF-AB12CD",
      panelUrl: `${PREVIEW_URL}/painel/vendas`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "sale-admin": {
    label: "Venda paga (admin)",
    priority: "operational",
    subject: (props) => `Venda paga — ${props.publicCode}`,
    render: (props) => <SaleAdmin {...props} />,
    preview: {
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      amountLabel: "R$ 199,90",
      commissionLabel: "R$ 29,99",
      affiliateLabel: "@brnt4vs",
      sourceLabel: "Checkout",
      orderUrl: `${PREVIEW_URL}/admin/vendas/exemplo`,
    },
  },

  "order-refunded-buyer": {
    label: "Estorno (comprador)",
    priority: "transactional",
    subject: (props) => `Estorno — pedido ${props.publicCode}`,
    render: (props) => <OrderRefundedBuyer {...props} />,
    preview: {
      customerName: "Ana Costa",
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      amountLabel: "R$ 199,90",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "order-refunded-affiliate": {
    label: "Estorno (afiliado)",
    priority: "transactional",
    subject: () => "Uma venda sua foi estornada",
    render: (props) => <OrderRefundedAffiliate {...props} />,
    preview: {
      affiliateName: "Maria Souza",
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      commissionLabel: "R$ 29,99",
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "order-refunded-admin": {
    label: "Estorno (admin)",
    priority: "operational",
    subject: (props) => `Estorno — ${props.publicCode}`,
    render: (props) => <OrderRefundedAdmin {...props} />,
    preview: {
      publicCode: "IF-AB12CD",
      productName: "Consulta online",
      amountLabel: "R$ 199,90",
      affiliateLabel: "@brnt4vs",
      orderUrl: `${PREVIEW_URL}/admin/vendas/exemplo`,
    },
  },

  "commissions-available-digest": {
    label: "Digest de comissões liberadas",
    priority: "operational",
    subject: (props) => `${props.releasedTotalLabel} disponíveis para pagamento`,
    render: (props) => <CommissionsAvailableDigest {...props} />,
    preview: {
      affiliateName: "Maria Souza",
      releasedCount: 2,
      releasedTotalLabel: "R$ 59,98",
      nextPayoutLabel: "10/10/2026",
      panelUrl: `${PREVIEW_URL}/painel/comissoes`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },

  "payout-paid": {
    label: "Pagamento de comissão enviado",
    priority: "transactional",
    subject: (props) => `Pagamento de ${props.totalLabel} enviado`,
    render: (props) => <PayoutPaid {...props} />,
    preview: {
      affiliateName: "Maria",
      totalLabel: "R$ 89,94",
      paidAtLabel: "10/09/2026",
      referenceMonthLabel: "setembro de 2026",
      proofReference: "E2E123456789",
      hasProofFile: true,
      lineItems: [
        { label: "Consulta online (IF-AB12CD)", amountLabel: "R$ 29,98" },
        { label: "Livro digital (IF-XY98ZW)", amountLabel: "R$ 59,96" },
      ],
      panelUrl: `${PREVIEW_URL}/painel/comissoes`,
      supportWhatsapp: "+55 11 91234-5678",
    },
  },
};

export const EMAIL_TEMPLATE_NAMES = Object.keys(EMAIL_TEMPLATES) as EmailTemplateName[];

/** `true` se a string é um template conhecido — usado ao ler search params. */
export function isEmailTemplateName(value: string): value is EmailTemplateName {
  return Object.hasOwn(EMAIL_TEMPLATES, value);
}
