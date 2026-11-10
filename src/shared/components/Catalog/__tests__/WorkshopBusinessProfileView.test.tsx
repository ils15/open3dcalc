import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { WorkshopBusinessProfileView } from "../WorkshopBusinessProfileView";
import { useWorkshopProfileStore } from "@/shared/stores/workshopProfileStore";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("WorkshopBusinessProfileView", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkshopProfileStore.getState().resetAll();
  });

  it("renders profile sections and default values", () => {
    render(<WorkshopBusinessProfileView />);

    expect(
      screen.getByText("Identidade Visual & Logotipo"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Chave PIX & Condições Comerciais"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cor de Destaque para Relatórios em PDF"),
    ).toBeInTheDocument();
  });

  it("updates workshop profile fields", () => {
    render(<WorkshopBusinessProfileView />);

    const nameInput = screen.getByDisplayValue("Minha Oficina 3D");
    fireEvent.change(nameInput, {
      target: { value: "3D Maker Lab Pro" },
    });

    expect(
      useWorkshopProfileStore.getState().profile.workshopName,
    ).toBe("3D Maker Lab Pro");
  });

  it("updates PIX key and type", () => {
    render(<WorkshopBusinessProfileView />);

    const pixInput = screen.getByPlaceholderText("Insira sua chave PIX...");
    fireEvent.change(pixInput, {
      target: { value: "pix@makerlab.com" },
    });

    expect(useWorkshopProfileStore.getState().profile.pixKey).toBe(
      "pix@makerlab.com",
    );
  });

  it("allows selecting a theme color for PDF reports", () => {
    render(<WorkshopBusinessProfileView />);

    const emeraldBtn = screen.getByRole("button", {
      name: /esmeralda oficina/i,
    });
    fireEvent.click(emeraldBtn);

    expect(
      useWorkshopProfileStore.getState().profile.reportPrimaryColor,
    ).toBe("#059669");
  });

  it("opens test WhatsApp modal on button click", () => {
    render(<WorkshopBusinessProfileView />);

    const testBtn = screen.getByRole("button", {
      name: /testar envio whatsapp/i,
    });
    fireEvent.click(testBtn);

    expect(
      screen.getByText("Mensagens & Propostas para WhatsApp"),
    ).toBeInTheDocument();
  });
});
