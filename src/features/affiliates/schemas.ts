/**
 * Schemas de validação do afiliado (Zod).
 *
 * São a única porta de entrada dos dados do cadastro e do perfil: a Server
 * Action valida com eles antes de qualquer coisa, e os formulários usam os
 * mesmos schemas no browser (react-hook-form + zodResolver), então a mensagem
 * que o usuário vê no blur é literalmente a mesma que o servidor produziria.
 *
 * Convenções:
 * - telefone chega só com dígitos e é convertido para E.164 (`+55DDDNNNNNNNNN`);
 * - `socialHandle` é gravado sem `@`;
 * - a chave Pix é validada **por tipo** e normalizada antes de ser criptografada.
 */
import { z } from "zod";

import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/masks";
import { isCommonPassword } from "@/lib/passwords";

export const SOCIAL_NETWORKS = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "FACEBOOK",
  "LINKEDIN",
  "WHATSAPP",
  "OTHER",
] as const;

export const PIX_KEY_TYPES = ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"] as const;

export type SocialNetworkValue = (typeof SOCIAL_NETWORKS)[number];
export type PixKeyTypeValue = (typeof PIX_KEY_TYPES)[number];

/** Tamanho mínimo da senha — o mesmo valor configurado no Better Auth. */
export const MIN_PASSWORD_LENGTH = 10;
/** Tamanho mínimo do motivo em transições de status (docs/spec/01, seção 1). */
export const MIN_REASON_LENGTH = 10;

// ─── Campos ──────────────────────────────────────────────────────────────────

export const nameSchema = z
  .string()
  .trim()
  .min(3, FIELD_ERRORS.minLength(3))
  .max(120, FIELD_ERRORS.maxLength(120))
  // Nome sem letra nenhuma quase sempre é bot ou erro de preenchimento.
  .refine((value) => /\p{L}/u.test(value), { message: "Informe seu nome completo." });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email(FIELD_ERRORS.email))
  .pipe(z.string().max(180, FIELD_ERRORS.maxLength(180)));

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, FIELD_ERRORS.minLength(MIN_PASSWORD_LENGTH))
  .max(128, FIELD_ERRORS.maxLength(128))
  .refine((value) => !isCommonPassword(value), {
    message: "Esta senha é muito comum. Escolha outra que só você saiba.",
  });

/**
 * Telefone brasileiro em E.164.
 *
 * O formulário envia só dígitos (`MaskedInput` já limpa a máscara); aceitamos
 * também um `+55` que o usuário tenha digitado ou colado.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => onlyDigits(value).replace(/^55(?=\d{10,11}$)/, ""))
  .refine(isValidPhone, { message: FIELD_ERRORS.phone })
  .transform((digits) => `+55${digits}`);

/** `@maria.afiliada`, `https://instagram.com/maria.afiliada` e `maria.afiliada` viram `maria.afiliada`. */
export const socialHandleSchema = z
  .string()
  .trim()
  .transform((value) =>
    value
      .replace(/^https?:\/\/(www\.)?[^/]+\//i, "")
      .replace(/\/+$/, "")
      .replace(/^@+/, ""),
  )
  .pipe(
    z
      .string()
      .min(2, FIELD_ERRORS.minLength(2))
      .max(60, FIELD_ERRORS.maxLength(60))
      .regex(/^[a-zA-Z0-9._-]+$/, "Use apenas letras, números, ponto, hífen ou sublinhado."),
  );

/**
 * Os dois campos de escolha entram como **string** e saem como enum.
 *
 * É assim que o `<select>` funciona de verdade: antes de a pessoa escolher, o
 * valor é `""`. Modelar a entrada como enum obrigaria o formulário a fingir que
 * o campo já tem um valor válido desde o início — e a tela e o schema passariam
 * a discordar sobre o que existe.
 */
export const socialNetworkSchema = z
  .string()
  .min(1, "Escolha uma rede social.")
  .pipe(z.enum(SOCIAL_NETWORKS, { message: "Escolha uma rede social." }));

export const pixKeyTypeSchema = z
  .string()
  .min(1, "Escolha o tipo da chave Pix.")
  .pipe(z.enum(PIX_KEY_TYPES, { message: "Escolha o tipo da chave Pix." }));

export const reasonSchema = z
  .string()
  .trim()
  .min(MIN_REASON_LENGTH, FIELD_ERRORS.minLength(MIN_REASON_LENGTH))
  .max(500, FIELD_ERRORS.maxLength(500));

// ─── Chave Pix ───────────────────────────────────────────────────────────────

const UUID_V4_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PixValidationResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Valida e normaliza a chave Pix conforme o tipo declarado.
 *
 * A normalização importa: o banco do afiliado espera a chave no formato canônico
 * (CPF só com dígitos, telefone em E.164, e-mail em minúsculas), e é esse valor
 * que será criptografado e depois copiado pelo admin na hora de pagar.
 */
export function validatePixKey(type: PixKeyTypeValue, key: string): PixValidationResult {
  const trimmed = key.trim();

  // O `default` não é redundante: em Zod 4 as checagens de objeto continuam
  // rodando mesmo com um campo já inválido, então esta função é chamada com o
  // tipo ainda vazio enquanto a pessoa preenche o formulário.
  switch (type) {
    case "CPF": {
      const digits = onlyDigits(trimmed);
      if (!isValidCpf(digits)) return { ok: false, message: FIELD_ERRORS.cpf };
      return { ok: true, value: digits };
    }
    case "CNPJ": {
      const digits = onlyDigits(trimmed);
      if (!isValidCnpj(digits)) return { ok: false, message: FIELD_ERRORS.cnpj };
      return { ok: true, value: digits };
    }
    case "EMAIL": {
      const parsed = z.email().safeParse(trimmed.toLowerCase());
      if (!parsed.success) return { ok: false, message: FIELD_ERRORS.email };
      return { ok: true, value: parsed.data };
    }
    case "PHONE": {
      const digits = onlyDigits(trimmed).replace(/^55(?=\d{10,11}$)/, "");
      if (!isValidPhone(digits)) return { ok: false, message: FIELD_ERRORS.phone };
      return { ok: true, value: `+55${digits}` };
    }
    case "RANDOM": {
      if (!UUID_V4_LIKE.test(trimmed)) {
        return {
          ok: false,
          message: "A chave aleatória tem 32 caracteres separados por hífen (formato UUID).",
        };
      }
      return { ok: true, value: trimmed.toLowerCase() };
    }
    default:
      return { ok: false, message: "Escolha o tipo da chave Pix." };
  }
}

/**
 * Tipo + chave só fazem sentido juntos: a mesma string é válida como e-mail e
 * inválida como CPF. Estes dois passos vão em todo schema que carrega o par, e
 * é o que faz o erro cair no campo `pixKey` — e não numa mensagem geral que a
 * pessoa lê sem saber o que corrigir.
 */
type PixPair = { pixKeyType: PixKeyTypeValue; pixKey: string };

/** O tipo já foi escolhido? Sem isso não há o que conferir na chave. */
function hasPixType(value: PixPair): boolean {
  return (PIX_KEY_TYPES as readonly string[]).includes(value.pixKeyType);
}

function checkPixPair(value: PixPair, ctx: z.RefinementCtx): void {
  // Tipo ainda não escolhido: o erro é do campo `pixKeyType`, e repeti-lo em
  // `pixKey` só encheria a tela de vermelho sem dizer nada de novo.
  if (!hasPixType(value)) return;

  const result = validatePixKey(value.pixKeyType, value.pixKey);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", path: ["pixKey"], message: result.message });
  }
}

/** Grava a chave já no formato canônico (CPF só com dígitos, e-mail minúsculo…). */
function normalizePixPair<T extends PixPair>(value: T): T {
  if (!hasPixType(value)) return value;

  const result = validatePixKey(value.pixKeyType, value.pixKey);
  return result.ok ? { ...value, pixKey: result.value } : value;
}

// ─── Formulários ─────────────────────────────────────────────────────────────

/** Passo 1 do cadastro: quem é a pessoa e como ela entra. */
export const registerStepOneSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  socialNetwork: socialNetworkSchema,
  socialHandle: socialHandleSchema,
});

/** Passo 2 do cadastro: para onde vai o dinheiro e o aceite dos termos. */
export const registerStepTwoSchema = z.object({
  pixKeyType: pixKeyTypeSchema,
  pixKey: z.string().trim().min(1, FIELD_ERRORS.required),
  // `boolean` + refine em vez de `literal(true)`: o campo existe desmarcado
  // antes de a pessoa clicar, e o tipo de entrada precisa aceitar isso.
  termsAccepted: z
    .boolean()
    .refine((accepted) => accepted, { message: FIELD_ERRORS.termsRequired }),
});

/**
 * O que a action recebe: os dois passos somados mais os campos anti-bot.
 *
 * `website` é o honeypot — invisível para gente, irresistível para robô de
 * preenchimento automático. `startedAt` é o instante em que o formulário foi
 * montado; um humano não preenche seis campos em menos de três segundos
 * (docs/spec/04, Anti-bot).
 */
export const registerAffiliateSchema = registerStepOneSchema
  .extend(registerStepTwoSchema.shape)
  .extend({
    website: z.string().max(0, "Requisição inválida.").optional().default(""),
    startedAt: z.coerce.number().int().nonnegative(),
  })
  .superRefine(checkPixPair)
  .transform(normalizePixPair);

export type RegisterAffiliateInput = z.input<typeof registerAffiliateSchema>;
export type RegisterAffiliateData = z.output<typeof registerAffiliateSchema>;

/** Perfil: os campos que o afiliado pode mudar sozinho, sem senha. */
export const updateProfileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  socialNetwork: socialNetworkSchema,
  socialHandle: socialHandleSchema,
});

/** Trocar a chave Pix exige a senha atual: é o campo que decide para onde vai o dinheiro. */
export const changePixKeySchema = z
  .object({
    pixKeyType: pixKeyTypeSchema,
    pixKey: z.string().trim().min(1, FIELD_ERRORS.required),
    currentPassword: z.string().min(1, FIELD_ERRORS.required),
  })
  .superRefine(checkPixPair)
  .transform(normalizePixPair);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, FIELD_ERRORS.required),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, FIELD_ERRORS.required),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: FIELD_ERRORS.passwordMismatch,
  });

/** Reenvio do cadastro após reprovação: os mesmos dados, sem e-mail nem senha. */
export const resubmitAffiliateSchema = z
  .object({
    name: nameSchema,
    phone: phoneSchema,
    socialNetwork: socialNetworkSchema,
    socialHandle: socialHandleSchema,
    pixKeyType: pixKeyTypeSchema,
    pixKey: z.string().trim().min(1, FIELD_ERRORS.required),
  })
  .superRefine(checkPixPair)
  .transform(normalizePixPair);

// ─── Autenticação ────────────────────────────────────────────────────────────

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, FIELD_ERRORS.required),
  /** Para onde voltar depois de entrar; só caminhos internos são aceitos. */
  next: z.string().optional(),
});

export const requestPasswordResetSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Link inválido."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, FIELD_ERRORS.required),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: FIELD_ERRORS.passwordMismatch,
  });

export const resendVerificationSchema = z.object({ email: emailSchema });
