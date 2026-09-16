/**
 * Datas.
 *
 * Regra do CLAUDE.md: o banco guarda **UTC**; a exibição é sempre em
 * `America/Sao_Paulo`. Nenhum componente deve chamar `new Date()` direto para
 * formatar — passe pelos helpers daqui para não vazar o fuso do servidor.
 */
import { TZDate } from "@date-fns/tz";
import { addDays, formatDistanceStrict, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";

export const SAO_PAULO = "America/Sao_Paulo";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO,
  hour: "2-digit",
  minute: "2-digit",
});

const monthYearFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO,
  month: "long",
  year: "numeric",
});

/** "05/09/2026" no fuso de São Paulo. */
export function formatDate(date: Date): string {
  assertValid(date);
  return dateFormatter.format(date);
}

/** "05/09/2026 14:30" no fuso de São Paulo (sem a vírgula que o Intl insere). */
export function formatDateTime(date: Date): string {
  assertValid(date);
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}

/** "14:30" no fuso de São Paulo. */
export function formatTime(date: Date): string {
  assertValid(date);
  return timeFormatter.format(date);
}

/** "setembro de 2026" — usado em cabeçalhos de extrato e lotes de pagamento. */
export function formatMonthYear(date: Date): string {
  assertValid(date);
  return monthYearFormatter.format(date);
}

/** Abaixo disto uma data é "agora há pouco" em vez de "há 3 segundos". */
const JUST_NOW_MS = 60_000;

/**
 * "há 2 horas" — para listas. A data absoluta deve ir junto no `title` do
 * elemento (ver o componente `DateText`).
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  assertValid(date);
  if (Math.abs(now.getTime() - date.getTime()) < JUST_NOW_MS) {
    return "agora há pouco";
  }
  return formatDistanceStrict(date, now, { locale: ptBR, addSuffix: true });
}

/** Data ISO curta (`2026-09-05`) no fuso de São Paulo — usada em URLs e CSV. */
export function toIsoDate(date: Date): string {
  const { year, month, day } = partsInSaoPaulo(date);
  return `${String(year)}-${pad(month)}-${pad(day)}`;
}

/** Mês de referência `YYYY-MM` no fuso de São Paulo (lotes de pagamento). */
export function toReferenceMonth(date: Date = new Date()): string {
  const { year, month } = partsInSaoPaulo(date);
  return `${String(year)}-${pad(month)}`;
}

/** Ano corrente em São Paulo — usado no aviso de copyright do rodapé. */
export function currentYear(now: Date = new Date()): number {
  return partsInSaoPaulo(now).year;
}

/** Ano, mês (1-12) e dia de uma data, lidos no fuso de São Paulo. */
export function partsInSaoPaulo(date: Date): { year: number; month: number; day: number } {
  assertValid(date);
  const local = new TZDate(date, SAO_PAULO);
  return {
    year: local.getFullYear(),
    month: local.getMonth() + 1,
    day: local.getDate(),
  };
}

/** Instante UTC correspondente à meia-noite daquele dia em São Paulo. */
export function startOfDayInSaoPaulo(year: number, month: number, day: number): Date {
  const local = new TZDate(year, month - 1, day, 0, 0, 0, 0, SAO_PAULO);
  return new Date(local.getTime());
}

/**
 * Data em que uma comissão criada agora fica disponível para saque.
 * A carência (`holdDays`) protege contra estorno — ver docs/spec/01.
 */
export function addHoldDays(from: Date, holdDays: number): Date {
  assertValid(from);
  if (!Number.isInteger(holdDays) || holdDays < 0) {
    throw new TypeError(`holdDays deve ser inteiro não negativo; recebido: ${String(holdDays)}`);
  }
  return addDays(from, holdDays);
}

/**
 * Próxima data de pagamento de comissões: o dia fixo do mês configurado em
 * `Setting.payoutDay`, à meia-noite de São Paulo.
 *
 * Se hoje ainda não passou do dia, é neste mês; senão, no mês seguinte.
 * Meses curtos são tratados: dia 31 em fevereiro vira o último dia do mês.
 */
export function nextPayoutDate(payoutDay: number, from: Date = new Date()): Date {
  if (!Number.isInteger(payoutDay) || payoutDay < 1 || payoutDay > 31) {
    throw new RangeError(`payoutDay deve estar entre 1 e 31; recebido: ${String(payoutDay)}`);
  }

  const today = partsInSaoPaulo(from);
  const useNextMonth = today.day > payoutDay;

  const monthIndex = today.month - 1 + (useNextMonth ? 1 : 0);
  const year = today.year + Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;

  // `Date.UTC(y, m, 0)` cai no último dia do mês anterior, ou seja, do mês `m`.
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return startOfDayInSaoPaulo(year, month, Math.min(payoutDay, lastDayOfMonth));
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function assertValid(date: Date): void {
  if (!isValid(date)) {
    throw new TypeError("Data inválida.");
  }
}
