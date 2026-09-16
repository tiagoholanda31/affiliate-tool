"use client";

import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/features/auth/actions";

export type UserMenuProps = {
  name: string;
  email: string;
  /** `/painel/perfil` para o afiliado; o admin ainda não tem tela de perfil. */
  profileHref?: string;
};

/** Iniciais para o avatar: `Maria Souza` → `MS`. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function UserMenu({ name, email, profileHref }: UserMenuProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 gap-2 px-2"
          aria-label={`Conta de ${name}`}
          disabled={isPending}
        >
          <Avatar className="size-7">
            <AvatarFallback className="bg-navy-900 text-xs text-white">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
            {name}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-navy-900">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {profileHref ? (
          <DropdownMenuItem asChild>
            <Link href={profileHref}>
              <UserIcon className="size-4" aria-hidden="true" />
              Meu perfil
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem
          onSelect={() => {
            // Server Action: encerra a sessão no banco e apaga o cookie. Sair só
            // no client deixaria a sessão viva do lado do servidor.
            startTransition(() => {
              void signOutAction();
            });
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {isPending ? "Saindo…" : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
