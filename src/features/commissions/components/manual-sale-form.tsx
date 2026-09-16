"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  createManualOrderAction,
  previewManualCommissionAction,
  searchAffiliatesAction,
} from "@/features/commissions/actions";
import { Field } from "@/components/forms/field";
import { MaskedInput } from "@/components/forms/masked-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toIsoDate } from "@/lib/dates";
import { formatBRL } from "@/lib/money";

export type ManualSaleProductOption = {
  id: string;
  name: string;
  priceCents: number;
  status: string;
  type: string;
};

type AffiliateHit = {
  id: string;
  code: string | null;
  user: { name: string; email: string };
};

type Props = {
  products: ManualSaleProductOption[];
};

export function ManualSaleForm({ products }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const selected = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );
  const [amountCents, setAmountCents] = useState(selected?.priceCents ?? 0);
  const [paidAt, setPaidAt] = useState(toIsoDate(new Date()));
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sendDownloadLink, setSendDownloadLink] = useState(true);
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [affiliateLabel, setAffiliateLabel] = useState<string | null>(null);
  const [affiliateQuery, setAffiliateQuery] = useState("");
  const [hits, setHits] = useState<AffiliateHit[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  function onProductChange(id: string) {
    setProductId(id);
    const product = products.find((p) => p.id === id);
    if (product) setAmountCents(product.priceCents);
    setConfirming(false);
    setSummary(null);
  }

  function searchAffiliates(q: string) {
    setAffiliateQuery(q);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    startTransition(async () => {
      const result = await searchAffiliatesAction({ q });
      if (result.ok) setHits(result.data);
    });
  }

  function pickAffiliate(hit: AffiliateHit) {
    setAffiliateId(hit.id);
    setAffiliateLabel(hit.code ? `@${hit.code} — ${hit.user.name}` : hit.user.name);
    setAffiliateQuery("");
    setHits([]);
    setConfirming(false);
    setSummary(null);
  }

  function clearAffiliate() {
    setAffiliateId(null);
    setAffiliateLabel(null);
    setConfirming(false);
    setSummary(null);
  }

  function requestPreview() {
    startTransition(async () => {
      const result = await previewManualCommissionAction({
        productId,
        amountCents,
        paidAt,
        affiliateId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSummary(result.data.summary);
      setConfirming(true);
    });
  }

  function submit() {
    startTransition(async () => {
      const result = await createManualOrderAction({
        productId,
        amountCents,
        paidAt,
        customerName,
        customerEmail,
        customerPhone: customerPhone || undefined,
        affiliateId,
        notes: notes || undefined,
        sendDownloadLink: selected?.type === "DIGITAL" ? sendDownloadLink : false,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.downloadSent
          ? `Venda ${result.data.publicCode} lançada e link enviado.`
          : `Venda ${result.data.publicCode} lançada.`,
      );
      router.push(`/admin/vendas/${result.data.orderId}`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 rounded-lg border border-mist-200 bg-white p-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="productId">Produto</Label>
          <select
            id="productId"
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            value={productId}
            onChange={(e) => {
              onProductChange(e.target.value);
            }}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRL(p.priceCents)}
                {p.status !== "ACTIVE" ? ` (${p.status})` : ""}
              </option>
            ))}
          </select>
        </div>

        <Field name="amountCents" label="Valor cobrado" required>
          <MaskedInput
            mask="money"
            value={String(amountCents)}
            onValueChange={({ raw }) => {
              setAmountCents(Number(raw === "" ? 0 : raw));
              setConfirming(false);
              setSummary(null);
            }}
          />
        </Field>

        <div className="space-y-2">
          <Label htmlFor="paidAt">Data do pagamento</Label>
          <Input
            id="paidAt"
            type="date"
            value={paidAt}
            max={toIsoDate(new Date())}
            onChange={(e) => {
              setPaidAt(e.target.value);
              setConfirming(false);
              setSummary(null);
            }}
          />
        </div>

        <Field name="customerName" label="Nome do comprador" required>
          <Input
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
            }}
            autoComplete="name"
          />
        </Field>

        <Field name="customerEmail" label="E-mail do comprador" required>
          <Input
            type="email"
            value={customerEmail}
            onChange={(e) => {
              setCustomerEmail(e.target.value);
            }}
            autoComplete="email"
          />
        </Field>

        <Field name="customerPhone" label="Celular (opcional)">
          <MaskedInput
            mask="phone"
            value={customerPhone}
            onValueChange={({ raw }) => {
              setCustomerPhone(raw);
            }}
          />
        </Field>

        <div className="space-y-2">
          <Label htmlFor="affiliate">Afiliado (opcional)</Label>
          {affiliateLabel ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-mist-200 px-3 py-2 text-sm">
              <span>{affiliateLabel}</span>
              <Button type="button" variant="ghost" size="sm" onClick={clearAffiliate}>
                Remover
              </Button>
            </div>
          ) : (
            <>
              <Input
                id="affiliate"
                placeholder="Buscar por nome, código ou e-mail"
                value={affiliateQuery}
                onChange={(e) => {
                  searchAffiliates(e.target.value);
                }}
              />
              {hits.length > 0 ? (
                <ul className="rounded-md border border-mist-200 bg-white text-sm shadow-sm">
                  {hits.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-mist-100"
                        onClick={() => {
                          pickAffiliate(hit);
                        }}
                      >
                        <span className="font-medium">
                          {hit.code ? `@${hit.code}` : hit.user.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {hit.user.name} · {hit.user.email}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Observações</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
            }}
            rows={3}
            maxLength={2000}
          />
        </div>

        {selected?.type === "DIGITAL" ? (
          <label className="flex items-start gap-3 text-sm text-navy-900">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={sendDownloadLink}
              onChange={(e) => {
                setSendDownloadLink(e.target.checked);
              }}
            />
            <span>
              Enviar link de download ao comprador
              <span className="mt-0.5 block text-xs text-muted-foreground">
                O grant é criado mesmo sem o e-mail; você pode reenviar depois no detalhe do
                pedido.
              </span>
            </span>
          </label>
        ) : null}
      </div>

      {summary ? (
        <p className="rounded-md border border-gold-100 bg-gold-100/40 px-3 py-2 text-sm text-navy-900">
          {summary}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {!confirming ? (
          <Button type="button" disabled={pending || !productId} onClick={requestPreview}>
            Revisar e continuar
          </Button>
        ) : (
          <Button type="button" disabled={pending} onClick={submit}>
            Confirmar venda manual
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            router.push("/admin/vendas");
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
