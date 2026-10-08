import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

vi.mock("@/shared/config/betaChannel", () => ({ isBetaChannel: true }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));
vi.mock("@/shared/hooks/useDemoMode", () => ({ useIsDemoMode: () => false }));
vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: { getState: () => ({ enter: vi.fn() }) },
}));
vi.mock("@/shared/lib/demoExportGuard", () => ({ guardExport: () => false }));

import { StudioCustomerView } from "./StudioCustomerView";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { resetManifestForTests } from "@/shared/lib/manifestGate";
import {
  getLastPiiWriteRefusal,
  resetPiiStoreHydrationForTests,
} from "@/shared/lib/crypto/piiStoreHydration";

beforeEach(async () => {
  window.localStorage.clear();
  resetManifestForTests(undefined);
  resetPiiStoreHydrationForTests();
  await useCustomerStore.persist.rehydrate();
  useCustomerStore.setState({ customers: [], searchQuery: "" });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("StudioCustomerView Beta deletion boundary", () => {
  it("does not offer deletion for PII customer records", async () => {
    useCustomerStore.setState({
      customers: [
        {
          id: "synthetic-beta-customer-01",
          name: "Example Customer",
          company: "Example Workshop",
          email: "customer@example.invalid",
          phone: "555-0100",
          address: "1 Example Way",
          notes: "synthetic record",
          createdAt: 1,
          updatedAt: 1,
          quoteCount: 0,
        },
      ],
    });
    render(
      <StudioCustomerView onTabChange={vi.fn()} onOpenQuoteModal={vi.fn()} />,
    );

    expect(
      screen.queryByRole("button", { name: "Excluir Example Customer" }),
    ).toBeNull();
  });
});

describe("StudioCustomerView Beta real save (no gate mock)", () => {
  it("saves a synthetic customer through the REAL Beta write gate", async () => {
    const user = userEvent.setup();
    render(
      <StudioCustomerView onTabChange={vi.fn()} onOpenQuoteModal={vi.fn()} />,
    );

    await user.click(screen.getByRole("button", { name: "Cadastrar Cliente" }));
    await user.type(
      screen.getByPlaceholderText("Ex: João da Silva"),
      "Synthetic Customer",
    );
    await user.click(screen.getByRole("button", { name: /^Cadastrar$/ }));

    await waitFor(() => {
      expect(useCustomerStore.getState().customers).toHaveLength(1);
    });
    expect(useCustomerStore.getState().customers[0].name).toBe(
      "Synthetic Customer",
    );
    expect(screen.getByText("Synthetic Customer")).toBeInTheDocument();
    expect(getLastPiiWriteRefusal()).toBeNull();
    expect(screen.queryByText(/privacy\.vault\.writeRefusedTitle/)).toBeNull();
    const raw = window.localStorage.getItem(
      "open3dcalc_beta_test_customers_v1",
    );
    expect(raw).toContain("Synthetic Customer");
  });
});
