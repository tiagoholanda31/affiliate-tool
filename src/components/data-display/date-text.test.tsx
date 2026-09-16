import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DateText } from "@/components/data-display/date-text";

const DATA = new Date("2026-09-05T14:30:00.000Z"); // 11:30 em São Paulo

describe("DateText", () => {
  it("formata data no fuso de São Paulo", () => {
    render(<DateText date={DATA} />);
    expect(screen.getByText("05/09/2026")).toBeInTheDocument();
  });

  it("formata data e hora", () => {
    render(<DateText date={DATA} format="datetime" />);
    expect(screen.getByText("05/09/2026 11:30")).toBeInTheDocument();
  });

  it("usa <time> com dateTime em ISO, legível por máquina", () => {
    const { container } = render(<DateText date={DATA} format="datetime" />);
    const time = container.querySelector("time");

    expect(time).toHaveAttribute("dateTime", DATA.toISOString());
  });

  it("mostra o texto relativo depois de montar", async () => {
    const agoraMenos2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
    render(<DateText date={agoraMenos2h} format="relative" />);

    expect(await screen.findByText(/há 2 horas/)).toBeInTheDocument();
  });

  it("no modo relativo guarda a data absoluta no title", async () => {
    const agoraMenos2h = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const { container } = render(<DateText date={agoraMenos2h} format="relative" />);

    await screen.findByText(/há 2 horas/);
    expect(container.querySelector("time")).toHaveAttribute("title");
  });

  it("modo absoluto não tem title — a informação já está visível", () => {
    const { container } = render(<DateText date={DATA} format="date" />);
    expect(container.querySelector("time")).not.toHaveAttribute("title");
  });
});
