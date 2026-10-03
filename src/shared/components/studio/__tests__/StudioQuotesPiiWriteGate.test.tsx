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
    window.localStorage.clear();
  });

  it("locked: saving creates nothing and the refusal is VISIBLE, not silent", async () => {
    lockVault();

    render(<StudioQuotesView />);

    await saveAQuote(user);

    // 1. No ghost quote in memory.
    expect(useQuoteStore.getState().quotes).toHaveLength(0);

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
});
