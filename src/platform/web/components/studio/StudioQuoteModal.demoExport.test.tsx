import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: () => {} }));

import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import { StudioQuoteModal } from "./StudioQuoteModal";

describe("StudioQuoteModal demo export policy", () => {
  afterEach(() => {
    useDemoModeStore.setState({ isActive: false, snapshot: null });
    vi.restoreAllMocks();
  });

  it("blocks clipboard, print, WhatsApp, and CSV exports with accessible feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn();
    const print = vi.fn();
    const createObjectURL = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.spyOn(window, "open").mockImplementation(open);
    vi.spyOn(window, "print").mockImplementation(print);
    vi.spyOn(URL, "createObjectURL").mockImplementation(createObjectURL);
    useDemoModeStore.setState({ isActive: true });

    const user = userEvent.setup();
    render(
      <>
        <DemoExportBlockedToast />
        <StudioQuoteModal isOpen onClose={() => {}} />
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Copiar Texto" }));
    await user.click(
      screen.getByRole("button", { name: "Imprimir / Salvar PDF" }),
    );
    await user.click(screen.getByRole("button", { name: "Enviar no WhatsApp" }));
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    expect(writeText).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect((await screen.findAllByRole("alert")).length).toBeGreaterThan(0);
  });

  it("keeps legitimate CSV exports available and safely serializes untrusted cells", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:quote-export");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const user = userEvent.setup();
    render(
      <StudioQuoteModal
        isOpen
        onClose={() => {}}
        projectName={'Widget, "Special"'}
        material={"+SUM(1,2)"}
      />,
    );
    await user.clear(screen.getByPlaceholderText("Ex: João da Silva"));
    await user.type(screen.getByPlaceholderText("Ex: João da Silva"), "=1+1");
    await user.click(screen.getByRole("button", { name: "Exportar CSV" }));

    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    const csv = await (blob as Blob).text();
    expect(csv).toContain('"Widget, ""Special"""');
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+SUM(1,2)");
  });

  it("reports missing clipboard access without claiming the text was copied", async () => {
    useDemoModeStore.setState({ isActive: false, snapshot: null });
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    expect(navigator.clipboard).toBeUndefined();
    render(<StudioQuoteModal isOpen onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Copiar Texto" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível copiar a proposta",
    );
    expect(screen.queryByText("Copiado!")).not.toBeInTheDocument();
  });
});
