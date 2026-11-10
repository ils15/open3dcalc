import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { StudioWhatsAppModal } from "./StudioWhatsAppModal";
import { useWorkshopProfileStore } from "@/shared/stores/workshopProfileStore";

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

describe("StudioWhatsAppModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useWorkshopProfileStore.getState().resetAll();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <StudioWhatsAppModal isOpen={false} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders when isOpen is true with modal title and tabs", () => {
    render(<StudioWhatsAppModal isOpen={true} onClose={vi.fn()} />);
    expect(
      screen.getByText("Mensagens & Propostas para WhatsApp"),
    ).toBeInTheDocument();
    expect(screen.getByText("Proposta Rápida")).toBeInTheDocument();
    expect(screen.getByText("Orçamento Comercial Completo")).toBeInTheDocument();
    expect(
      screen.getByText("Peça Pronta para Retirada / Envio"),
    ).toBeInTheDocument();
  });

  it("replaces context placeholders in live preview", () => {
    render(
      <StudioWhatsAppModal
        isOpen={true}
        onClose={vi.fn()}
        initialData={{
          clientName: "João Silva",
          projectName: "Engrenagem Helicoidal",
          totalValue: 85.5,
          leadTime: "2 dias úteis",
        }}
      />,
    );

    // Live preview contains the customer name and project
    expect(screen.getAllByText(/João Silva/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Engrenagem Helicoidal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/85,50/i).length).toBeGreaterThan(0);
  });

  it("allows switching templates", () => {
    render(
      <StudioWhatsAppModal
        isOpen={true}
        onClose={vi.fn()}
        initialData={{
          clientName: "Maria Souza",
          projectName: "Action Figure",
        }}
      />,
    );

    // Click on "Peça Pronta" template
    const readyBtn = screen.getByText("Peça Pronta para Retirada / Envio");
    fireEvent.click(readyBtn);

    // Message updates to reflect completion
    expect(screen.getByText(/prontinha/i)).toBeInTheDocument();
  });

  it("triggers window.open with sanitized phone number on send", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <StudioWhatsAppModal
        isOpen={true}
        onClose={vi.fn()}
        initialData={{
          clientName: "Carlos Dev",
          clientPhone: "(11) 98765-4321",
          projectName: "Case Raspberry",
          totalValue: 60.0,
        }}
      />,
    );

    const sendBtn = screen.getByRole("button", { name: /enviar no whatsapp/i });
    fireEvent.click(sendBtn);

    expect(windowOpenSpy).toHaveBeenCalledTimes(1);
    const url = windowOpenSpy.mock.calls[0][0] as string;
    expect(url).toContain("https://wa.me/5511987654321");
    expect(url).toContain("text=");
  });

  it("copies message to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(
      <StudioWhatsAppModal
        isOpen={true}
        onClose={vi.fn()}
        initialData={{
          clientName: "Carlos Dev",
          projectName: "Case Raspberry",
        }}
      />,
    );

    const copyBtn = screen.getByRole("button", { name: /copiar mensagem/i });
    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(writeTextMock).toHaveBeenCalled();
  });
});
