"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { globalSearchAction } from "@/features/search/actions";
import type { GlobalSearchResult, SearchHit } from "@/features/search/service";
import { cn } from "@/lib/utils";

const EMPTY: GlobalSearchResult = { affiliates: [], products: [], orders: [] };
const DEBOUNCE_MS = 250;

/**
 * Busca global ⌘K / Ctrl+K no header admin.
 * Debounce chama `globalSearchAction`; seleção navega com `router.push`.
 */
export function CommandMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult>(EMPTY);
  const [pending, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const runSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 1) {
      setResults(EMPTY);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const id = ++requestId.current;
      startTransition(async () => {
        const result = await globalSearchAction({ q: trimmed });
        if (id !== requestId.current) return;
        if (!result.ok) {
          setResults(EMPTY);
          return;
        }
        setResults(result.data);
      });
    }, DEBOUNCE_MS);
  }, []);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setQuery("");
      setResults(EMPTY);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    runSearch(value);
  }

  const onSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  const hasAny =
    results.affiliates.length > 0 ||
    results.products.length > 0 ||
    results.orders.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-mist-300 bg-white px-3 text-sm text-muted-foreground",
          "transition-colors hover:border-mist-400 hover:text-navy-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/40",
        )}
        aria-label="Busca global"
      >
        <SearchIcon className="size-4 shrink-0 opacity-60" aria-hidden="true" />
        <span className="hidden sm:inline">Buscar…</span>
        <kbd className="pointer-events-none ml-1 hidden items-center gap-0.5 rounded border border-mist-300 bg-mist-100 px-1.5 font-mono text-[10px] font-medium text-navy-700 sm:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Busca global"
        description="Busque afiliados, produtos ou pedidos."
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Nome, e-mail, @handle, código, pedido…"
          value={query}
          onValueChange={handleQueryChange}
        />
        <CommandList>
          {query.trim().length === 0 ? (
            <CommandEmpty>Digite para buscar.</CommandEmpty>
          ) : !hasAny && !pending ? (
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
          ) : !hasAny && pending ? (
            <CommandEmpty>Buscando…</CommandEmpty>
          ) : (
            <>
              <ResultGroup
                heading="Afiliados"
                items={results.affiliates}
                onSelect={onSelect}
              />
              <ResultGroup
                heading="Produtos"
                items={results.products}
                onSelect={onSelect}
              />
              <ResultGroup heading="Pedidos" items={results.orders} onSelect={onSelect} />
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function ResultGroup({
  heading,
  items,
  onSelect,
}: {
  heading: string;
  items: SearchHit[];
  onSelect: (href: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => (
        <CommandItem
          key={item.id}
          value={`${heading}-${item.id}-${item.label}`}
          onSelect={() => {
            onSelect(item.href);
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{item.label}</div>
            {item.secondary ? (
              <div className="truncate text-xs text-muted-foreground">{item.secondary}</div>
            ) : null}
          </div>
        </CommandItem>
      ))}
    </CommandGroup>
  );
}
