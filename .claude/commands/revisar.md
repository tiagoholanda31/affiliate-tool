---
description: Revisão sênior da fatia atual (segurança, qualidade, UX) sem alterar código
allowed-tools: Read, Grep, Glob, Bash(pnpm:*), Bash(git diff:*), Bash(git log:*)
---

Faça uma revisão de código da fatia atual como um engenheiro sênior. Não altere arquivos.

1. `git diff main...HEAD --stat` e leia os arquivos alterados.
2. Avalie contra `docs/spec/04-seguranca.md` (checklist) e as "Regras de código" do CLAUDE.md.
3. Procure especificamente: entradas sem Zod, actions sem `authedAction`/`adminAction`, `process.env` fora de `env.ts`,
   dinheiro em float, datas sem timezone, dados sensíveis vazando para o client, falta de `revalidatePath`,
   ausência de AuditLog em ações de admin, queries N+1, componentes client desnecessários, textos sem pt-BR,
   estados de loading/empty/error faltando, contraste e foco.
4. Liste achados por severidade (Bloqueante / Importante / Sugestão) com arquivo:linha e correção proposta.
5. Termine com um veredito: "pronto para handoff" ou "corrigir X antes".
