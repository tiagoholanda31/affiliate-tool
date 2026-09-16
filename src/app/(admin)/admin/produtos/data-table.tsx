"use client";

import {
  Archive,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  archiveProduct,
  deleteProduct,
  publishProduct,
} from "@/features/products/actions";
import type { ProductListResult } from "@/features/products/queries";
import type { ProductStatus } from "@/generated/prisma/enums";
import { labelFor } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";
import { Package } from "lucide-react";

const statusTone: Record<ProductStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  DRAFT: "info",
  ACTIVE: "success",
  ARCHIVED: "neutral",
};

export function ProductsDataTable({ initial }: { initial: ProductListResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  function updateParams(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || value === "ALL") params.delete(key);
      else params.set(key, value);
    }
    if (!("page" in patch)) params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function onSearch(event: ChangeEvent<HTMLInputElement>) {
    setQ(event.target.value);
  }

  function submitSearch() {
    updateParams({ q: q.trim() || null, page: null });
  }

  function runAction(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? "Não foi possível concluir.");
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  const totalPages = Math.max(1, Math.ceil(initial.total / initial.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={onSearch}
            onKeyDown={(event) => {
              if (event.key === "Enter") submitSearch();
            }}
            placeholder="Buscar por nome ou slug"
            className="pl-9"
            aria-label="Buscar produtos"
          />
        </div>
        <Select
          value={searchParams.get("status") ?? "ALL"}
          onValueChange={(value) => { updateParams({ status: value, page: null }); }}
        >
          <SelectTrigger className="w-full md:w-44" aria-label="Filtrar por status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            <SelectItem value="DRAFT">Rascunhos</SelectItem>
            <SelectItem value="ACTIVE">Publicados</SelectItem>
            <SelectItem value="ARCHIVED">Arquivados</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={searchParams.get("type") ?? "ALL"}
          onValueChange={(value) => { updateParams({ type: value, page: null }); }}
        >
          <SelectTrigger className="w-full md:w-44" aria-label="Filtrar por tipo">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os tipos</SelectItem>
            <SelectItem value="SERVICE">Serviços</SelectItem>
            <SelectItem value="DIGITAL">Digitais</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant="secondary" onClick={submitSearch} disabled={pending}>
          Filtrar
        </Button>
      </div>

      {initial.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={searchParams.toString() ? "Nenhum resultado" : "Nenhum produto ainda"}
          description={
            searchParams.toString()
              ? "Ajuste os filtros ou limpe a busca."
              : "Cadastre o primeiro serviço ou livro digital."
          }
          action={
            <Link href="/admin/produtos/novo" className={cn(buttonVariants())}>
              Novo produto
            </Link>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-mist-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vendas</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initial.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link
                        href={`/admin/produtos/${item.id}`}
                        className="font-medium text-navy-900 underline-offset-2 hover:underline"
                      >
                        {item.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/{item.slug}</p>
                    </TableCell>
                    <TableCell>{labelFor("productType", item.type)}</TableCell>
                    <TableCell>
                      <MoneyText cents={item.priceCents} />
                    </TableCell>
                    <TableCell className="max-w-56 text-sm text-navy-700">
                      {item.commissionLabel}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={labelFor("productStatus", item.status)}
                        tone={statusTone[item.status]}
                      />
                    </TableCell>
                    <TableCell>{item.salesCount}</TableCell>
                    <TableCell>
                      <DateText date={item.updatedAt} />
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Ações de ${item.name}`}>
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/produtos/${item.id}`}>
                              <Pencil className="size-4" />
                              Editar
                            </Link>
                          </DropdownMenuItem>
                          {item.status !== "ACTIVE" ? (
                            <DropdownMenuItem
                              onClick={() => { runAction(
                                  () => publishProduct({ id: item.id }),
                                  "Produto publicado.",
                                ); }
                              }
                            >
                              <Upload className="size-4" />
                              Publicar
                            </DropdownMenuItem>
                          ) : null}
                          {item.status !== "ARCHIVED" ? (
                            <DropdownMenuItem
                              onClick={() => { runAction(
                                  () => archiveProduct({ id: item.id }),
                                  "Produto arquivado.",
                                ); }
                              }
                            >
                              <Archive className="size-4" />
                              Arquivar
                            </DropdownMenuItem>
                          ) : null}
                          <ConfirmDialog
                            trigger={
                              <DropdownMenuItem
                                onSelect={(event) => { event.preventDefault(); }}
                                className="text-[color:var(--color-danger)]"
                              >
                                <Trash2 className="size-4" />
                                Excluir
                              </DropdownMenuItem>
                            }
                            title="Excluir produto?"
                            description="Esta ação remove o produto permanentemente. Digite o nome para confirmar."
                            variant="destructive"
                            confirmLabel="Excluir"
                            typeToConfirm={item.name}
                            onConfirm={async () => {
                              const result = await deleteProduct({
                                id: item.id,
                                confirmName: item.name,
                              });
                              if (!result.ok) {
                                toast.error(result.error);
                                throw new Error(result.error);
                              }
                              toast.success("Produto excluído.");
                              router.refresh();
                            }}
                          />
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between gap-3 text-sm text-navy-700">
            <p>
              Página {initial.page} de {totalPages} · {initial.total} produto
              {initial.total === 1 ? "" : "s"}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={initial.page <= 1 || pending}
                onClick={() => { updateParams({ page: String(initial.page - 1) }); }}
              >
                <ChevronLeft className="size-4" />
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={initial.page >= totalPages || pending}
                onClick={() => { updateParams({ page: String(initial.page + 1) }); }}
              >
                Próxima
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
