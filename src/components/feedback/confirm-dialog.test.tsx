import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Button } from "@/components/ui/button";

function abrir(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = props.onConfirm ?? vi.fn();

  render(
    <ConfirmDialog
      trigger={<Button>Abrir</Button>}
      title="Remover afiliado"
      description="Esta ação encerra o acesso da pessoa."
      confirmLabel="Remover"
      {...props}
      onConfirm={onConfirm}
    />,
  );

  return { onConfirm, user: userEvent.setup() };
}

describe("ConfirmDialog", () => {
  it("só mostra o conteúdo depois de acionar o gatilho", async () => {
    const { user } = abrir();

    expect(screen.queryByText("Remover afiliado")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    expect(await screen.findByText("Remover afiliado")).toBeInTheDocument();
  });

  it("confirma direto quando não exige digitação", async () => {
    const { user, onConfirm } = abrir();

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("cancelar fecha sem confirmar", async () => {
    const { user, onConfirm } = abrir();

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Cancelar" }));

    await waitFor(() => {
      expect(screen.queryByText("Remover afiliado")).not.toBeInTheDocument();
    });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  describe("modo digite para confirmar", () => {
    it("mantém o botão desabilitado até o texto conferir", async () => {
      const { user, onConfirm } = abrir({ typeToConfirm: "Maria Silva" });

      await user.click(screen.getByRole("button", { name: "Abrir" }));
      const confirmar = await screen.findByRole("button", { name: "Remover" });

      expect(confirmar).toBeDisabled();

      const campo = screen.getByRole("textbox");
      await user.type(campo, "Maria");
      expect(confirmar).toBeDisabled();

      await user.type(campo, " Silva");
      expect(confirmar).toBeEnabled();

      await user.click(confirmar);
      expect(onConfirm).toHaveBeenCalledOnce();
    });

    it("não aceita texto parecido mas diferente", async () => {
      const { user, onConfirm } = abrir({ typeToConfirm: "Maria Silva" });

      await user.click(screen.getByRole("button", { name: "Abrir" }));
      const confirmar = await screen.findByRole("button", { name: "Remover" });

      await user.type(screen.getByRole("textbox"), "maria silva");
      expect(confirmar).toBeDisabled();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    it("tolera espaços sobrando nas pontas", async () => {
      const { user } = abrir({ typeToConfirm: "Maria Silva" });

      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await user.type(screen.getByRole("textbox"), "  Maria Silva  ");

      expect(await screen.findByRole("button", { name: "Remover" })).toBeEnabled();
    });

    it("limpa o campo ao reabrir, para não confirmar por engano", async () => {
      const { user } = abrir({ typeToConfirm: "Maria Silva" });

      await user.click(screen.getByRole("button", { name: "Abrir" }));
      await user.type(screen.getByRole("textbox"), "Maria Silva");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Abrir" }));
      expect(await screen.findByRole("textbox")).toHaveValue("");
      expect(screen.getByRole("button", { name: "Remover" })).toBeDisabled();
    });
  });

  it("desabilita o botão enquanto envia", async () => {
    let liberar: () => void = () => undefined;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          liberar = resolve;
        }),
    );

    const { user } = abrir({ onConfirm });

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    await user.click(await screen.findByRole("button", { name: "Remover" }));

    expect(await screen.findByRole("button", { name: "Confirmando…" })).toBeDisabled();

    liberar();
    await waitFor(() => {
      expect(screen.queryByText("Remover afiliado")).not.toBeInTheDocument();
    });
  });

  it("o campo tem rótulo associado", async () => {
    const { user } = abrir({ typeToConfirm: "Maria Silva" });

    await user.click(screen.getByRole("button", { name: "Abrir" }));
    const campo = await screen.findByRole("textbox");

    expect(campo).toHaveAccessibleName();
  });
});
