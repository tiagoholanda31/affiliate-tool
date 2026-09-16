/** Ambiente dos testes de componente: matchers do jest-dom + limpeza entre casos. */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

afterEach(() => {
  cleanup();
});

/**
 * O jsdom não implementa algumas APIs que o Radix usa (diálogos, select,
 * tooltip). Os stubs abaixo preenchem esses buracos; o cast existe porque
 * estamos completando o próprio ambiente, não tipando código do app.
 */
const win = window as unknown as Record<string, unknown>;

win.matchMedia ??= (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
});

win.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
};

const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
proto.scrollIntoView ??= vi.fn();
proto.hasPointerCapture ??= vi.fn(() => false);
proto.setPointerCapture ??= vi.fn();
proto.releasePointerCapture ??= vi.fn();
