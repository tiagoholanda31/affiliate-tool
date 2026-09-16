"use client";

/**
 * Cliente do Better Auth para o browser.
 *
 * Usamos pouco: quase tudo passa por Server Action, que é onde a validação, o
 * rate limit e a auditoria acontecem. O cliente serve para o que precisa
 * acontecer sem recarregar a página — sair da conta e ler a sessão em
 * componentes interativos.
 */
import { createAuthClient } from "better-auth/react";

import { env } from "@/lib/env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_APP_URL,
});

export const { signOut, useSession } = authClient;
