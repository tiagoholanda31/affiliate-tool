"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { requestOrderLinkAction } from "@/features/delivery/actions";
import { Field, fieldA11y } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  publicCode: string;
};

export function RequestOrderLinkForm({ publicCode }: Props) {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(e: React.SyntheticEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await requestOrderLinkAction({ publicCode, email });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.message);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl text-navy-900">Pedido {publicCode}</h1>
        <p className="text-sm text-navy-700">
          Para ver o status e o download, informe o e-mail usado na compra. Enviaremos o
          link se houver correspondência.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-lg border border-mist-200 bg-white p-6"
      >
        <Field name="order-email" label="E-mail da compra" required>
          <Input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            {...fieldA11y("order-email")}
          />
        </Field>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Enviando…" : "Enviar link do pedido"}
        </Button>
      </form>
    </div>
  );
}
