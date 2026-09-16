import { spawn } from "node:child_process";

/**
 * Roda `next build` com ANALYZE=true (Windows-friendly).
 * Abre o relatório do @next/bundle-analyzer no fim do build.
 */
const child = spawn("pnpm", ["exec", "next", "build"], {
  stdio: "inherit",
  env: { ...process.env, ANALYZE: "true" },
  shell: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
