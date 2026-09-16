---
description: Executa uma fatia inteira de desenvolvimento (ex. /fatia 03)
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(pnpm:*), Bash(npx prisma:*), Bash(git:*)
---

Você vai executar a **fatia $ARGUMENTS** deste projeto, do início ao handoff, nesta sessão.

Faça exatamente nesta ordem:

1. Leia `docs/PROGRESS.md`. Identifique a última fatia `DONE` e as dívidas abertas que afetam esta fatia.
2. Localize o arquivo da fatia: `docs/fatias/$ARGUMENTS-*.md` (use Glob). Leia-o por completo.
3. Leia **apenas** os arquivos listados em "Contexto necessário" da fatia. Não leia outros docs de `docs/spec/`.
4. Verifique o pré-requisito: a fatia anterior precisa estar `DONE`. Se não estiver, PARE e me avise.
5. Crie/mude para a branch `fatia/$ARGUMENTS` a partir de `main`.
6. Escreva um plano curto (máx. 15 linhas): arquivos que vai criar/alterar, migrations, testes. Aguarde meu OK **apenas se** o plano divergir do que a fatia descreve; caso contrário, prossiga.
7. Implemente em passos pequenos. Após cada passo relevante rode `pnpm typecheck`. Commite ao completar cada grupo coerente.
8. Escreva os testes exigidos na seção "Testes". Rode `pnpm check` até ficar verde.
9. Passe pelos "Critérios de aceite" um a um e marque cada um como atendido, com uma linha de evidência (arquivo/teste).
10. Atualize `docs/PROGRESS.md` conforme o template do arquivo (status, arquivos-chave, decisões, dívidas, próximos passos, dependências novas).
11. Commit final: `chore(fatia-$ARGUMENTS): handoff`.
12. Faça merge fast-forward em `main` (`git checkout main && git merge --ff-only fatia/$ARGUMENTS`).

Não inicie a fatia seguinte. Se algo na spec estiver ambíguo, escolha a opção mais simples e segura, registre em PROGRESS em "Decisões desta fatia" e continue.
