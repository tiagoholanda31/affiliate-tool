/**
 * Detecção de bots por User-Agent (lista curta, MVP).
 *
 * Clique de bot é gravado com `isBot=true` e não entra nos KPIs.
 * Sem CAPTCHA no MVP (docs/spec/04).
 */

/** Trechos case-insensitive que marcam o UA como bot. */
export const BOT_UA_FRAGMENTS = [
  "bot",
  "spider",
  "crawl",
  "slurp",
  "curl/",
  "wget/",
  "python-requests",
  "python-urllib",
  "httpclient",
  "java/",
  "go-http-client",
  "libwww-perl",
  "scrapy",
  "headlesschrome",
  "phantomjs",
  "selenium",
  "puppeteer",
  "playwright",
  "axios/",
  "node-fetch",
  "okhttp",
  "postman",
  "insomnia",
  "googlebot",
  "bingbot",
  "yandexbot",
  "duckduckbot",
  "baiduspider",
  "facebookexternalhit",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "applebot",
  "semrush",
  "ahrefs",
  "mj12bot",
  "dotbot",
  "petalbot",
] as const;

/** `true` se o UA parecer automatizado ou estiver vazio. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  const ua = userAgent.toLowerCase();
  return BOT_UA_FRAGMENTS.some((fragment) => ua.includes(fragment));
}
