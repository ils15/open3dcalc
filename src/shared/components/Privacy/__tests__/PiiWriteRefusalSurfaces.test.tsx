/**
 * H-4 — end-to-end: a PII surface must not fake success while the vault is
 * locked or incapable, and the user must SEE the refusal.
 *
 * These specs render the REAL stores and the REAL gate. They prove the three
 * requirements of the fix on the actual surfaces:
 *
 *  - locked      → adding a customer / quote is refused, nothing is persisted,
 *                  and the refusal notice appears immediately;
 *  - unavailable → same, with the capability reason;
 *  - unlocked    → the normal flow works and no notice appears.
 *
 * `getLastPiiWriteRefusal()` is the consumer under test: the notice reads it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, arg?: unknown) =>
      arg && typeof arg === "object"
        ? `${key} ${Object.values(arg).join(" ")}`
        : key,
    i18n: { resolvedLanguage: "pt", language: "pt" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    format: (value: number) => `R$ ${value.toFixed(2)}`,
    symbol: "R$",
    currency: "BRL",
  }),
}));

// Side-effect imports register the persist handles the gate rehydrates.
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { CustomerTab } from "@/shared/components/Catalog/CustomerTab";
import { QuoteSection } from "@/shared/components/Calculator/QuoteSection";
import { HistoryTab } from "@/shared/components/Calculator/HistoryTab/HistoryTab";
import {
  PII_STORE_KEY,
  configurePiiStoreRuntime,
  getLastPiiWriteRefusal,
  installPiiStoreRuntimeEnvironment,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import { resetPiiStoreGateForTests } from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const PASS = "senha-sintetica-superficie-5521";

/**
 * Deterministic user-event timing. The quote form's `Modal` moves focus to its
 * close button 50ms after mount; with user-event's default inter-keystroke
 * delay, a space typed while the machine is under load lands on that focused
 * button, dismissing the dialog before the save can be exercised. `delay: null`
 * dispatches each event without timers, so these specs always reach the write
 * path they are asserting on — no assertion is relaxed.
 */
const USER_EVENT_OPTIONS = { delay: null };

describe("H-4 — PII surfaces refuse writes while the vault is unavailable", () => {
  let idb: ReturnType<typeof createFakeIndexedDb>;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  function lockVault(): void {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
  }

  function makeVaultUnavailable(): void {
    configurePiiStoreRuntime({
      indexedDb: idb.factory,
      environment: { ...PII_STORE_ENVIRONMENT, webCryptoAvailable: false },
    });
    installPiiStoreRuntimeEnvironment();
  }

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    localStorage.clear();
    useCustomerStore.setState({ customers: [], searchQuery: "" });
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
    useHistoryStore.setState({ entries: [] });
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
  });

  async function submitCustomer(name: string): Promise<void> {
    const user = userEvent.setup(USER_EVENT_OPTIONS);
    await user.click(screen.getByText("customers.newCustomer"));
    await user.type(screen.getByPlaceholderText("customers.name"), name);
    await user.click(screen.getByText("common.save"));
  }

  it("locked: blocks the customer, persists nothing and shows the refusal", async () => {
    lockVault();
    render(<CustomerTab />);

    await submitCustomer("Cliente Bloqueado");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.writeRefusedTitle");
    expect(alert).toHaveTextContent("customers.title");
    expect(useCustomerStore.getState().customers).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.customers,
      reason: "profile_locked",
    });
  });

  it("unavailable: blocks the customer and reports the capability reason", async () => {
    makeVaultUnavailable();
    render(<CustomerTab />);

    await submitCustomer("Cliente Sem Cripto");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("web_crypto_unavailable");
    expect(useCustomerStore.getState().customers).toHaveLength(0);
  });

  it("locked: blocks a customer import and shows the refusal", async () => {
    lockVault();
    const { container } = render(<CustomerTab />);

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['{"customers":[]}'], "customers.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.writeRefusedTitle");
    expect(alert).toHaveTextContent("customers.title");
    expect(useCustomerStore.getState().customers).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.customers,
      reason: "profile_locked",
    });
  });

  it("unlocked: accepts the customer and shows no refusal", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());
    useCustomerStore.setState({ customers: [], searchQuery: "" });
    render(<CustomerTab />);

    await submitCustomer("Cliente Salvo");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useCustomerStore.getState().customers).toHaveLength(1);
    expect(useCustomerStore.getState().customers[0].name).toBe("Cliente Salvo");
    expect(getLastPiiWriteRefusal()).toBeNull();
  });

  it("locked: blocks the quote and shows the refusal", async () => {
    lockVault();
    const user = userEvent.setup(USER_EVENT_OPTIONS);
    render(<QuoteSection />);

    await user.click(screen.getByText("quotes.newQuote"));
    await user.type(
      screen.getByPlaceholderText("Ex: Orçamento para João"),
      "Orçamento Bloqueado",
    );
    await user.click(screen.getByText("Salvar Orçamento"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.writeRefusedTitle");
    expect(alert).toHaveTextContent("quotes.title");
    expect(useQuoteStore.getState().quotes).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.quotes,
      reason: "profile_locked",
    });
  });

  it("unlocked: accepts the quote and shows no refusal", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
    const user = userEvent.setup(USER_EVENT_OPTIONS);
    render(<QuoteSection />);

    await user.click(screen.getByText("quotes.newQuote"));
    await user.type(
      screen.getByPlaceholderText("Ex: Orçamento para João"),
      "Orçamento Salvo",
    );
    await user.click(screen.getByText("Salvar Orçamento"));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
  });

  it("locked: blocks a history import and shows the refusal", async () => {
    lockVault();
    const { container } = render(<HistoryTab />);

    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(['{"entries":[]}'], "history.json", {
      type: "application/json",
    });
    fireEvent.change(input, { target: { files: [file] } });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("privacy.vault.writeRefusedTitle");
    expect(alert).toHaveTextContent("history.title");
    expect(useHistoryStore.getState().entries).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.history,
      reason: "profile_locked",
    });
  });
});
