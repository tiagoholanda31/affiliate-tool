"use client";

import { Coins, Link2, MousePointerClick, Wallet } from "lucide-react";

import { DateText } from "@/components/data-display/date-text";
import { KpiCard } from "@/components/data-display/kpi-card";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ReasonDialog } from "@/components/feedback/reason-dialog";
import { CopyButton } from "@/components/forms/copy-button";
import { MaskedInput } from "@/components/forms/masked-input";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CONTRAST_PAIRS } from "@/lib/design-tokens";

/**
 * Catálogo visual dos componentes base — "storybook" leve.
 *
 * É Client Component porque os diálogos de demonstração recebem handlers;
 * quem decide se a página existe é `page.tsx`, do lado do servidor.
 */
export function UiCatalog({ agora, ontem }: { agora: Date; ontem: Date }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-12 px-4 py-10 sm:px-6">
      <PageHeader
        title="Componentes"
        eyebrow={<Badge variant="secondary">apenas em desenvolvimento</Badge>}
        description="Catálogo dos componentes base do design system, com os estados que a spec exige."
        actions={<Button variant="outline">Ação secundária</Button>}
      />

      <Section title="Paleta e contraste" description="Pares verificados para AA (docs/spec/05).">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CONTRAST_PAIRS.map((pair) => (
            <div
              key={pair.name}
              className="flex items-center justify-between gap-3 rounded-md border border-mist-300 p-3"
              style={{ background: pair.background, color: pair.foreground }}
            >
              <span className={pair.large ? "text-lg font-medium" : "text-sm"}>{pair.name}</span>
              <span className="rounded bg-white/90 px-1.5 py-0.5 text-xs font-medium text-navy-900">
                {pair.ratio.toFixed(2)}:1
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Botões" description="Variantes, tamanhos e estados.">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Destrutivo</Button>
          <Button variant="link">Link</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Pequeno</Button>
          <Button>Padrão</Button>
          <Button size="lg">Grande</Button>
          <Button disabled>Desabilitado</Button>
          <Button variant="outline" disabled>
            Desabilitado
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Passe o mouse e navegue com Tab para conferir hover e o anel de foco (teal-700).
        </p>
      </Section>

      <Section title="Status" description="Sempre ícone + cor + texto.">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge label="Aguardando" tone="warning" hint="libera em 12/09" />
          <StatusBadge label="Aprovado" tone="success" />
          <StatusBadge label="Reprovado" tone="danger" />
          <StatusBadge label="Suspenso" tone="neutral" />
          <StatusBadge label="Rascunho" tone="info" />
        </div>
      </Section>

      <Section title="Indicadores" description="KpiCard, MoneyText e DateText.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Saldo disponível"
            value={<MoneyText cents={128790} variant="highlight" />}
            hint="Próximo pagamento em 10/10"
            icon={Wallet}
            variant="gold"
          />
          <KpiCard
            label="Cliques (30 dias)"
            value="1.284"
            icon={MousePointerClick}
            trend={{ value: 1240, label: "vs. mês anterior" }}
          />
          <KpiCard
            label="Vendas (30 dias)"
            value="37"
            icon={Coins}
            trend={{ value: -820, label: "vs. mês anterior" }}
          />
          <KpiCard label="Links ativos" value="8" icon={Link2} hint="4 produtos, 4 gerais" />
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span>
            Padrão: <MoneyText cents={123456} />
          </span>
          <span>
            Estorno: <MoneyText cents={-2500} />
          </span>
          <span>
            Com sinal: <MoneyText cents={4998} showSign />
          </span>
          <span>
            Relativa: <DateText date={ontem} format="relative" />
          </span>
          <span>
            Absoluta: <DateText date={agora} format="datetime" />
          </span>
        </div>
      </Section>

      <Section title="Formulários" description="Campos, máscaras pt-BR e controles.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="campo-nome">Nome</Label>
            <Input id="campo-nome" placeholder="Maria Silva" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-desabilitado">Desabilitado</Label>
            <Input id="campo-desabilitado" placeholder="Não editável" disabled />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-cpf">CPF</Label>
            <MaskedInput id="campo-cpf" mask="cpf" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-cnpj">CNPJ</Label>
            <MaskedInput id="campo-cnpj" mask="cnpj" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-telefone">Telefone</Label>
            <MaskedInput id="campo-telefone" mask="phone" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-valor">Valor</Label>
            <MaskedInput id="campo-valor" mask="money" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-tipo">Tipo de chave Pix</Label>
            <Select>
              <SelectTrigger id="campo-tipo">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CPF">CPF</SelectItem>
                <SelectItem value="EMAIL">E-mail</SelectItem>
                <SelectItem value="PHONE">Telefone</SelectItem>
                <SelectItem value="RANDOM">Chave aleatória</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="campo-obs">Observação</Label>
            <Textarea id="campo-obs" rows={3} placeholder="Escreva aqui…" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2">
            <Checkbox id="aceite" />
            <Label htmlFor="aceite">Aceito os termos</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ativo" />
            <Label htmlFor="ativo">Produto ativo</Label>
          </div>
          <CopyButton
            value="https://affiliates.example.com/r/ABC123"
            label="Copiar link"
            successMessage="Link copiado"
          />
          <CopyButton value="ABC123" />
        </div>
      </Section>

      <Section title="Diálogos" description="Fricção proporcional ao estrago.">
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmDialog
            trigger={<Button variant="outline">Confirmar simples</Button>}
            title="Arquivar produto"
            description="O produto sai da vitrine, mas os links já divulgados continuam funcionando."
            confirmLabel="Arquivar"
            onConfirm={() => undefined}
          />

          <ConfirmDialog
            trigger={<Button variant="destructive">Digite para confirmar</Button>}
            title="Remover afiliado"
            description="Esta ação encerra o acesso e anonimiza os dados após 30 dias."
            confirmLabel="Remover"
            variant="destructive"
            typeToConfirm="Maria Silva"
            onConfirm={() => undefined}
          />

          <ReasonDialog
            trigger={<Button variant="outline">Pedir motivo</Button>}
            title="Reprovar cadastro"
            description="O motivo será enviado por e-mail para a pessoa."
            confirmLabel="Reprovar"
            variant="destructive"
            onConfirm={() => undefined}
          />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">Com dica</Button>
            </TooltipTrigger>
            <TooltipContent>Comissão liberada 7 dias após o pagamento.</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Tabela" description="Linha de 48 px, números tabulares.">
        <div className="overflow-x-auto rounded-lg border border-mist-300 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Comissão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">#A1B2C3</TableCell>
                <TableCell>
                  <DateText date={ontem} format="relative" />
                </TableCell>
                <TableCell>
                  <StatusBadge label="Pago" tone="success" />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText cents={4998} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">#D4E5F6</TableCell>
                <TableCell>
                  <DateText date={agora} format="relative" />
                </TableCell>
                <TableCell>
                  <StatusBadge label="Aguardando" tone="warning" hint="libera em 12/09" />
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText cents={12000} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Abas e cartões">
        <Tabs defaultValue="dados">
          <TabsList>
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="vendas">Vendas</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
          </TabsList>
          <TabsContent value="dados" className="pt-4">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Cartão</CardTitle>
                <CardDescription>Superfície branca sobre fundo mist-100.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Conteúdo do cartão, com padding 24 e sombra suave.
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="vendas" className="pt-4 text-sm text-muted-foreground">
            Conteúdo da aba Vendas.
          </TabsContent>
          <TabsContent value="auditoria" className="pt-4 text-sm text-muted-foreground">
            Conteúdo da aba Auditoria.
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Estados" description="Carregando, vazio, erro.">
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
          <Skeleton className="h-32 rounded-lg" />
        </div>

        <Separator />

        <EmptyState
          title="Nenhuma venda ainda"
          description="Compartilhe seu link para começar a receber comissões."
          action={<Button>Ver meus links</Button>}
        />

        <ErrorState />
      </Section>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-navy-900">{title}</h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
