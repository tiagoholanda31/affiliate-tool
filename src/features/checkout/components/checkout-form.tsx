"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { createCheckoutOrderAction } from "@/features/checkout/actions";
import { tokenizeCard, detectBrand, luhnValid } from "@/features/checkout/card-token";
import { Field, FormAlert, fieldA11y } from "@/components/forms/field";
import { MaskedInput } from "@/components/forms/masked-input";
import { applyServerErrors } from "@/components/forms/server-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FIELD_ERRORS } from "@/lib/i18n/pt-BR";
import { formatBRL } from "@/lib/money";
import { isValidCnpj, isValidCpf, isValidPhone, onlyDigits } from "@/lib/masks";
import { cn } from "@/lib/utils";

export type CheckoutProduct = {
  id: string;
  name: string;
  priceCents: number;
  allowPix: boolean;
  allowCard: boolean;
  maxInstallments: number;
};

type FormValues = {
  name: string;
  email: string;
  phone: string;
  document: string;
  method: "pix" | "card";
  cardNumber: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
  installments: number;
  line1: string;
  line2: string;
  zipCode: string;
  city: string;
  state: string;
  website: string;
};

function buildSchema(product: CheckoutProduct) {
  return z
    .object({
      name: z.string().trim().min(3, FIELD_ERRORS.minLength(3)),
      email: z.string().trim().toLowerCase().pipe(z.email(FIELD_ERRORS.email)),
      phone: z.string().refine((v) => isValidPhone(onlyDigits(v)), FIELD_ERRORS.phone),
      document: z.string().refine((v) => {
        const d = onlyDigits(v);
        return d.length === 11 ? isValidCpf(d) : isValidCnpj(d);
      }, "CPF ou CNPJ inválido."),
      method: z.enum(["pix", "card"]),
      cardNumber: z.string(),
      holderName: z.string(),
      expMonth: z.string(),
      expYear: z.string(),
      cvv: z.string(),
      installments: z.number().int().min(1).max(12),
      line1: z.string(),
      line2: z.string(),
      zipCode: z.string(),
      city: z.string(),
      state: z.string(),
      website: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.method === "pix" && !product.allowPix) {
        ctx.addIssue({ code: "custom", message: "Pix indisponível.", path: ["method"] });
      }
      if (data.method === "card") {
        if (!product.allowCard) {
          ctx.addIssue({ code: "custom", message: "Cartão indisponível.", path: ["method"] });
        }
        const number = onlyDigits(data.cardNumber);
        if (!luhnValid(number)) {
          ctx.addIssue({
            code: "custom",
            message: "Número do cartão inválido.",
            path: ["cardNumber"],
          });
        }
        if (!data.holderName.trim()) {
          ctx.addIssue({ code: "custom", message: FIELD_ERRORS.required, path: ["holderName"] });
        }
        const month = Number(data.expMonth);
        const year = Number(data.expYear);
        if (!(month >= 1 && month <= 12)) {
          ctx.addIssue({ code: "custom", message: "Mês inválido.", path: ["expMonth"] });
        }
        if (!(year >= 25 && year <= 99) && !(year >= 2025 && year <= 2099)) {
          ctx.addIssue({ code: "custom", message: "Ano inválido.", path: ["expYear"] });
        }
        if (!/^\d{3,4}$/.test(data.cvv)) {
          ctx.addIssue({ code: "custom", message: "CVV inválido.", path: ["cvv"] });
        }
        if (!data.line1.trim()) {
          ctx.addIssue({ code: "custom", message: FIELD_ERRORS.required, path: ["line1"] });
        }
        if (onlyDigits(data.zipCode).length !== 8) {
          ctx.addIssue({ code: "custom", message: "CEP inválido.", path: ["zipCode"] });
        }
        if (!data.city.trim()) {
          ctx.addIssue({ code: "custom", message: FIELD_ERRORS.required, path: ["city"] });
        }
        if (!/^[A-Za-z]{2}$/.test(data.state)) {
          ctx.addIssue({ code: "custom", message: "UF inválida.", path: ["state"] });
        }
      }
    });
}

function installmentOptions(priceCents: number, max: number) {
  return Array.from({ length: max }, (_, i) => {
    const n = i + 1;
    const per = Math.floor(priceCents / n);
    return {
      value: n,
      label: `${String(n)}x de ${formatBRL(per)}${n === 1 ? " à vista" : ""}`,
    };
  });
}

const KNOWN_FIELDS = [
  "name",
  "email",
  "phone",
  "document",
  "cardNumber",
  "holderName",
  "expMonth",
  "expYear",
  "cvv",
  "installments",
  "line1",
  "zipCode",
  "city",
  "state",
] as const;

export function CheckoutForm({
  product,
  fakeTokenizer = false,
}: {
  product: CheckoutProduct;
  /** Quando o gateway é fake, não chama a API real mesmo com chave pública no .env. */
  fakeTokenizer?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [startedAt] = useState(() => Date.now());
  const defaultMethod = product.allowPix ? "pix" : "card";

  const schema = useMemo(() => buildSchema(product), [product]);
  const form = useForm<FormValues>({
    // Compat zodResolver + campos opcionais do superRefine
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      document: "",
      method: defaultMethod,
      cardNumber: "",
      holderName: "",
      expMonth: "",
      expYear: "",
      cvv: "",
      installments: 1,
      line1: "",
      line2: "",
      zipCode: "",
      city: "",
      state: "",
      website: "",
    },
  });

  const method = form.watch("method");
  const cardNumber = form.watch("cardNumber");
  const brand = detectBrand(cardNumber);
  const parcels = installmentOptions(product.priceCents, product.maxInstallments);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(null);
    startTransition(async () => {
      try {
        if (values.method === "pix") {
          const result = await createCheckoutOrderAction({
            productId: product.id,
            method: "pix",
            customer: {
              name: values.name,
              email: values.email,
              phone: onlyDigits(values.phone),
              document: onlyDigits(values.document),
            },
            website: values.website || "",
            formStartedAt: startedAt,
          });
          if (!result.ok) {
            setFormError(applyServerErrors(result, form.setError, KNOWN_FIELDS));
            return;
          }
          router.push(result.data.redirectTo);
          return;
        }

        const token = await tokenizeCard(
          {
            number: onlyDigits(values.cardNumber),
            holderName: values.holderName.trim(),
            expMonth: Number(values.expMonth),
            expYear: Number(values.expYear),
            cvv: values.cvv,
          },
          { fake: fakeTokenizer },
        );

        const result = await createCheckoutOrderAction({
          productId: product.id,
          method: "card",
          customer: {
            name: values.name,
            email: values.email,
            phone: onlyDigits(values.phone),
            document: onlyDigits(values.document),
          },
          cardToken: token.id,
          installments: values.installments,
          billingAddress: {
            line1: values.line1.trim(),
            line2: values.line2.trim() || undefined,
            zipCode: onlyDigits(values.zipCode),
            city: values.city.trim(),
            state: values.state.trim().toUpperCase(),
          },
          website: values.website || "",
          formStartedAt: startedAt,
        });

        if (!result.ok) {
          setFormError(applyServerErrors(result, form.setError, KNOWN_FIELDS));
          return;
        }

        if (result.data.status === "FAILED" && result.data.failureReason) {
          setFormError(result.data.failureReason);
          return;
        }

        router.push(result.data.redirectTo);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Algo deu errado. Tente novamente.");
      }
    });
  });

  return (
    <form onSubmit={onSubmit} className="relative space-y-6" noValidate>
      <FormAlert>{formError}</FormAlert>

      <section className="space-y-4" aria-labelledby="checkout-dados">
        <h2 id="checkout-dados" className="font-display text-xl text-navy-900">
          Seus dados
        </h2>
        <Field name="name" label="Nome completo" required error={form.formState.errors.name?.message}>
          <Input
            {...form.register("name")}
            {...fieldA11y("name", form.formState.errors.name?.message)}
            autoComplete="name"
          />
        </Field>
        <Field name="email" label="E-mail" required error={form.formState.errors.email?.message}>
          <Input
            type="email"
            {...form.register("email")}
            {...fieldA11y("email", form.formState.errors.email?.message)}
            autoComplete="email"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="phone" label="Celular" required error={form.formState.errors.phone?.message}>
            <Controller
              control={form.control}
              name="phone"
              render={({ field }) => (
                <MaskedInput
                  mask="phone"
                  value={field.value}
                  onValueChange={({ raw }) => { field.onChange(raw); }}
                  {...fieldA11y("phone", form.formState.errors.phone?.message)}
                />
              )}
            />
          </Field>
          <Field
            name="document"
            label="CPF ou CNPJ"
            required
            error={form.formState.errors.document?.message}
          >
            <Controller
              control={form.control}
              name="document"
              render={({ field }) => (
                <MaskedInput
                  mask="cpfCnpj"
                  value={field.value}
                  onValueChange={({ raw }) => { field.onChange(raw); }}
                  {...fieldA11y("document", form.formState.errors.document?.message)}
                />
              )}
            />
          </Field>
        </div>
      </section>

      <div className="absolute -left-[9999px] top-auto h-0 w-0 overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
      </div>

      <section className="space-y-4" aria-labelledby="checkout-pagamento">
        <h2 id="checkout-pagamento" className="font-display text-xl text-navy-900">
          Pagamento
        </h2>
        <Tabs value={method} onValueChange={(v) => { form.setValue("method", v as "pix" | "card"); }}>
          <TabsList className="w-full">
            {product.allowPix ? (
              <TabsTrigger value="pix" className="flex-1">
                Pix
              </TabsTrigger>
            ) : null}
            {product.allowCard ? (
              <TabsTrigger value="card" className="flex-1">
                Cartão
              </TabsTrigger>
            ) : null}
          </TabsList>

          {product.allowPix ? (
            <TabsContent value="pix" className="space-y-3 pt-3">
              <p className="text-sm text-navy-700">
                Após confirmar, você verá o QR Code e o código copia-e-cola. O Pix expira em cerca de
                30 minutos.
              </p>
            </TabsContent>
          ) : null}

          {product.allowCard ? (
            <TabsContent value="card" className="space-y-4 pt-3">
              <Field
                name="cardNumber"
                label="Número do cartão"
                required
                error={form.formState.errors.cardNumber?.message}
                hint={brand ?? undefined}
              >
                <Input
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={cardNumber}
                  {...fieldA11y(
                    "cardNumber",
                    form.formState.errors.cardNumber?.message,
                    Boolean(brand),
                  )}
                  onChange={(e) => {
                    const raw = onlyDigits(e.target.value).slice(0, 19);
                    const grouped = raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
                    form.setValue("cardNumber", grouped, { shouldValidate: true });
                  }}
                />
              </Field>
              <Field
                name="holderName"
                label="Nome no cartão"
                required
                error={form.formState.errors.holderName?.message}
              >
                <Input
                  autoComplete="cc-name"
                  {...form.register("holderName")}
                  {...fieldA11y("holderName", form.formState.errors.holderName?.message)}
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field
                  name="expMonth"
                  label="Mês"
                  required
                  error={form.formState.errors.expMonth?.message}
                >
                  <Input
                    inputMode="numeric"
                    placeholder="MM"
                    maxLength={2}
                    {...form.register("expMonth")}
                    {...fieldA11y("expMonth", form.formState.errors.expMonth?.message)}
                  />
                </Field>
                <Field
                  name="expYear"
                  label="Ano"
                  required
                  error={form.formState.errors.expYear?.message}
                >
                  <Input
                    inputMode="numeric"
                    placeholder="AA"
                    maxLength={4}
                    {...form.register("expYear")}
                    {...fieldA11y("expYear", form.formState.errors.expYear?.message)}
                  />
                </Field>
                <Field name="cvv" label="CVV" required error={form.formState.errors.cvv?.message}>
                  <Input
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    maxLength={4}
                    {...form.register("cvv")}
                    {...fieldA11y("cvv", form.formState.errors.cvv?.message)}
                  />
                </Field>
              </div>
              <Field name="installments" label="Parcelas" required>
                <select
                  className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs",
                  )}
                  {...form.register("installments", { valueAsNumber: true })}
                  {...fieldA11y("installments")}
                >
                  {parcels.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                name="line1"
                label="Endereço (cobrança)"
                required
                error={form.formState.errors.line1?.message}
              >
                <Input
                  {...form.register("line1")}
                  {...fieldA11y("line1", form.formState.errors.line1?.message)}
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  name="zipCode"
                  label="CEP"
                  required
                  error={form.formState.errors.zipCode?.message}
                >
                  <Input
                    inputMode="numeric"
                    {...form.register("zipCode")}
                    {...fieldA11y("zipCode", form.formState.errors.zipCode?.message)}
                  />
                </Field>
                <Field name="city" label="Cidade" required error={form.formState.errors.city?.message}>
                  <Input
                    {...form.register("city")}
                    {...fieldA11y("city", form.formState.errors.city?.message)}
                  />
                </Field>
                <Field name="state" label="UF" required error={form.formState.errors.state?.message}>
                  <Input
                    maxLength={2}
                    {...form.register("state")}
                    {...fieldA11y("state", form.formState.errors.state?.message)}
                  />
                </Field>
              </div>
            </TabsContent>
          ) : null}
        </Tabs>
      </section>

      <div className="rounded-lg border border-mist-200 bg-mist-100/60 p-4">
        <p className="text-sm text-navy-700">Total</p>
        <p className="font-display text-2xl text-navy-900">{formatBRL(product.priceCents)}</p>
      </div>

      <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Processando…" : method === "pix" ? "Gerar Pix" : "Pagar com cartão"}
      </Button>
    </form>
  );
}
