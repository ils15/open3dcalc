/**
 * H-4 — the quotes surface must refuse a write it cannot persist.
 *
 * `StudioQuotesView` is the only live quotes UI: the legacy `QuoteSection` is an
 * orphan. Before this gate the view called `addQuote` unconditionally, so with a
 * LOCKED vault the store mutated in memory, the list showed the new quote, and
 * the quote evaporated on reload with no message at all — the exact silent data
 * loss the PII gate exists to prevent. This file drives the REAL gate (real Web
 * Crypto, fake IndexedDB) and asserts the two halves of the contract:
 *
 *   1. LOCKED   → nothing is added, the refusal is recorded, and the notice is on
 *      screen. (A refusal a user cannot see is a silent loss.)
 *   2. UNLOCKED → the quote is written, survives a simulated reload (state torn
 *      down and rehydrated from the vault), and is still there.
 *
 * Both halves matter: a gate that always refuses passes half the suite, and a
 * gate that never refuses passes the other.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

// The save handler fires confetti, which asks jsdom for a 2D canvas it cannot
// give — the resulting rejection surfaces as an UNHANDLED error and vitest
// fails the file even though every spec passed. The celebration is not what is
// under test; the write gate is.
vi.mock("canvas-confetti", () => ({ default: () => {} }));

// Side-effect imports register the stores' persist handles with the gate.
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { StudioQuotesView } from "@/platform/web/components/studio/StudioQuotesView";
import { StudioCustomerView } from "@/platform/web/components/studio/StudioCustomerView";
import type { Customer } from "@/shared/types";
import { DemoExportBlockedToast } from "@/shared/components/DemoMode/DemoExportBlockedToast";
import { useDemoModeStore } from "@/shared/stores/demoModeStore";
import {
  PII_STORE_KEY,
  configurePiiStoreRuntime,
  getLastPiiWriteRefusal,
  installPiiStoreRuntimeEnvironment,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
  whenPiiWritesSettled,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import {
  resetPiiStoreGateForTests,
  setDemoSuppressedForPiiGate,
} from "@/shared/lib/crypto/piiStoreCapability";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import { createFakeIndexedDb } from "@/shared/test/fakeIndexedDb";

const PASS = "senha-sintetica-acesso-4242";
const LEGACY_QUOTE_STORAGE_KEY = "open3dcalc_quotes_v1";
const customer: Customer = {
  id: "customer-1",
  name: "Ana Cliente",
  company: "Oficina",
  email: "ana@example.test",
  phone: "11999990000",
  address: "Rua 1",
  notes: "Preferência por PETG",
  createdAt: 1,
  updatedAt: 1,
  quoteCount: 0,
};

const quote = {
  id: "quote-1",
  number: 1,
  title: "Proposta de teste",
  items: [
    {
      historyEntryId: "item-1",
      name: "Suporte",
      quantity: 1,
      unitPrice: 65,
      totalPrice: 65,
      discountPercent: 0,
    },
  ],
  globalDiscountPercent: 0,
  subtotal: 65,
  discountAmount: 0,
  total: 65,
  status: "draft" as const,
  validUntil: "2026-12-01",
  paymentTerms: "PIX",
  deliveryEstimate: "3 dias",
  createdAt: 1,
  updatedAt: 1,
};

/**
 * The view's "new quote" form opens with one pre-filled line (65.00). We drive
 * the real inputs rather than the store directly, because the thing under test
 * is the SURFACE: the gate has to fire between the click and the mutation.
 */
async function saveAQuote(
  user: ReturnType<typeof userEvent.setup>,
): Promise<void> {
  await user.click(screen.getByRole("button", { name: /novo orçamento/i }));
  await user.click(screen.getByRole("button", { name: /criar orçamento/i }));
}

describe("H-4 — StudioQuotesView PII write gate", () => {
  let idb: ReturnType<typeof createFakeIndexedDb>;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });
  let user: ReturnType<typeof userEvent.setup>;

  function lockVault(): void {
    configurePiiStoreRuntime(options());
    installPiiStoreRuntimeEnvironment();
  }

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    window.localStorage.clear();
    setDemoSuppressedForPiiGate(false);
    useDemoModeStore.setState({ isActive: false, snapshot: null });
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
    useCustomerStore.setState({ customers: [] });
    user = userEvent.setup();
  });

  afterEach(() => {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    useDemoModeStore.setState({ isActive: false, snapshot: null });
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("locked: saving creates nothing and the refusal is VISIBLE, not silent", async () => {
    lockVault();
    const legacyQuoteStorage = JSON.stringify({
      state: { quotes: [quote], nextNumber: 2 },
      version: 1,
    });
    window.localStorage.setItem(LEGACY_QUOTE_STORAGE_KEY, legacyQuoteStorage);
    const persistedLocalStorageBefore = Array.from(
      { length: window.localStorage.length },
      (_, index) => {
        const key = window.localStorage.key(index);
        return [
          key,
          key === null ? null : window.localStorage.getItem(key),
        ] as const;
      },
    ).sort(([left], [right]) => (left ?? "").localeCompare(right ?? ""));
    const persistedDatabasesBefore = idb.databaseNames();

    render(<StudioQuotesView />);

    await saveAQuote(user);

    // 1. No ghost quote in memory.
    expect(useQuoteStore.getState().quotes).toHaveLength(0);

    // Neither the encrypted vault nor the legacy plaintext/localStorage key
    // may be created or changed by a refused write.
    expect(persistedDatabasesBefore).toEqual([]);
    expect(idb.databaseNames()).toEqual(persistedDatabasesBefore);
    expect(
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const key = window.localStorage.key(index);
        return [
          key,
          key === null ? null : window.localStorage.getItem(key),
        ] as const;
      }).sort(([left], [right]) => (left ?? "").localeCompare(right ?? "")),
    ).toEqual(persistedLocalStorageBefore);
    expect(window.localStorage.getItem(LEGACY_QUOTE_STORAGE_KEY)).toBe(
      legacyQuoteStorage,
    );

    // 2. The refusal is recorded with a typed reason.
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.quotes,
      reason: "profile_locked",
    });

    // 3. And, the half that makes the refusal useful, it is on screen.
    expect(
      await screen.findByText(/privacy\.vault\.writeRefusedTitle/),
    ).toBeInTheDocument();
  });

  it("locked: no success banner is shown — the UI must never claim 'saved'", async () => {
    lockVault();

    render(<StudioQuotesView />);

    await saveAQuote(user);

    expect(screen.queryByText("quotes.saveSuccess")).not.toBeInTheDocument();
    expect(screen.queryByText("quotes.updatedSuccess")).not.toBeInTheDocument();
  });

  it("unlocked: the quote is written and survives a reload", async () => {
    configurePiiStoreRuntime(options());
    await unlockPiiStoresAndRehydrate(PASS, options());

    const first = render(<StudioQuotesView />);
    await saveAQuote(user);

    // Written to the vault, not just to memory.
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
    const saved = useQuoteStore.getState().quotes[0];
    expect(saved.total).toBeGreaterThan(0);
    expect(await screen.findByText("quotes.saveSuccess")).toBeInTheDocument();

    // Simulate a reload: unmount, tear the store down, and return as a returning
    // user would — the vault is sealed again, so the passphrase is required. If
    // the write only ever reached memory, the list comes back empty here.
    first.unmount();
    await whenPiiWritesSettled();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    useQuoteStore.setState({ quotes: [], nextNumber: 1 });
    expect(useQuoteStore.getState().quotes).toHaveLength(0);

    await unlockPiiStoresAndRehydrate(PASS, options());

    render(<StudioQuotesView />);
    await waitFor(() =>
      expect(useQuoteStore.getState().quotes).toHaveLength(1),
    );
    expect(useQuoteStore.getState().quotes[0].total).toBe(saved.total);
  });

  it("a demo session stays silent by design (LGPD: demo writes are ephemeral)", async () => {
    configurePiiStoreRuntime(options());
    setDemoSuppressedForPiiGate(true);

    render(<StudioQuotesView />);
    await saveAQuote(user);

    // The write is allowed…
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
    // …but warning about it would be dishonest: it is intentional and ephemeral.
    expect(
      screen.queryByText(/privacy\.vault\.writeRefusedTitle/),
    ).not.toBeInTheDocument();
  });

  it("locked: customer creation is refused before the Zustand store changes", async () => {
    lockVault();
    render(
      <StudioCustomerView onTabChange={() => {}} onOpenQuoteModal={() => {}} />,
    );

    await user.click(screen.getByRole("button", { name: "Cadastrar Cliente" }));
    await user.type(
      screen.getByPlaceholderText("Ex: João da Silva"),
      "Nova Cliente",
    );
    await user.click(screen.getByRole("button", { name: /^Cadastrar$/ }));

    expect(useCustomerStore.getState().customers).toHaveLength(0);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.customers,
      reason: "profile_locked",
    });
    expect(
      await screen.findByText(/privacy\.vault\.writeRefusedTitle/),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ex: João da Silva"),
    ).toBeInTheDocument();
  });

  it("locked: customer edits and deletes are refused before mutation", async () => {
    lockVault();
    useCustomerStore.setState({ customers: [customer] });
    render(
      <StudioCustomerView onTabChange={() => {}} onOpenQuoteModal={() => {}} />,
    );

    await user.click(screen.getByTitle("Editar Cliente"));
    await user.clear(screen.getByPlaceholderText("Ex: João da Silva"));
    await user.type(
      screen.getByPlaceholderText("Ex: João da Silva"),
      "Ana Alterada",
    );
    await user.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    expect(useCustomerStore.getState().customers[0].name).toBe(customer.name);
    expect(
      await screen.findByText(/privacy\.vault\.writeRefusedTitle/),
    ).toBeInTheDocument();

    await user.click(screen.getByTitle("Excluir Cliente"));
    expect(useCustomerStore.getState().customers).toHaveLength(1);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.customers,
      reason: "profile_locked",
    });
  });

  it("locked: quote status changes and deletes are refused before mutation", async () => {
    lockVault();
    useQuoteStore.setState({ quotes: [quote], nextNumber: 2 });
    render(<StudioQuotesView />);

    await user.click(screen.getByTitle("Visualizar Proposta"));
    await user.click(screen.getByRole("button", { name: "Aprovado" }));

    expect(useQuoteStore.getState().quotes[0].status).toBe("draft");
    expect(
      await screen.findByText(/privacy\.vault\.writeRefusedTitle/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "✕" }));
    await user.click(screen.getByTitle("Excluir Orçamento"));
    await user.click(screen.getByRole("button", { name: /^Excluir$/ }));

    expect(useQuoteStore.getState().quotes).toHaveLength(1);
    expect(getLastPiiWriteRefusal()).toEqual({
      key: PII_STORE_KEY.quotes,
      reason: "profile_locked",
    });
  });

  it("demo: customer and quote WhatsApp shares are blocked with visible feedback", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    useDemoModeStore.setState({ isActive: true });
    useCustomerStore.setState({ customers: [customer] });

    const customerView = render(
      <>
        <DemoExportBlockedToast />
        <StudioCustomerView
          onTabChange={() => {}}
          onOpenQuoteModal={() => {}}
        />
      </>,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Enviar mensagem para Ana Cliente no WhatsApp",
      }),
    );
    expect(open).not.toHaveBeenCalled();
    expect(
      await screen.findByText("demo.export.blockedTitle"),
    ).toBeInTheDocument();

    customerView.unmount();
    useQuoteStore.setState({ quotes: [quote], nextNumber: 2 });
    render(
      <>
        <DemoExportBlockedToast />
        <StudioQuotesView />
      </>,
    );
    await user.click(screen.getByTitle("Enviar no WhatsApp"));

    expect(open).not.toHaveBeenCalled();
    expect(
      await screen.findByText("demo.export.blockedTitle"),
    ).toBeInTheDocument();
  });

  it("demo: customer email cannot hand off to a native mail client", async () => {
    useDemoModeStore.setState({ isActive: true });
    useCustomerStore.setState({ customers: [customer] });
    render(
      <>
        <DemoExportBlockedToast />
        <StudioCustomerView
          onTabChange={() => {}}
          onOpenQuoteModal={() => {}}
        />
      </>,
    );

    expect(
      screen.queryByRole("link", { name: customer.email }),
    ).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /e-mail.*Ana Cliente/i }),
    );
    expect(
      await screen.findByText("demo.export.blockedTitle"),
    ).toBeInTheDocument();
  });

  it("quote action names identify the quote and customer in list and card views", async () => {
    useCustomerStore.setState({ customers: [customer] });
    useQuoteStore.setState({
      quotes: [{ ...quote, customerId: customer.id }],
      nextNumber: 2,
    });
    render(<StudioQuotesView />);

    expect(
      screen.getByRole("button", {
        name: "Baixar orçamento #001 de Ana Cliente em PDF",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Enviar orçamento #001 de Ana Cliente no WhatsApp",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Editar orçamento #001 de Ana Cliente",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Excluir orçamento #001 de Ana Cliente",
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByTitle("Visualização em Grade de Cards"));

    expect(
      screen.getByRole("button", {
        name: "Baixar orçamento #001 de Ana Cliente em PDF",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Enviar orçamento #001 de Ana Cliente no WhatsApp",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Editar orçamento #001 de Ana Cliente",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Excluir orçamento #001 de Ana Cliente",
      }),
    ).toBeInTheDocument();
  });
});
