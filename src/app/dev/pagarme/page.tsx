import { notFound } from "next/navigation";

import { forceFakeOrderStatus, listFakeOrders } from "@/server/pagarme/fake";
import { applyGatewayStatus } from "@/features/orders/service";
import { db } from "@/lib/db";
import { env, isDevelopment } from "@/lib/env";
import { PageHeader } from "@/components/layout/page-header";

export const dynamic = "force-dynamic";

async function forceStatus(formData: FormData) {
  "use server";
  if (!isDevelopment || env.PAGARME_DRIVER !== "fake") return;

  const gatewayOrderIdRaw = formData.get("gatewayOrderId");
  const statusRaw = formData.get("status");
  const gatewayOrderId = typeof gatewayOrderIdRaw === "string" ? gatewayOrderIdRaw : "";
  const status = typeof statusRaw === "string" ? statusRaw : "";
  if (
    !gatewayOrderId ||
    !["paid", "failed", "refunded", "chargedback"].includes(status)
  ) {
    return;
  }

  const remote = forceFakeOrderStatus(
    gatewayOrderId,
    status as "paid" | "failed" | "refunded" | "chargedback",
  );
  const order = await db.order.findUnique({ where: { gatewayOrderId } });
  if (order) {
    try {
      await applyGatewayStatus(order, remote);
    } catch {
      // transição inválida — ignora no painel
    }
  }
}

export default async function DevPagarmePage() {
  if (!isDevelopment) notFound();

  const orders = env.PAGARME_DRIVER === "fake" ? listFakeOrders() : [];
  const dbOrders = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      publicCode: true,
      status: true,
      gatewayOrderId: true,
      paymentMethod: true,
      amountCents: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-8">
      <PageHeader
        title="Pagar.me fake"
        description="Força paid/failed/refunded em pedidos do driver fake (só em desenvolvimento)."
      />

      {env.PAGARME_DRIVER !== "fake" ? (
        <p className="text-sm text-[color:var(--color-warning)]">
          PAGARME_DRIVER não é fake — este painel não altera o gateway real.
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-display text-xl">Pedidos locais</h2>
        <ul className="space-y-3">
          {dbOrders.map((order) => (
            <li
              key={order.id}
              className="rounded-lg border border-mist-200 bg-white p-4 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {order.publicCode} · {order.status}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {order.gatewayOrderId ?? "sem gateway"}
                  </p>
                </div>
                {order.gatewayOrderId ? (
                  <form action={forceStatus} className="flex flex-wrap gap-2">
                    <input type="hidden" name="gatewayOrderId" value={order.gatewayOrderId} />
                    {(["paid", "failed", "refunded"] as const).map((s) => (
                      <button
                        key={s}
                        type="submit"
                        name="status"
                        value={s}
                        className="rounded-md border border-mist-300 px-2 py-1 text-xs hover:bg-mist-100"
                      >
                        {s}
                      </button>
                    ))}
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-xl">Store fake ({orders.length})</h2>
        <pre className="overflow-auto rounded-lg bg-navy-900 p-4 text-xs text-mist-100">
          {JSON.stringify(orders, null, 2)}
        </pre>
      </section>
    </div>
  );
}
