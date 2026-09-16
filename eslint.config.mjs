import js from "@eslint/js";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));

/**
 * Arquivos do projeto que passam pelo linting com informação de tipo.
 * Os `*.config.*` ficam de fora: não estão no `tsconfig.json` do app e as regras
 * type-aware não teriam programa TypeScript para consultar.
 */
const TYPED_FILES = [
  "src/**/*.{ts,tsx}",
  "emails/**/*.tsx",
  "prisma/**/*.ts",
  "tests/**/*.{ts,tsx}",
];

// `eslint-config-next/core-web-vitals` já traz react, react-hooks, jsx-a11y,
// import e @next/next configurados — não repetimos esses plugins aqui.
export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "next-env.d.ts",
      "src/generated/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },

  js.configs.recommended,
  ...nextCoreWebVitals,

  {
    files: TYPED_FILES,
    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      // Convenção do projeto: `type` para props e modelos (uniforme, e permite
      // unions/interseções sem alternar de sintaxe no meio do arquivo).
      "@typescript-eslint/consistent-type-definitions": "off",

      // Regra do CLAUDE.md: sem `any`, sem supressões silenciosas.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description", minimumDescriptionLength: 10 },
      ],
      // Variáveis não usadas: permitir prefixo _ para descartes explícitos.
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // `import type` explícito mantém o bundle do client enxuto.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      // Promises soltas em Server Actions/handlers são fonte comum de bug silencioso.
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      // Segredos só via src/lib/env.ts (as exceções estão no override abaixo).
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message: "Leia variáveis de ambiente via `env` de src/lib/env.ts.",
        },
      ],
    },
  },

  // Únicos lugares autorizados a tocar process.env: o próprio env.ts, o seed
  // (roda fora do Next), o instrumental de teste e o proxy — que roda antes do
  // app e não deve importar módulos pesados, e só lê NODE_ENV (não é segredo).
  {
    files: ["src/lib/env.ts", "src/proxy.ts", "prisma/seed.ts", "tests/**", "**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-properties": "off",
    },
  },

  // Setup de teste preenche buracos do jsdom: stubs vazios são o esperado.
  {
    files: ["tests/setup/**"],
    rules: {
      "@typescript-eslint/no-empty-function": "off",
    },
  },

  prettier,
);
