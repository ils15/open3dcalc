import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n/i18n";
import { AIAssistantModal } from "../AIAssistantModal";

const LEGACY_KEY_STORAGE = "open3dcalc_gemini_api_key";

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: () => ({
    results: { sellPrice: 42.27, totalCost: 18.18, profit: 24.09 },
    activeTab: "fdm",
    fdmMaterial: { type: "pla", weightUsed: 50 },
    resinMaterial: { type: "resin" },
    fdmPrintParams: { printTimeHours: 2 },
    fdmSales: { profitMarginPercent: 100 },
    productName: "Bracket",
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({ format: (value: number) => `R$ ${value.toFixed(2)}` }),
}));

describe("AIAssistantModal local-only behavior", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("pt-BR");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("shows a localized local-only disclosure in Portuguese and English", async () => {
    const { rerender } = render(<AIAssistantModal open onClose={vi.fn()} />);

    expect(
      screen.getAllByText("Sugestões locais; nada é enviado a serviços de IA"),
    ).toHaveLength(2);

    await i18n.changeLanguage("en-US");
    rerender(<AIAssistantModal open onClose={vi.fn()} />);

    expect(
      screen.getAllByText("Local suggestions; nothing is sent to AI services"),
    ).toHaveLength(2);
  });

  it("keeps the former stored credential unread and unused while local suggestions work offline", async () => {
    window.localStorage.setItem(LEGACY_KEY_STORAGE, "redacted legacy value");
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem");
    const fetchMock = vi.mocked(fetch);
    const user = userEvent.setup();

    render(<AIAssistantModal open onClose={vi.fn()} />);

    expect(getItemSpy).not.toHaveBeenCalledWith(LEGACY_KEY_STORAGE);
    expect(
      screen.queryByDisplayValue(/redacted legacy value/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/api key|chave de api/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: "Pitch de Vendas & WhatsApp" }),
    );
    expect(screen.getByText(/peça \*Bracket\*/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("tab", { name: "Diagnóstico de Margem" }),
    );
    expect(screen.getByRole("tabpanel").textContent).toContain("R$ 12.04/h");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getItemSpy).not.toHaveBeenCalledWith(LEGACY_KEY_STORAGE);
  });

  it("exposes the assistant as an accessible dialog with labeled local tabs", () => {
    render(<AIAssistantModal open onClose={vi.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Assistente local" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("tablist")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("tab", { name: "Análise Técnica & Fatiamento" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(
      within(dialog).getAllByRole("button", { name: "Fechar assistente" }),
    ).toHaveLength(1);
  });
});
