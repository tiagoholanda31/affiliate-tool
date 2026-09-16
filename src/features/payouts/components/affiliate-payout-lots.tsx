"use client";

import { useState } from "react";
import Link from "next/link";

import { DateText } from "@/components/data-display/date-text";
import { MoneyText } from "@/components/data-display/money-text";
import { StatusBadge } from "@/components/data-display/status-badge";
import { Button } from "@/components/ui/button";
import { labelFor } from "@/lib/i18n/pt-BR";

export type AffiliatePayoutLot = {
  id: string;
  status: string;
  totalCents: number;
  referenceMonth: string;
  paidAt: Date | null;
  proofPath: string | null;
  proofReference: string | null;
  commissions: {
    id: string;
    amountCents: number;
    order: { publicCode: string; product: { name: string } };
  }[];
  adjustments: {
    id: string;
    amountCents: number;
    reason: string;
  }[];
};

export function AffiliatePayoutLots({ lots }: { lots: AffiliatePayoutLot[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (lots.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Ainda não há pagamentos registrados. Quando o Pix de comissão for enviado, o extrato aparece
        aqui.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lots.map((lot) => {
        const open = openId === lot.id;
        return (
          <div
            key={lot.id}
            className="rounded-lg border border-mist-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium text-navy-900">Mês {lot.referenceMonth}</p>
                <p className="text-sm text-muted-foreground">
                  {lot.paidAt ? <DateText date={lot.paidAt} /> : "—"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge
                  label={labelFor("payoutStatus", lot.status)}
                  tone="success"
                />
                <MoneyText cents={lot.totalCents} />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setOpenId(open ? null : lot.id); }}
                  aria-expanded={open}
                >
                  {open ? "Ocultar" : "Detalhes"}
                </Button>
                {lot.proofPath ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/pagamentos/${lot.id}/comprovante`}>Comprovante</a>
                  </Button>
                ) : null}
              </div>
            </div>

            {open ? (
              <div className="mt-4 space-y-2 border-t border-mist-200 pt-3 text-sm">
                {lot.proofReference ? (
                  <p className="text-muted-foreground">
                    Ref.: <code>{lot.proofReference}</code>
                  </p>
                ) : null}
                <ul className="space-y-1">
                  {lot.commissions.map((c) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>
                        {c.order.product.name}{" "}
                        <span className="text-muted-foreground">({c.order.publicCode})</span>
                      </span>
                      <MoneyText cents={c.amountCents} />
                    </li>
                  ))}
                  {lot.adjustments.map((a) => (
                    <li key={a.id} className="flex justify-between gap-2">
                      <span>{a.reason}</span>
                      <MoneyText cents={a.amountCents} showSign />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">
        Dúvidas?{" "}
        <Link href="/painel" className="text-navy-800 underline underline-offset-2 hover:text-navy-900">
          Voltar ao início
        </Link>
      </p>
    </div>
  );
}
