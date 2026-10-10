import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/shared/lib/download", () => ({ downloadBlob: vi.fn() }));
vi.mock("@/shared/lib/demoExportGuard", () => ({ guardExport: () => false }));
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import { StudioQuotesView } from "./StudioQuotesView";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import {
  getLastPiiWriteRefusal,
  resetLocalPiiPersistenceForTests,
} from "@/shared/lib/localPiiPersistence";

beforeEach(() => {
  window.localStorage.clear();
  resetManifestForTests(undefined);
  resetLocalPiiPersistenceForTests();
  useQuoteStore.setState({
    quotes: [],
    nextNumber: 1,
    searchQuery: "",
    statusFilter: "all",
  });
  useCustomerStore.setState({ customers: [], searchQuery: "" });
});

afterEach(() => {
  cleanup();
  resetLocalPiiPersistenceForTests();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("StudioQuotesView Beta user-data controls", () => {
  it("lets the user confirm deletion of a quote from the local profile", async () => {
    useCustomerStore.setState({
      customers: [
        {
          id: "synthetic-beta-customer-01",
          name: "Example Customer",
          email: "customer@example.invalid",
        } as never,
      ],
    });
    useQuoteStore.setState({
      quotes: [
        {
          id: "synthetic-beta-quote-01",
          number: 1,
          title: "Synthetic quote",
          customerId: "synthetic-beta-customer-01",
          customerSnapshot: {
            name: "Example Customer",
            email: "customer@example.invalid",
          },
          items: [],
          globalDiscountPercent: 0,
          subtotal: 0,
          discountAmount: 0,
          total: 0,
          status: "draft",
          createdAt: 1,
          updatedAt: 1,
        } as never,
      ],
      nextNumber: 2,
    });
    render(<StudioQuotesView />);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", {
        name: /Excluir orçamento #001 de Example Customer/i,
      }),
    );
    const confirmation = screen.getByRole("alertdialog");
    await user.click(
      within(confirmation).getByRole("button", { name: "Excluir" }),
    );
    expect(useQuoteStore.getState().quotes).toHaveLength(0);
  });
});

describe("StudioQuotesView Beta real save (no gate mock)", () => {
  it("saves a quote directly to the shared local profile", async () => {
    const user = userEvent.setup();
    render(<StudioQuotesView />);

    await user.click(screen.getByRole("button", { name: /novo orçamento/i }));
    await user.click(screen.getByRole("button", { name: /criar orçamento/i }));

    await waitFor(() => {
      expect(useQuoteStore.getState().quotes).toHaveLength(1);
    });
    expect(getLastPiiWriteRefusal()).toBeNull();
    expect(screen.queryByText(/privacy\.vault\.writeRefusedTitle/)).toBeNull();
    expect(await screen.findByText("quotes.saveSuccess")).toBeInTheDocument();
    const raw = window.localStorage.getItem("open3dcalc_quotes_v1");
    expect(raw).toContain("Orçamento de Impressão 3D");
    expect(
      window.localStorage.getItem("open3dcalc_beta_test_quotes_v1"),
    ).toBeNull();
  });
});
