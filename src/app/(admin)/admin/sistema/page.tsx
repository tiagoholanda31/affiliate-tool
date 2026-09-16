import { PageHeader } from "@/components/layout/page-header";
import { SistemaClient } from "@/features/system/components/sistema-client";
import {
  getJobScheduleStatus,
  listAuditLogs,
  listEmailLogs,
  listJobRuns,
  listWebhookEvents,
} from "@/features/system/queries";
import {
  listAuditFilterSchema,
  listEmailsFilterSchema,
  listWebhooksFilterSchema,
} from "@/features/system/schemas";

export const metadata = { title: "Sistema" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSistemaPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const tab = first(sp.tab) ?? "webhooks";
  const page = Number(first(sp.page) ?? "1") || 1;

  const webhookFilter = listWebhooksFilterSchema.safeParse({
    status: first(sp.webhookStatus),
    page,
  });
  const emailFilter = listEmailsFilterSchema.safeParse({
    status: first(sp.emailStatus),
    page,
  });
  const auditFilter = listAuditFilterSchema.safeParse({
    entity: first(sp.entity),
    action: first(sp.action),
    actorId: first(sp.actorId),
    page,
  });

  const [jobStatus, webhooks, emails, audits, jobRuns] = await Promise.all([
    getJobScheduleStatus(),
    listWebhookEvents({
      status: webhookFilter.success
        ? (webhookFilter.data.status)
        : undefined,
      page: tab === "webhooks" ? page : 1,
    }),
    listEmailLogs({
      status: emailFilter.success
        ? (emailFilter.data.status)
        : undefined,
      page: tab === "emails" ? page : 1,
    }),
    listAuditLogs({
      entity: auditFilter.success ? auditFilter.data.entity : undefined,
      action: auditFilter.success ? auditFilter.data.action : undefined,
      actorId: auditFilter.success ? auditFilter.data.actorId : undefined,
      page: tab === "auditoria" ? page : 1,
    }),
    listJobRuns({ page: tab === "jobs" ? page : 1 }),
  ]);

  return (
    <>
      <PageHeader
        title="Sistema"
        description="Webhooks, jobs de cron, e-mails e trilha de auditoria."
      />
      <SistemaClient
        tab={["webhooks", "jobs", "emails", "auditoria"].includes(tab) ? tab : "webhooks"}
        jobStatus={jobStatus}
        webhooks={webhooks}
        emails={emails}
        audits={audits}
        jobRuns={jobRuns}
        filters={{
          webhookStatus: first(sp.webhookStatus),
          emailStatus: first(sp.emailStatus),
          auditEntity: first(sp.entity),
          auditAction: first(sp.action),
        }}
      />
    </>
  );
}
