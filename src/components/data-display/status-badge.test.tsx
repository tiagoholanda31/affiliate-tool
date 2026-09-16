import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, type StatusTone } from "@/components/data-display/status-badge";

const TONES: StatusTone[] = ["success", "warning", "danger", "neutral", "info"];

describe("StatusBadge", () => {
  it("mostra o texto do status", () => {
    render(<StatusBadge label="Aprovado" tone="success" />);
    expect(screen.getByText("Aprovado")).toBeInTheDocument();
  });

  it.each(TONES)("o tom %s traz ícone além da cor", (tone) => {
    const { container } = render(<StatusBadge label="Status" tone={tone} />);

    // Acessibilidade: status nunca é comunicado só por cor (docs/spec/05, item 10).
    const icon = container.querySelector("svg");
    expect(icon).not.toBeNull();
    expect(icon).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("aplica classes diferentes por tom", () => {
    const { container: sucesso } = render(<StatusBadge label="A" tone="success" />);
    const { container: erro } = render(<StatusBadge label="B" tone="danger" />);

    const classesSucesso = sucesso.firstElementChild?.className ?? "";
    const classesErro = erro.firstElementChild?.className ?? "";
    expect(classesSucesso).not.toBe(classesErro);
  });

  it("expõe a dica no title e para leitores de tela", () => {
    render(<StatusBadge label="Pendente" tone="warning" hint="libera em 12/09" />);

    const badge = screen.getByTitle("libera em 12/09");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("libera em 12/09");
  });

  it("não põe title quando não há dica", () => {
    const { container } = render(<StatusBadge label="Pago" tone="success" />);
    expect(container.firstElementChild).not.toHaveAttribute("title");
  });

  it("aceita ícone customizado", () => {
    function IconeFalso({ className }: { className?: string }) {
      return <svg className={className} data-testid="icone-custom" />;
    }

    render(<StatusBadge label="Estornado" tone="danger" icon={IconeFalso} />);
    expect(screen.getByTestId("icone-custom")).toBeInTheDocument();
  });
});
