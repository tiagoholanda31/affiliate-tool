"use client";

import { forwardRef, useState, type ChangeEvent, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { applyMask, unmask, type MaskKind } from "@/lib/masks";

export type MaskedInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  mask: MaskKind;
  /** Valor controlado, já mascarado ou cru — a máscara é reaplicada. */
  value?: string;
  defaultValue?: string;
  /**
   * Recebe os dois valores a cada digitação: `masked` para exibir e `raw` para
   * enviar (dígitos, ou centavos no caso de moeda).
   */
  onValueChange?: (values: { masked: string; raw: string }) => void;
};

const INPUT_MODE: Record<MaskKind, "numeric" | "tel"> = {
  phone: "tel",
  cpf: "numeric",
  cnpj: "numeric",
  cpfCnpj: "numeric",
  money: "numeric",
};

const PLACEHOLDERS: Record<MaskKind, string> = {
  phone: "(11) 98765-4321",
  cpf: "000.000.000-00",
  cnpj: "00.000.000/0000-00",
  cpfCnpj: "CPF ou CNPJ",
  money: "0,00",
};

/**
 * Campo com máscara pt-BR (telefone, CPF, CNPJ, moeda).
 *
 * O usuário vê o texto formatado; `onValueChange` entrega o valor limpo para o
 * formulário — é ele que vai para o Zod e para o banco (docs/spec/05, item 5).
 */
export const MaskedInput = forwardRef<HTMLInputElement, MaskedInputProps>(function MaskedInput(
  { mask, value, defaultValue, onValueChange, placeholder, ...props },
  ref,
) {
  const [internal, setInternal] = useState(() => applyMask(mask, defaultValue ?? ""));

  const isControlled = value !== undefined;
  const displayed = isControlled ? applyMask(mask, value) : internal;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const masked = applyMask(mask, event.target.value);
    if (!isControlled) setInternal(masked);
    onValueChange?.({ masked, raw: unmask(mask, masked) });
  }

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode={INPUT_MODE[mask]}
      autoComplete={mask === "phone" ? "tel" : "off"}
      placeholder={placeholder ?? PLACEHOLDERS[mask]}
      value={displayed}
      onChange={handleChange}
    />
  );
});
