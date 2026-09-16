"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Copy, MousePointerClick, ShieldCheck, UserX, Eye, Lock, Smartphone } from "lucide-react";

import {
  approveAffiliate,
  anonymizeAffiliate,
  reactivateAffiliate,
  removeAffiliate,
  rejectAffiliate,
  revealPixKey,
  suspendAffiliate,
  updateAffiliateCode,
} from "@/features/affiliates/admin-actions";
import type { AffiliateAuditEntry, AffiliateDetail } from "@/features/affiliates/admin-queries";
import type { AffiliateBalances } from "@/features/commissions/service";
import { CreateAdjustmentForm } from "@/features/payouts/components/create-adjustment-form";
import { GeneratePayoutButton } from "@/features/payouts/components/generate-payout-button";
import type { AffiliateStatus } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/data-display/status-badge";
import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { KpiCard } from "@/components/data-display/kpi-card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/money";
import { labelFor } from "@/lib/i18n/pt-BR";
import Link from "next/link";
const statusTone: Record<AffiliateStatus, Parameters<typeof StatusBadge>[0]["tone"]> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "neutral",
  REMOVED: "neutral",
};

const TABS = [
  { value: "dados", label: "Dados" },
  { value: "vendas", label: "Vendas" },
  { value: "comissoes", label: "Comissões" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "auditoria", label: "Auditoria" },
];

export type AffiliateDetailPageProps = {
  affiliate: AffiliateDetail;
  auditLog: AffiliateAuditEntry[];
  orders: {
    id: string;
    publicCode: string;
    productNameSnap: string;
    amountCents: number;
    status: string;
    createdAt: Date;
    paidAt: Date | null;
    product: { name: string };
    commission: { amountCents: number; status: string; availableAt: Date } | null;
  }[];
  commissions: {
    id: string;
    amountCents: number;
    baseAmountCents: number;
    status: string;
    availableAt: Date;
    order: { publicCode: string; productNameSnap: string; id: string };
  }[];
  balances: AffiliateBalances;
  payouts: {
    id: string;
    status: string;
    totalCents: number;
    referenceMonth: string;
    paidAt: Date | null;
    createdAt: Date;
    proofPath: string | null;
  }[];
};

export function AffiliateDetailPage({
  affiliate,
  auditLog,
  orders,
  commissions,
  balances,
  payouts,
}: AffiliateDetailPageProps) {
  const router = useRouter();
  const [revealedPix, setRevealedPix] = useState<string | null>(null);
  const [newCode, setNewCode] = useState(affiliate.code ?? "");

  async function runApprove(): Promise<void> {
    const result = await approveAffiliate({ affiliateId: affiliate.id });
    if (result.ok) {
      toast.success("Afiliado aprovado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runReject(reason: string): Promise<void> {
    const result = await rejectAffiliate({ affiliateId: affiliate.id, reason });
    if (result.ok) {
      toast.success("Afiliado reprovado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runSuspend(reason: string): Promise<void> {
    const result = await suspendAffiliate({ affiliateId: affiliate.id, reason });
    if (result.ok) {
      toast.success("Afiliado suspenso.", {
        duration: 10_000,
        action: {
          label: "Desfazer",
          onClick: () => {
            void runReactivate();
          },
        },
      });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runReactivate(): Promise<void> {
    const result = await reactivateAffiliate({ affiliateId: affiliate.id });
    if (result.ok) {
      toast.success("Afiliado reativado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runRemove(reason: string): Promise<void> {
    const result = await removeAffiliate({ affiliateId: affiliate.id, reason });
    if (result.ok) {
      toast.success("Afiliado removido.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runRevealPix(): Promise<void> {
    const result = await revealPixKey({ affiliateId: affiliate.id });
    if (result.ok) {
      setRevealedPix(result.data.pixKey);
      toast.success("Chave Pix revelada.");
    } else {
      toast.error(result.error);
    }
  }

  async function runUpdateCode(): Promise<void> {
    const result = await updateAffiliateCode({ affiliateId: affiliate.id, code: newCode });
    if (result.ok) {
      toast.success(`Código alterado para ${result.data.newCode}.`);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  async function runAnonymize(): Promise<void> {
    const result = await anonymizeAffiliate({ affiliateId: affiliate.id });
    if (result.ok) {
      toast.success("Afiliado anonimizado.");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  function whatsappLink(): string {
    const digits = affiliate.phone.replace(/\D/g, "");
    return `https://wa.me/${digits}`;
  }

  function socialLink(): string | null {
    const handle = affiliate.socialHandle;
    switch (affiliate.socialNetwork) {
      case "INSTAGRAM":
        return `https://instagram.com/${handle}`;
      case "TIKTOK":
        return `https://tiktok.com/@${handle}`;
      case "YOUTUBE":
        return `https://youtube.com/@${handle}`;
      case "FACEBOOK":
        return `https://facebook.com/${handle}`;
      case "LINKEDIN":
        return `https://linkedin.com/in/${handle}`;
      case "WHATSAPP":
        return `https://wa.me/${handle}`;
      default:
        return null;
    }
  }

  const contextualActions = (
    <div className="flex flex-wrap items-center gap-2">
      {affiliate.status === "PENDING" ? (
        <Button onClick={() => void runApprove()}>
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Aprovar
        </Button>
      ) : null}
      {affiliate.status === "PENDING" ? (
        <ReasonDialog
          trigger={<Button variant="outline">Reprovar</Button>}
          title="Reprovar cadastro"
          description={`${affiliate.name} poderá corrigir os dados e reenviar o cadastro.`}
          confirmLabel="Reprovar"
          variant="destructive"
          onConfirm={runReject}
        />
      ) : null}
      {affiliate.status === "APPROVED" ? (
        <ReasonDialog
          trigger={
            <Button variant="outline">
              <Ban className="size-4" aria-hidden="true" />
              Suspender
            </Button>
          }
          title="Suspender afiliado"
          description="O afiliado será deslogado e seus links não gerarão novas atribuições."
          confirmLabel="Suspender"
          variant="destructive"
          onConfirm={runSuspend}
        />
      ) : null}
      {affiliate.status === "SUSPENDED" ? (
        <Button onClick={() => void runReactivate()}>
          <ShieldCheck className="size-4" aria-hidden="true" />
          Reativar
        </Button>
      ) : null}
      {affiliate.status !== "REMOVED" ? (
        <ReasonDialog
          trigger={
            <Button variant="outline" className="text-danger hover:text-danger hover:bg-danger-bg">
              <UserX className="size-4" aria-hidden="true" />
              Remover
            </Button>
          }
          title="Remover afiliado"
          description={`${affiliate.name} será deslogado e seus dados pessoais serão anonimizados em 30 dias.`}
          confirmLabel="Remover"
          variant="destructive"
          onConfirm={runRemove}
        />
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={affiliate.name}
        eyebrow={
          <div className="flex items-center gap-2">
            <StatusBadge
              label={labelFor("affiliateStatus", affiliate.status)}
              tone={statusTone[affiliate.status]}
            />
            {affiliate.code ? (
              <span className="font-mono text-xs text-muted-foreground">{affiliate.code}</span>
            ) : null}
          </div>
        }
        actions={contextualActions}
      />

      <Tabs defaultValue="dados" className="space-y-4">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dados" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label="Cliques (30 dias)"
              value={new Intl.NumberFormat("pt-BR").format(affiliate.clicks30d)}
              icon={MousePointerClick}
              hint="excluindo bots"
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Contato</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">E-mail</Label>
                  <p className="text-sm font-medium text-navy-900">{affiliate.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Celular</Label>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-navy-900">{affiliate.phone}</p>
                    <a
                      href={whatsappLink()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline"
                    >
                      <Smartphone className="size-3" aria-hidden="true" />
                      WhatsApp
                    </a>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rede social</Label>
                  <div className="text-sm font-medium text-navy-900">
                    {labelFor("socialNetwork", affiliate.socialNetwork)} · @{affiliate.socialHandle}
                  </div>
                  {socialLink() ? (
                    <a
                      href={socialLink() ?? ""}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-700 hover:underline"
                    >
                      Abrir perfil
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Chave Pix</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <p className="text-sm font-medium text-navy-900">
                    {labelFor("pixKeyType", affiliate.pixKeyType)}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Chave</Label>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-mist-100 px-2 py-1 text-sm font-medium text-navy-900">
                      {revealedPix ?? affiliate.pixKeyMasked}
                    </code>
                    {revealedPix ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Copiar chave Pix"
                        onClick={() => {
                          void navigator.clipboard.writeText(revealedPix).then(() => {
                            toast.success("Copiado!");
                          });
                        }}
                      >
                        <Copy className="size-3" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => void runRevealPix()}>
                        <Eye className="size-4" aria-hidden="true" />
                        Revelar
                      </Button>
                    )}
                  </div>
                  {revealedPix ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Revelação registrada na auditoria.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Termos e cadastro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 md:grid-cols-3">
                <div>
                  <span className="text-muted-foreground">Versão dos termos:</span>{" "}
                  <strong className="text-navy-900">{affiliate.termsVersion}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Aceito em:</span>{" "}
                  <strong className="text-navy-900">
                    <DateText date={affiliate.termsAcceptedAt} format="datetime" />
                  </strong>
                </div>
                <div>
                  <span className="text-muted-foreground">IP:</span>{" "}
                  <strong className="text-navy-900">{affiliate.termsIp}</strong>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Cadastro criado:</span>{" "}
                <strong className="text-navy-900">
                  <DateText date={affiliate.createdAt} format="datetime" />
                </strong>
              </div>
              {affiliate.anonymizedAt ? (
                <div>
                  <span className="text-muted-foreground">Anonimizado em:</span>{" "}
                  <strong className="text-navy-900">
                    <DateText date={affiliate.anonymizedAt} format="datetime" />
                  </strong>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Código de afiliado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={newCode}
                  onChange={(event) => {
                    setNewCode(event.target.value.toLowerCase());
                  }}
                  disabled={affiliate.codeEditedAt !== null}
                  className="font-mono max-w-xs"
                  aria-label="Código de afiliado"
                />
                <Button
                  onClick={() => void runUpdateCode()}
                  disabled={affiliate.codeEditedAt !== null || newCode === (affiliate.code ?? "")}
                >
                  <Lock className="size-4" aria-hidden="true" />
                  {affiliate.codeEditedAt ? "Já alterado" : "Salvar"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                O código pode ser alterado uma única vez para vaidade. Use letras minúsculas, números e hífen.
              </p>
            </CardContent>
          </Card>

          {affiliate.status === "REMOVED" && !affiliate.anonymizedAt ? (
            <Card className="border-danger">
              <CardHeader>
                <CardTitle className="font-display text-lg text-danger">Anonimizar dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Remove nome, e-mail, telefone, redes sociais e chave Pix. Os dados financeiros
                  permanecem vinculados ao ID para histórico contábil.
                </p>
                <ConfirmDialog
                  trigger={<Button variant="destructive">Anonimizar agora</Button>}
                  title="Anonimizar afiliado"
                  description="Esta ação apaga dados pessoais e não pode ser desfeita. Continuar?"
                  confirmLabel="Anonimizar"
                  variant="destructive"
                  onConfirm={runAnonymize}
                />
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="vendas">
          {orders.length === 0 ? (
            <EmptyState
              title="Nenhuma venda"
              description="Este afiliado ainda não tem pedidos atribuídos."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Comissão</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <Link
                            href={`/admin/vendas/${order.id}`}
                            className="text-teal-700 underline-offset-2 hover:underline"
                          >
                            {order.publicCode}
                          </Link>
                        </TableCell>
                        <TableCell>{order.productNameSnap}</TableCell>
                        <TableCell>
                          <MoneyText cents={order.amountCents} />
                        </TableCell>
                        <TableCell>
                          {order.commission ? (
                            <MoneyText cents={order.commission.amountCents} />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>{labelFor("orderStatus", order.status)}</TableCell>
                        <TableCell>
                          <DateText date={order.paidAt ?? order.createdAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comissoes">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <KpiCard label="Pendente" value={formatBRL(balances.pendingCents)} />
            <KpiCard label="Disponível" value={formatBRL(balances.availableCents)} variant="gold" />
            <KpiCard label="Pago" value={formatBRL(balances.paidCents)} />
          </div>
          {commissions.length === 0 ? (
            <EmptyState
              title="Nenhuma comissão"
              description="Comissões aparecem quando há venda paga atribuída."
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Base</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Libera em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commissions.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            href={`/admin/vendas/${c.order.id}`}
                            className="text-teal-700 underline-offset-2 hover:underline"
                          >
                            {c.order.publicCode}
                          </Link>
                        </TableCell>
                        <TableCell>{c.order.productNameSnap}</TableCell>
                        <TableCell>
                          <MoneyText cents={c.baseAmountCents} />
                        </TableCell>
                        <TableCell>
                          <MoneyText cents={c.amountCents} />
                        </TableCell>
                        <TableCell>{labelFor("commissionStatus", c.status)}</TableCell>
                        <TableCell>
                          <DateText date={c.availableAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pagamentos" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Disponível agora: <MoneyText cents={balances.availableCents} />
            </p>
            {balances.availableCents > 0 ? (
              <GeneratePayoutButton affiliateId={affiliate.id} />
            ) : null}
          </div>

          <CreateAdjustmentForm affiliateId={affiliate.id} />

          {payouts.length === 0 ? (
            <EmptyState
              title="Nenhum lote ainda"
              description="Gere um lote quando houver saldo disponível."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-lg">Lotes</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payouts.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Link
                            href={`/admin/pagamentos/${p.id}`}
                            className="text-teal-700 hover:underline"
                          >
                            {p.referenceMonth}
                          </Link>
                        </TableCell>
                        <TableCell>{labelFor("payoutStatus", p.status)}</TableCell>
                        <TableCell className="text-right">
                          <MoneyText cents={p.totalCents} />
                        </TableCell>
                        <TableCell>
                          <DateText date={p.paidAt ?? p.createdAt} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="auditoria">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg">Trilha de auditoria</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLog.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ação</TableHead>
                      <TableHead>Quem</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Depois</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium text-navy-900">{entry.action}</TableCell>
                        <TableCell>
                          {entry.actorName ?? "Sistema"} ({entry.actorRole})
                        </TableCell>
                        <TableCell>
                          <DateText date={entry.createdAt} format="datetime" />
                        </TableCell>
                        <TableCell>
                          <pre className="text-xs text-muted-foreground">
                            {JSON.stringify(entry.before, null, 2)}
                          </pre>
                        </TableCell>
                        <TableCell>
                          <pre className="text-xs text-muted-foreground">
                            {JSON.stringify(entry.after, null, 2)}
                          </pre>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
