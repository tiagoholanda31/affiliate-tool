---
description: Encerra a sessão atualizando PROGRESS.md e commitando
allowed-tools: Read, Edit, Bash(pnpm:*), Bash(git:*)
---

Encerre a sessão atual com handoff completo:

1. Rode `pnpm check`. Se falhar, corrija antes de continuar (ou registre como dívida se for fora do escopo).
2. Atualize `docs/PROGRESS.md`:
   - Tabela de fatias: status da fatia atual (`DONE`, `PARTIAL` ou `BLOCKED` com motivo)
   - "Estado atual": 5–10 linhas do que existe hoje e funciona
   - "Arquivos-chave desta fatia": lista curta com o papel de cada um
   - "Decisões desta fatia": o que foi decidido que não estava na spec
   - "Dívidas técnicas": itens abertos, com fatia sugerida para resolver
   - "Dependências adicionadas": pacote + motivo (uma linha cada)
   - "Próxima fatia": número e o que a próxima sessão deve saber antes de começar
3. `git add -A && git commit -m "chore(fatia-NN): handoff"` (substitua NN).
4. Me mostre um resumo de 5 linhas do que foi feito e o que fica para a próxima sessão.
