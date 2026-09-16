import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Três projetos: `lib` roda em Node (rápido, sem DOM), `components` em jsdom com
 * Testing Library e `integration` contra o Postgres descartável do
 * `docker compose` (`db_test`, porta 5434).
 *
 * O de integração roda em série e num processo só: os testes compartilham o
 * mesmo banco e limpam as tabelas entre si.
 */
export default defineConfig({
  // Resolve o alias `@/*` do tsconfig (nativo desde o Vite 8).
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    projects: [
      {
        test: {
          name: "lib",
          environment: "node",
          globals: true,
          include: ["src/lib/**/*.test.ts", "src/features/**/*.test.ts", "src/server/**/*.test.ts"],
          setupFiles: ["./tests/setup/node.ts"],
        },
      },
      {
        plugins: [react()],
        test: {
          name: "components",
          environment: "jsdom",
          globals: true,
          include: ["src/components/**/*.test.tsx", "src/app/**/*.test.tsx"],
          setupFiles: ["./tests/setup/dom.ts"],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          globals: true,
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["./tests/setup/integration.ts"],
          globalSetup: ["./tests/setup/integration-global.ts"],
          // Banco compartilhado: paralelismo aqui viraria teste intermitente.
          fileParallelism: false,
          sequence: { concurrent: false },
          // Hash de senha com scrypt é lento de propósito.
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts", "src/features/**/service.ts"],
      exclude: ["**/*.test.*", "src/lib/env.ts", "src/generated/**"],
      thresholds: {
        // Meta da spec: 90% em lib/ e nos services. Sobe conforme as fatias avançam.
        lines: 80,
        functions: 80,
      },
    },
  },
});
