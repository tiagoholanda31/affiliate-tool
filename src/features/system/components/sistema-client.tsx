"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { DateText } from "@/components/data-display/date-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reprocessWebhookAction, retryEmailAction } from "@/features/system/actions";
import type { JobStatusRow } from "@/features/system/queries";
import { labelFor } from "@/lib/i18n/pt-BR";
import { maskEmail } from "@/lib/crypto";

export type SistemaClientProps = {
  tab: string;
  jobStatus: JobStatusRow[];
  webhooks: {
    items: {
      id: string;
      eventId: string;
      type: string;
      status: "RECEIVED" | "PROCESSED" | "IGNORED" | "FAILED";
      error: string | null;
      receivedAt: Date;
      processedAt: Date | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
  emails: {
    items: {
      id: string;
      to: string;
      template: string;
      status: "QUEUED" | "SENT" | "FAILED";
      attempts: number;
      error: string | null;
      createdAt: Date;
      sentAt: Date | null;
      hasPayload: boolean;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
  audits: {
    items: {
      id: string;
      actorRole: string;
      actorName: string | null;
      action: string;
      entity: string;
      entityId: string;
      before: unknown;
      after: unknown;
      createdAt: Date;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
  jobRuns: {
    items: {
      id: string;
      name: string;
      startedAt: Date;
      finishedAt: Date | null;
      ok: boolean | null;
      error: string | null;
    }[];
    total: number;
    page: number;
    pageSize: number;
  };
  filters: {
    webhookStatus?: string;
    emailStatus?: string;
    auditEntity?: string;
    auditAction?: string;
  };
};

function toneForWebhook(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  if (status === "PROCESSED") return "success";
  if (status === "FAILED") return "danger";
  if (status === "RECEIVED") return "warning";
  return "neutral";
}

function toneForEmail(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "SENT") return "success";
  if (status === "FAILED") return "danger";
  return "warning";
}

function formatJsonDiff(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "—";
  }
}

function durationMs(startedAt: Date, finishedAt: Date | null): string {
  if (!finishedAt) return "—";
  const ms = finishedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${String(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function SistemaClient(props: SistemaClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function setTab(tab: string) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.push(`/admin/sistema?${params.toString()}`);
  }

  function reprocess(eventId: string) {
    startTransition(async () => {
      const result = await reprocessWebhookAction({ eventId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Webhook reprocessado.");
      router.refresh();
    });
  }

  function retryEmail(emailLogId: string) {
    startTransition(async () => {
      const result = await retryEmailAction({ emailLogId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("E-mail recolocado na fila.");
      router.refresh();
    });
  }

  return (
    <Tabs value={props.tab} onValueChange={setTab} className="space-y-4">
      <TabsList>
        <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        <TabsTrigger value="jobs">Jobs</TabsTrigger>
        <TabsTrigger value="emails">E-mails</TabsTrigger>
        <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
      </TabsList>

      <TabsContent value="webhooks" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["", "FAILED", "PROCESSED", "RECEIVED", "IGNORED"] as const).map((status) => (
            <Button
              key={status || "all"}
              size="sm"
              variant={
                (props.filters.webhookStatus ?? "") === status ? "default" : "outline"
              }
              asChild
            >
              <Link
                href={`/admin/sistema?tab=webhooks${status ? `&webhookStatus=${status}` : ""}`}
              >
                {status ? labelFor("webhookStatus", status) : "Todos"}
              </Link>
            </Button>
          ))}
        </div>
        <div className="rounded-lg bg-white shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Recebido</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.webhooks.items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Nenhum webhook neste filtro.
                  </TableCell>
                </TableRow>
              ) : (
                props.webhooks.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <DateText date={row.receivedAt} format="relative" />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.type}</TableCell>
                    <TableCell className="max-w-[140px] truncate font-mono text-xs" title={row.eventId}>
                      {row.eventId}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={labelFor("webhookStatus", row.status)}
                        tone={toneForWebhook(row.status)}
                      />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {row.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => { reprocess(row.eventId); }}
                      >
                        Reprocessar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager
          base={`/admin/sistema?tab=webhooks${props.filters.webhookStatus ? `&webhookStatus=${props.filters.webhookStatus}` : ""}`}
          page={props.webhooks.page}
          pageSize={props.webhooks.pageSize}
          total={props.webhooks.total}
        />
      </TabsContent>

      <TabsContent value="jobs" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {props.jobStatus.map((job) => (
            <div
              key={job.name}
              className={
                job.overdue
                  ? "rounded-lg border border-danger/40 bg-danger/5 p-4 shadow-card"
                  : "rounded-lg bg-white p-4 shadow-card"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-medium text-navy-900">{job.label}</h3>
                {job.overdue ? (
                  <StatusBadge label="Atrasado" tone="danger" />
                ) : job.lastOk === false ? (
                  <StatusBadge label="Erro" tone="danger" />
                ) : job.lastOk === true ? (
                  <StatusBadge label="Ok" tone="success" />
                ) : (
                  <StatusBadge label="Sem execução" tone="neutral" />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Última execução: {job.relativeLabel}
              </p>
              {job.lastError ? (
                <p className="mt-1 truncate text-xs text-danger" title={job.lastError}>
                  {job.lastError}
                </p>
              ) : null}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-white shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Início</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.jobRuns.items.map((run) => (
                <TableRow key={run.id}>
                  <TableCell>
                    <DateText date={run.startedAt} format="datetime" />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{run.name}</TableCell>
                  <TableCell data-tabular>{durationMs(run.startedAt, run.finishedAt)}</TableCell>
                  <TableCell>
                    {run.ok === true ? (
                      <StatusBadge label="Ok" tone="success" />
                    ) : run.ok === false ? (
                      <StatusBadge label="Erro" tone="danger" />
                    ) : (
                      <StatusBadge label="Em andamento" tone="warning" />
                    )}
                  </TableCell>
                  <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                    {run.error ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager base="/admin/sistema?tab=jobs" page={props.jobRuns.page} pageSize={props.jobRuns.pageSize} total={props.jobRuns.total} />
      </TabsContent>

      <TabsContent value="emails" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["", "FAILED", "QUEUED", "SENT"] as const).map((status) => (
            <Button
              key={status || "all"}
              size="sm"
              variant={(props.filters.emailStatus ?? "") === status ? "default" : "outline"}
              asChild
            >
              <Link href={`/admin/sistema?tab=emails${status ? `&emailStatus=${status}` : ""}`}>
                {status ? labelFor("emailStatus", status) : "Todos"}
              </Link>
            </Button>
          ))}
        </div>
        <div className="rounded-lg bg-white shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criado</TableHead>
                <TableHead>Para</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.emails.items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <DateText date={row.createdAt} format="relative" />
                  </TableCell>
                  <TableCell className="text-sm">{maskEmail(row.to)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.template}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={labelFor("emailStatus", row.status)}
                      tone={toneForEmail(row.status)}
                      hint={row.error ?? undefined}
                    />
                  </TableCell>
                  <TableCell data-tabular>{row.attempts}</TableCell>
                  <TableCell className="text-right">
                    {row.hasPayload && row.status !== "SENT" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => { retryEmail(row.id); }}
                      >
                        Reenviar
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <Pager
          base={`/admin/sistema?tab=emails${props.filters.emailStatus ? `&emailStatus=${props.filters.emailStatus}` : ""}`}
          page={props.emails.page}
          pageSize={props.emails.pageSize}
          total={props.emails.total}
        />
      </TabsContent>

      <TabsContent value="auditoria" className="space-y-4">
        <form className="flex flex-wrap gap-2" method="get">
          <input type="hidden" name="tab" value="auditoria" />
          <Input
            name="entity"
            placeholder="Entidade"
            defaultValue={props.filters.auditEntity ?? ""}
            className="max-w-[160px]"
          />
          <Input
            name="action"
            placeholder="Ação"
            defaultValue={props.filters.auditAction ?? ""}
            className="max-w-[200px]"
          />
          <Button type="submit" size="sm">
            Filtrar
          </Button>
        </form>
        <div className="space-y-3">
          {props.audits.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro neste filtro.</p>
          ) : (
            props.audits.items.map((row) => (
              <details key={row.id} className="rounded-lg bg-white p-4 shadow-card">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-navy-900">{row.action}</span>
                    <DateText date={row.createdAt} format="relative" className="text-xs text-muted-foreground" />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.actorName ?? row.actorRole} · {row.entity}/{row.entityId}
                  </p>
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <pre className="overflow-auto rounded-md bg-mist-100 p-3 text-xs">
                    <div className="mb-1 font-medium text-muted-foreground">Antes</div>
                    {formatJsonDiff(row.before)}
                  </pre>
                  <pre className="overflow-auto rounded-md bg-mist-100 p-3 text-xs">
                    <div className="mb-1 font-medium text-muted-foreground">Depois</div>
                    {formatJsonDiff(row.after)}
                  </pre>
                </div>
              </details>
            ))
          )}
        </div>
        <Pager
          base={`/admin/sistema?tab=auditoria${props.filters.auditEntity ? `&entity=${encodeURIComponent(props.filters.auditEntity)}` : ""}${props.filters.auditAction ? `&action=${encodeURIComponent(props.filters.auditAction)}` : ""}`}
          page={props.audits.page}
          pageSize={props.audits.pageSize}
          total={props.audits.total}
        />
      </TabsContent>
    </Tabs>
  );
}

function Pager({
  base,
  page,
  pageSize,
  total,
}: {
  base: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const sep = base.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Página {page} de {pages} ({total} itens)
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`${base}${sep}page=${String(page - 1)}`}>Anterior</Link>
          </Button>
        ) : null}
        {page < pages ? (
          <Button size="sm" variant="outline" asChild>
            <Link href={`${base}${sep}page=${String(page + 1)}`}>Próxima</Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
