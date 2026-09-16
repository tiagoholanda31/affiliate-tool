/**
 * Máscaras de entrada pt-BR.
 *
 * Funções puras: recebem o que o usuário digitou e devolvem o texto formatado
 * (`apply*`) ou o valor limpo para enviar ao servidor (`unmask*`).
 *
 * Regra da spec (05, item 5): o campo mostra máscara, o submit envia valor limpo.
 */

export type MaskKind = "phone" | "cpf" | "cnpj" | "cpfCnpj" | "money";

/** Só os dígitos: `(11) 98765-4321` → `11987654321`. */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** `12345678909` → `123.456.789-09`. Trunca o que passar de 11 dígitos. */
export function applyCpfMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

/** `12345678000190` → `12.345.678/0001-90`. Trunca o que passar de 14 dígitos. */
export function applyCnpjMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);

  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

/** Escolhe CPF ou CNPJ pela quantidade de dígitos (campo único de documento). */
export function applyCpfCnpjMask(value: string): string {
  const digits = onlyDigits(value);
  return digits.length > 11 ? applyCnpjMask(digits) : applyCpfMask(digits);
}

/**
 * `11987654321` → `(11) 98765-4321`; fixo com 10 dígitos → `(11) 3456-7890`.
 * Trunca o que passar de 11 dígitos (DDD + celular).
 */
export function applyPhoneMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) return digits.replace(/^(\d{1,2})/, "($1");
  if (digits.length <= 6) return digits.replace(/^(\d{2})(\d{0,4})/, "($1) $2");
  if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

/**
 * Máscara de moeda que preenche da direita para a esquerda: cada dígito
 * digitado empurra o valor, como numa maquininha. `1234` → `12,34`.
 */
export function applyMoneyMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 13);
  if (digits === "") return "";

  const cents = Number(digits);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/** Valor mascarado de moeda → centavos. `"1.234,56"` → `123456`. */
export function unmaskMoney(value: string): number {
  const digits = onlyDigits(value);
  return digits === "" ? 0 : Number(digits);
}

/** Aplica a máscara correspondente ao tipo. */
export function applyMask(kind: MaskKind, value: string): string {
  switch (kind) {
    case "phone":
      return applyPhoneMask(value);
    case "cpf":
      return applyCpfMask(value);
    case "cnpj":
      return applyCnpjMask(value);
    case "cpfCnpj":
      return applyCpfCnpjMask(value);
    case "money":
      return applyMoneyMask(value);
  }
}

/**
 * Valor a enviar ao servidor: dígitos para documentos e telefone, centavos
 * (como string) para moeda.
 */
export function unmask(kind: MaskKind, value: string): string {
  return kind === "money" ? String(unmaskMoney(value)) : onlyDigits(value);
}

/** Valida CPF pelos dois dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  // Sequências repetidas (000…, 111…) passam no cálculo, mas não são CPFs.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  for (const [length, factor] of [
    [9, 10],
    [10, 11],
  ] as const) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (factor - index);
    }
    const remainder = ((sum * 10) % 11) % 10;
    if (remainder !== Number(digits[length])) return false;
  }

  return true;
}

/** Valida CNPJ pelos dois dígitos verificadores. */
export function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const weightsFirst = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weightsSecond = [6, ...weightsFirst];

  for (const [position, weights] of [
    [12, weightsFirst],
    [13, weightsSecond],
  ] as const) {
    let sum = 0;
    for (const [index, weight] of weights.entries()) {
      sum += Number(digits[index]) * weight;
    }
    const remainder = sum % 11;
    const expected = remainder < 2 ? 0 : 11 - remainder;
    if (expected !== Number(digits[position])) return false;
  }

  return true;
}

/** Telefone brasileiro: DDD válido + 8 ou 9 dígitos. */
export function isValidPhone(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;

  // Celular (11 dígitos) sempre começa com 9 depois do DDD.
  if (digits.length === 11 && digits[2] !== "9") return false;

  return true;
}
