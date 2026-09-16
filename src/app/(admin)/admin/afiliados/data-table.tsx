"use client";

import {
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  MoreHorizontal,
  Search,
  ShieldCheck,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ChangeEvent } from "react";
import { toast } from "sonner";

import {
  approveAffiliate,
  bulkApproveAffiliates,
  reactivateAffiliate,
  removeAffiliate,
  suspendAffiliate,
} from "@/features/affiliates/admin-actions";
import type { AffiliateListResult, AffiliateListSortBy, AffiliateListSortDir } from "@/features/affiliates/admin-queries";
import type { AffiliateStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/data-display/status-badge";
import { DateText } from "@/components/data-display/date-text";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
import { labelFor } from "@/lib/i18n/pt-BR";
import { cn } from "@/lib/utils";

type StatusOption = {
  value: AffiliateListResult["statusCounts"] extends infer R ? keyof R : never;
  label: string;
};

type SortOption = {
  value: `${AffiliateListSortBy}-${AffiliateListSortDir}`;
  label: string;
};

const STATUS_OPTIONS: StatusOption[] = [
  { value: "ALL", label: "Todos" },
  { value: "PENDING", label: "Em análise" },
  { value: "APPROVED", label: "Aprovados" },
  { value: "REJECTED", label: "Reprovados" },
  { value: "SUSPENDED", label: "Suspensos" },
  { value: "REMOVED", label: "Removidos" },
];

const SORT_OPTIONS: SortOption[] = [
  { value: "createdAt-desc", label: "Mais recentes" },
  { value: "createdAt-asc", label: "Mais antigos" },
  { value: "name-asc", label: "Nome A–Z" },
  { value: "status-asc", label: "Status" },
];

const statusTone: Record<AffiliateStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "neutral",
  REMOVED: "neutral",
};

function isValidStatus(value: string): value is AffiliateListResult["statusCounts"] extends infer R ? keyof R : never {
  return STATUS_OPTIONS.some((option) => option.value === value);
}

function parseSort(value: string): { sortBy: AffiliateListSortBy; sortDir: AffiliateListSortDir } {
  const [sortBy, sortDir] = value.split("-");
  return {
    sortBy: sortBy as AffiliateListSortBy,
    sortDir: sortDir as AffiliateListSortDir,
  };
}

export type AffiliatesDataTableProps = {
  initial: AffiliateListResult;
};

export function AffiliatesDataTable({ initial }: AffiliatesDataTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const data = initial;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const rawStatus = searchParams.get("status");
  const status = rawStatus && isValidStatus(rawStatus) ? rawStatus : "ALL";
  const q = searchParams.get("q") ?? "";
  const page = Number(searchParams.get("page") ?? "1");
  const rawSortBy = searchParams.get("sortBy");
  const rawSortDir = searchParams.get("sortDir");
  const sortValue = rawSortBy && rawSortDir ? `${rawSortBy}-${rawSortDir}` : "createdAt-desc";

  function updateParams(updates: Record<string, string | undefined>): void {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined || value === "" || value === "ALL") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    // Qualquer mudança de filtro volta à primeira página.
    if ("status" in updates || "q" in updates || "sortBy" in updates) {
      params.delete("page");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function handleSearch(event: ChangeEvent<HTMLInputElement>): void {
    updateParams({ q: event.target.value, page: undefined });
  }

  function handleStatusChange(value: string): void {
    updateParams({ status: value === "ALL" ? undefined : value });
  }

  function handleSortChange(value: string): void {
    const { sortBy, sortDir } = parseSort(value);
    updateParams({ sortBy, sortDir });
  }

  function handlePageChange(nextPage: number): void {
    updateParams({ page: String(nextPage) });
  }

  function toggleSelect(id: string): void {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    const allSelected = data.items.every((item) => selected.has(item.id));
    setSelected((previous) => {
      const next = new Set(previous);
      for (const item of data.items) {
        if (allSelected) next.delete(item.id);
        else next.add(item.id);
      }
      return next;
    });
  }

  async function runApprove(id: string): Promise<void> {
    const result = await approveAffiliate({ affiliateId: id });
    if (result.ok) {
      toast.success("Afiliado aprovado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runBulkApprove(): Promise<void> {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    const result = await bulkApproveAffiliates({ ids });
    if (result.ok) {
      toast.success(`${String(result.data.processed)} afiliado(s) aprovado(s).`);
      if (result.data.failed > 0) {
        toast.error(`${String(result.data.failed)} não puderam ser aprovados.`);
      }
      setSelected(new Set());
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runSuspend(id: string, reason: string): Promise<void> {
    const result = await suspendAffiliate({ affiliateId: id, reason });
    if (result.ok) {
      toast.success("Afiliado suspenso.", {
        duration: 10_000,
        action: {
          label: "Desfazer",
          onClick: () => {
            void runReactivate(id);
          },
        },
      });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runReactivate(id: string): Promise<void> {
    const result = await reactivateAffiliate({ affiliateId: id });
    if (result.ok) {
      toast.success("Afiliado reativado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runRemove(id: string, name: string, reason: string): Promise<void> {
    const result = await removeAffiliate({ affiliateId: id, reason });
    if (result.ok) {
      toast.success("Afiliado removido.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-card sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            placeholder="Buscar por nome, e-mail, @ ou código"
            defaultValue={q}
            onChange={handleSearch}
            className="pl-9"
            aria-label="Buscar afiliados"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-44" aria-label="Filtrar por status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} ({data.statusCounts[option.value]})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="w-40" aria-label="Ordenar">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-md bg-gold-100 px-4 py-2 text-sm">
          <span className="text-navy-900">
            {selected.size} selecionado{selected.size > 1 ? "s" : ""}
          </span>
          <ConfirmDialog
            trigger={
              <Button size="sm" disabled={isPending}>
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Aprovar selecionados
              </Button>
            }
            title="Aprovar afiliados selecionados"
            description={`Você está prestes a aprovar ${String(selected.size)} cadastro(s). Cada um receberá o e-mail de boas-vindas com o código de afiliado.`}
            onConfirm={() => { void runBulkApprove(); }}
          />
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg bg-white shadow-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos da página"
                    checked={data.items.length > 0 && data.items.every((item) => selected.has(item.id))}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Cliques 30d</TableHead>
                <TableHead>Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                    {q || status !== "ALL"
                      ? "Nenhum resultado para os filtros aplicados."
                      : "Nenhum afiliado cadastrado ainda."}
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar ${item.name}`}
                        checked={selected.has(item.id)}
                        onChange={() => {
                          toggleSelect(item.id);
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium text-navy-900">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {labelFor("socialNetwork", item.socialNetwork)} · @{item.socialHandle}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={labelFor("affiliateStatus", item.status)}
                        tone={statusTone[item.status]}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.code ?? "—"}</TableCell>
                    <TableCell className="text-right" data-tabular>
                      {new Intl.NumberFormat("pt-BR").format(item.clicks30d)}
                    </TableCell>
                    <TableCell>
                      <DateText date={item.createdAt} format="relative" />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === "PENDING" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => {
                              void runApprove(item.id);
                            }}
                          >
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            Aprovar
                          </Button>
                        ) : null}
                        <Link
                          href={`/admin/afiliados/${item.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        >
                          <Eye className="size-4" aria-hidden="true" />
                          Detalhe
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Mais ações para ${item.name}`}>
                              <MoreHorizontal className="size-4" aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status === "APPROVED" ? (
                              <ReasonDialog
                                trigger={
                                  <DropdownMenuItem onSelect={(event) => { event.preventDefault(); }}>
                                    <Ban className="size-4" aria-hidden="true" />
                                    Suspender
                                  </DropdownMenuItem>
                                }
                                title="Suspender afiliado"
                                description={`${item.name} não poderá gerar novas atribuições, mas links antigos continuam funcionando. Os afiliados logados serão deslogados.`}
                                confirmLabel="Suspender"
                                variant="destructive"
                                onConfirm={(reason) => { void runSuspend(item.id, reason); }}
                              />
                            ) : null}
                            {item.status === "SUSPENDED" ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  void runReactivate(item.id);
                                }}
                              >
                                <ShieldCheck className="size-4" aria-hidden="true" />
                                Reativar
                              </DropdownMenuItem>
                            ) : null}
                            {item.status !== "REMOVED" ? (
                              <ReasonDialog
                                trigger={
                                  <DropdownMenuItem
                                    className="text-danger focus:text-danger focus:bg-danger-bg"
                                    onSelect={(event) => { event.preventDefault(); }}
                                  >
                                    <UserX className="size-4" aria-hidden="true" />
                                    Remover
                                  </DropdownMenuItem>
                                }
                                title="Remover afiliado"
                                description={`A remoção encerra a sessão e, em 30 dias, anonimiza os dados pessoais de ${item.name}.`}
                                confirmLabel="Remover"
                                variant="destructive"
                                minLength={10}
                                onConfirm={(reason) => { void runRemove(item.id, item.name, reason); }}
                              />
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-mist-300 px-4 py-3">
            <div className="text-sm text-muted-foreground">
              Página {page} de {totalPages} · {data.total} resultado{data.total === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => { handlePageChange(page - 1); }}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => { handlePageChange(page + 1); }}
              >
                Próxima
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
