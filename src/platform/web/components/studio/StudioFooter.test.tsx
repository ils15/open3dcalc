import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { APP_VERSION } from "@/shared/version";
import { StudioFooter } from "./StudioFooter";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: false }));

describe("StudioFooter", () => {
  it("renders the brand, version badges, and local-first indicator", () => {
    render(<StudioFooter onTabChange={vi.fn()} />);

    expect(screen.getByText("Open3DCalc Studio")).toBeInTheDocument();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText(`Versão v${APP_VERSION}`)).toBeInTheDocument();
    expect(
      screen.getByText(/Local-First: seus dados e arquivos nunca saem deste computador/i),
    ).toBeInTheDocument();
  });

  it("handles navigation tab changes on module clicks", () => {
    const onTabChange = vi.fn();
    render(<StudioFooter onTabChange={onTabChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Calculadora" }));
    expect(onTabChange).toHaveBeenCalledWith("calculator");

    fireEvent.click(screen.getByRole("button", { name: "Minha Oficina" }));
    expect(onTabChange).toHaveBeenCalledWith("catalog");

    fireEvent.click(screen.getByRole("button", { name: "Orçamentos" }));
    expect(onTabChange).toHaveBeenCalledWith("quotes");

    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`Notas de Versão \\(v${APP_VERSION}\\)`) }),
    );
    expect(onTabChange).toHaveBeenCalledWith("changelog");
  });
});
