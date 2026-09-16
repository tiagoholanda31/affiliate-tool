import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MaskedInput } from "@/components/forms/masked-input";

describe("MaskedInput", () => {
  it("formata CPF enquanto o usuário digita", async () => {
    const user = userEvent.setup();
    render(<MaskedInput mask="cpf" aria-label="CPF" />);

    const campo = screen.getByLabelText("CPF");
    await user.type(campo, "12345678909");

    expect(campo).toHaveValue("123.456.789-09");
  });

  it("formata CNPJ", async () => {
    const user = userEvent.setup();
    render(<MaskedInput mask="cnpj" aria-label="CNPJ" />);

    await user.type(screen.getByLabelText("CNPJ"), "12345678000190");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("12.345.678/0001-90");
  });

  it("formata telefone celular e fixo", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<MaskedInput mask="phone" aria-label="Telefone" />);

    await user.type(screen.getByLabelText("Telefone"), "11987654321");
    expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 98765-4321");
    unmount();

    render(<MaskedInput mask="phone" aria-label="Fixo" />);
    await user.type(screen.getByLabelText("Fixo"), "1134567890");
    expect(screen.getByLabelText("Fixo")).toHaveValue("(11) 3456-7890");
  });

  it("preenche moeda da direita para a esquerda", async () => {
    const user = userEvent.setup();
    render(<MaskedInput mask="money" aria-label="Valor" />);

    const campo = screen.getByLabelText("Valor");

    await user.type(campo, "1");
    expect(campo).toHaveValue("0,01");

    await user.type(campo, "2");
    expect(campo).toHaveValue("0,12");

    await user.type(campo, "3456");
    expect(campo).toHaveValue("1.234,56");
  });

  it("ignora letras e outros caracteres", async () => {
    const user = userEvent.setup();
    render(<MaskedInput mask="cpf" aria-label="CPF" />);

    const campo = screen.getByLabelText("CPF");
    await user.type(campo, "abc123def456");

    expect(campo).toHaveValue("123.456");
  });

  it("não deixa passar do tamanho do documento", async () => {
    const user = userEvent.setup();
    render(<MaskedInput mask="cpf" aria-label="CPF" />);

    const campo = screen.getByLabelText("CPF");
    await user.type(campo, "123456789091111");

    expect(campo).toHaveValue("123.456.789-09");
  });

  it("entrega valor mascarado e valor limpo em onValueChange", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<MaskedInput mask="cpf" aria-label="CPF" onValueChange={aoMudar} />);

    await user.type(screen.getByLabelText("CPF"), "12345678909");

    // É o valor limpo que vai para o Zod e para o banco.
    expect(aoMudar).toHaveBeenLastCalledWith({
      masked: "123.456.789-09",
      raw: "12345678909",
    });
  });

  it("entrega moeda em centavos", async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<MaskedInput mask="money" aria-label="Valor" onValueChange={aoMudar} />);

    await user.type(screen.getByLabelText("Valor"), "12345");

    expect(aoMudar).toHaveBeenLastCalledWith({ masked: "123,45", raw: "12345" });
  });

  it("aplica a máscara ao valor inicial", () => {
    render(<MaskedInput mask="cpf" aria-label="CPF" defaultValue="12345678909" />);
    expect(screen.getByLabelText("CPF")).toHaveValue("123.456.789-09");
  });

  it("respeita valor controlado, reaplicando a máscara", () => {
    render(<MaskedInput mask="phone" aria-label="Telefone" value="11987654321" />);
    expect(screen.getByLabelText("Telefone")).toHaveValue("(11) 98765-4321");
  });

  it("usa teclado numérico no celular", () => {
    render(<MaskedInput mask="money" aria-label="Valor" />);
    expect(screen.getByLabelText("Valor")).toHaveAttribute("inputmode", "numeric");
  });

  it("mostra um exemplo do formato esperado", () => {
    render(<MaskedInput mask="cpf" aria-label="CPF" />);
    expect(screen.getByLabelText("CPF")).toHaveAttribute("placeholder", "000.000.000-00");
  });
});
