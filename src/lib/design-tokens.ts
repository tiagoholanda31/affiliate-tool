/**
 * Tokens de cor em TypeScript e verificação de contraste.
 *
 * Os valores espelham o `@theme` de `src/app/globals.css` — o CSS é a fonte para
 * o estilo, este arquivo existe para podermos **testar** contraste
 * automaticamente (docs/spec/05: "verificar AA em todos os pares usados").
 *
 * Se um token mudar no CSS, mude aqui também: `design-tokens.test.ts` falha se
 * algum par cair abaixo do mínimo AA.
 */

export const COLORS = {
  navy900: "#00172d",
  navy800: "#0b2440",
  navy700: "#163356",
  teal700: "#2f7f7a",
  teal600: "#3a9691",
  teal100: "#e3f1f0",
  gold500: "#e9be60",
  gold600: "#d1a84b",
  gold700: "#8e7233",
  gold100: "#fbf3e0",
  mist300: "#b8c6dd",
  mist100: "#f0f2f4",
  white: "#ffffff",
  success: "#2c7773",
  successBg: "#e3f1f0",
  warning: "#98641a",
  warningBg: "#fbf3e0",
  danger: "#b42318",
  dangerBg: "#fdecea",
  info: "#1d4f8f",
  infoBg: "#e8f0fb",
} as const;

export type ColorToken = keyof typeof COLORS;

/** Mínimos da WCAG 2.1 nível AA. */
export const AA_NORMAL_TEXT = 4.5;
/** Texto grande: a partir de 18 px normal ou 14 px em negrito. */
export const AA_LARGE_TEXT = 3;

export type ContrastPair = {
  name: string;
  foreground: string;
  background: string;
  /** `true` quando o par só é usado em texto grande (KPI, H1). */
  large: boolean;
  ratio: number;
};

/** Pares de cor efetivamente usados na interface. */
const PAIR_DEFINITIONS: readonly Omit<ContrastPair, "ratio">[] = [
  {
    name: "Texto sobre fundo",
    foreground: COLORS.navy900,
    background: COLORS.mist100,
    large: false,
  },
  {
    name: "Texto sobre cartão",
    foreground: COLORS.navy900,
    background: COLORS.white,
    large: false,
  },
  { name: "Texto secundário", foreground: COLORS.navy700, background: COLORS.white, large: false },
  {
    name: "Texto secundário / fundo",
    foreground: COLORS.navy700,
    background: COLORS.mist100,
    large: false,
  },
  { name: "Botão primário", foreground: COLORS.white, background: COLORS.navy900, large: false },
  { name: "Botão secundário", foreground: COLORS.white, background: COLORS.teal700, large: false },
  { name: "Link / ação", foreground: COLORS.teal700, background: COLORS.white, large: false },
  { name: "Sidebar admin", foreground: COLORS.mist300, background: COLORS.navy900, large: false },
  {
    name: "Sidebar admin (ativo)",
    foreground: COLORS.white,
    background: COLORS.navy800,
    large: false,
  },
  { name: "KPI dourado", foreground: COLORS.gold500, background: COLORS.navy900, large: true },
  {
    name: "Dourado sobre claro",
    foreground: COLORS.gold700,
    background: COLORS.white,
    large: false,
  },
  { name: "Badge sucesso", foreground: COLORS.success, background: COLORS.successBg, large: false },
  { name: "Badge atenção", foreground: COLORS.warning, background: COLORS.warningBg, large: false },
  { name: "Badge erro", foreground: COLORS.danger, background: COLORS.dangerBg, large: false },
  { name: "Badge informação", foreground: COLORS.info, background: COLORS.infoBg, large: false },
  { name: "Badge neutro", foreground: COLORS.navy700, background: COLORS.mist100, large: false },
] as const;

/** Os mesmos pares, já com a razão de contraste calculada. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = PAIR_DEFINITIONS.map((pair) => ({
  ...pair,
  ratio: contrastRatio(pair.foreground, pair.background),
}));

/** Mínimo exigido por um par, conforme seja texto grande ou normal. */
export function minimumRatio(pair: Pick<ContrastPair, "large">): number {
  return pair.large ? AA_LARGE_TEXT : AA_NORMAL_TEXT;
}

/**
 * Razão de contraste WCAG entre duas cores, de 1 (idênticas) a 21
 * (preto sobre branco).
 */
export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Luminância relativa da WCAG 2.1 (sRGB linearizado). */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [red, green, blue] = [r, g, b].map(linearize) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function linearize(channel8bit: number): number {
  const channel = channel8bit / 255;
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new TypeError(`Cor hexadecimal inválida: ${hex}`);
  }

  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}
