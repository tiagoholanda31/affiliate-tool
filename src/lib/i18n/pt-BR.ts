/**
 * Textos reutilizados e rótulos de enums, em português do Brasil.
 *
 * O que aparece uma vez só pode ficar no componente; o que se repete (mensagens
 * de erro de formulário, nomes de status) vive aqui para não divergir entre telas.
 *
 * Cada fatia preenche os rótulos dos enums que introduz.
 */

export const MESSAGES = {
  genericError: "Algo deu errado. Tente novamente.",
  networkError: "Não conseguimos falar com o servidor. Verifique sua conexão.",
  unauthorized: "Você precisa entrar para continuar.",
  forbidden: "Você não tem permissão para esta ação.",
  notFound: "Não encontramos o que você procura.",
  rateLimited: "Muitas tentativas. Aguarde um instante e tente de novo.",
  saved: "Alterações salvas.",
  copied: "Copiado!",
  copyFailed: "Não foi possível copiar. Copie manualmente.",
  loading: "Carregando…",
  empty: "Nada por aqui ainda.",
  noFilterResults: "Nenhum resultado para os filtros aplicados.",
  tryAgain: "Tentar novamente",
  cancel: "Cancelar",
  confirm: "Confirmar",
  save: "Salvar",
  back: "Voltar",
} as const;

/**
 * Mensagens de autenticação (fatia 01).
 *
 * `checkYourEmail` e `resetRequested` são deliberadamente idênticas exista ou
 * não a conta: revelar quais e-mails estão cadastrados entregaria a base de
 * afiliados a quem tentasse adivinhar (docs/spec/04, Enumeração de e-mail).
 */
export const AUTH_MESSAGES = {
  checkYourEmail: "Se este e-mail ainda não estiver cadastrado, enviaremos um link de confirmação.",
  resetRequested: "Se este e-mail existir, enviaremos um link para redefinir a senha.",
  invalidCredentials: "E-mail ou senha incorretos.",
  emailNotVerified: "Confirme seu e-mail antes de entrar. Reenviamos o link para você.",
  linkExpired: "Este link expirou ou já foi usado.",
  accountLocked:
    "Muitas tentativas de entrada. Aguarde alguns minutos antes de tentar de novo ou redefina sua senha.",
  wrongPassword: "Senha atual incorreta.",
  commonPassword: "Esta senha é muito comum. Escolha outra que só você saiba.",
  signedOut: "Você saiu da sua conta.",
} as const;

export const FIELD_ERRORS = {
  required: "Campo obrigatório.",
  email: "Informe um e-mail válido.",
  minLength: (min: number) => `Use pelo menos ${String(min)} caracteres.`,
  maxLength: (max: number) => `Use no máximo ${String(max)} caracteres.`,
  cpf: "CPF inválido.",
  cnpj: "CNPJ inválido.",
  phone: "Telefone inválido. Use DDD + número.",
  money: "Informe um valor válido.",
  passwordMismatch: "As senhas não conferem.",
  termsRequired: "É preciso aceitar os termos para continuar.",
} as const;

/**
 * Rótulos de enums do banco.
 * Preenchidos pelas fatias que introduzem cada enum — mantidos aqui para que a
 * mesma palavra apareça igual no painel do afiliado e no admin.
 */
export const LABELS = {
  /** `Role` — fatia 01. */
  role: {
    ADMIN: "Administrador",
    AFFILIATE: "Afiliado",
  } as Record<string, string>,
  /** `AffiliateStatus` — fatia 01. */
  affiliateStatus: {
    PENDING: "Em análise",
    APPROVED: "Aprovado",
    REJECTED: "Reprovado",
    SUSPENDED: "Suspenso",
    REMOVED: "Removido",
  } as Record<string, string>,
  /** `SocialNetwork` — fatia 01. */
  socialNetwork: {
    INSTAGRAM: "Instagram",
    TIKTOK: "TikTok",
    YOUTUBE: "YouTube",
    FACEBOOK: "Facebook",
    LINKEDIN: "LinkedIn",
    WHATSAPP: "WhatsApp",
    OTHER: "Outra",
  } as Record<string, string>,
  /** `PixKeyType` — fatia 01. */
  pixKeyType: {
    CPF: "CPF",
    CNPJ: "CNPJ",
    EMAIL: "E-mail",
    PHONE: "Celular",
    RANDOM: "Chave aleatória",
  } as Record<string, string>,
  /** `ProductType` / `ProductStatus` — fatia 03. */
  productType: {
    SERVICE: "Serviço",
    DIGITAL: "Digital",
  } as Record<string, string>,
  productStatus: {
    DRAFT: "Rascunho",
    ACTIVE: "Publicado",
    ARCHIVED: "Arquivado",
  } as Record<string, string>,
  /** `OrderStatus` / `PaymentMethod` — fatia 05. */
  orderStatus: {
    PENDING: "Aguardando pagamento",
    PAID: "Pago",
    FAILED: "Falhou",
    EXPIRED: "Expirado",
    CANCELED: "Cancelado",
    REFUNDED: "Estornado",
    CHARGEDBACK: "Chargeback",
  } as Record<string, string>,
  paymentMethod: {
    PIX: "Pix",
    CREDIT_CARD: "Cartão",
    MANUAL: "Manual",
  } as Record<string, string>,
  /** `CommissionStatus` — fatia 06. */
  commissionStatus: {
    PENDING: "Pendente",
    AVAILABLE: "Disponível",
    PAID: "Paga",
    REVERSED: "Revertida",
  } as Record<string, string>,
  /** `PayoutStatus` — fatia 07. */
  payoutStatus: {
    DRAFT: "Rascunho",
    PAID: "Pago",
  } as Record<string, string>,
  /** `MaterialType` — fatia 09. */
  materialType: {
    IMAGE: "Imagem",
    PDF: "PDF",
    TEXT: "Texto",
    LINK: "Link",
  } as Record<string, string>,
  webhookStatus: {
    RECEIVED: "Recebido",
    PROCESSED: "Processado",
    IGNORED: "Ignorado",
    FAILED: "Falhou",
  } as Record<string, string>,
  /** `EmailStatus` — fatia 00 (usado na página admin "Sistema"). */
  emailStatus: {
    QUEUED: "Na fila",
    SENT: "Enviado",
    FAILED: "Falhou",
  } as Record<string, string>,
} as const;

/** Rótulo de um enum, com o próprio valor como reserva se ainda não houver tradução. */
export function labelFor(group: keyof typeof LABELS, value: string): string {
  return LABELS[group][value] ?? value;
}
