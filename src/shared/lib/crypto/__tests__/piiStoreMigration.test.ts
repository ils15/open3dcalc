/**
 * Wave 3 — the three verified-active PII stores, migrated onto the vault.
 *
 * Before this change the stores persisted through `manifestStorage()` straight
 * into plaintext `localStorage`. These specs pin the four properties that make
 * the migration real, and the one that makes it safe:
 *
 *  1. **Locked is not empty.** A locked store does not hydrate, and its first
 *     `set()` cannot overwrite the vault with its initial state. This is the
 *     data-loss path, and it is the assertion that fails against the plaintext
 *     wiring.
 *  2. **Unlock restores exactly.** After unlock every store rehydrates the same
 *     records, in the same order, with the same fields.
 *  3. **Writes round-trip.** A write while unlocked is readable after a fresh
 *     unlock in the same profile.
 *  4. **The vault is in use.** A write leaves NO plaintext `localStorage` entry
 *     for the migrated key — the proof that the plaintext limitation is closed.
 *  5. **Legacy residue is detectable**, with counts, so the next wave has no
 *     discovery to do.
 *
 * Real Web Crypto, real envelope code, synthetic fixtures only (TEST-MATRIX §0).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
vi.hoisted(() => {
  Object.defineProperty(globalThis.navigator, "userAgent", {
    configurable: true,
    value: "Mozilla/5.0 Electron/43.0",
  });
});
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useProductInventory } from "@/shared/stores/productInventory";
import {
  PII_STORE_KEYS,
  configurePiiStoreRuntime,
  gatedPiiPersistStorage,
  getLastPiiWriteRefusal,
  getPiiStoreHydrationStatus,
  rehydratePiiStores,
  resetPiiStoreHydrationForTests,
  unlockPiiStoresAndRehydrate,
  whenPiiWritesSettled,
} from "@/shared/lib/crypto/piiStoreHydration";
import {
  PiiStoreDeniedError,
  createPiiStore,
  lockAllPiiStores,
  resetPiiStoreRuntimeForTests,
} from "@/shared/lib/crypto/piiStore";
import {
  setPiiPersistenceDeclined,
  setPiiStoreEnvironment,
} from "@/shared/lib/crypto/piiStoreCapability";
import { setDemoPersistenceSuppressed } from "@/shared/lib/manifestStorage";
import { zeroizeSessionPassphrase } from "@/shared/lib/crypto/passphraseSession";
import { PII_STORE_ENVIRONMENT } from "@/shared/lib/crypto/__tests__/piiStoreFixtures";
import {
  createFakeIndexedDb,
  type FakeIndexedDb,
} from "@/shared/test/fakeIndexedDb";
import { detectLegacyPlaintextPii } from "@/shared/lib/legacyPiiPlaintext";
import type { HistoryEntry } from "@/shared/types";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";
const PASS = "senha-sintética-wave-3-4242";

/**
 * The real write path used by a migrated store, reconstructed exactly. A test
 * that wants to observe a refused `set()` drives this directly, which is what
 * zustand's wrapped `set` does with the store's own storage.
 */
function gatedStorageFor<S>(key: string) {
  return gatedPiiPersistStorage<S>(key);
}

const CUSTOMER_FIXTURES = [
  {
    id: "cust_1",
    name: "Ana Síntética",
    company: "Ana Ltda",
    email: "ana@example.com",
    phone: "11999990000",
    address: "Rua A, 1",
    notes: "primeira",
    createdAt: 1_700_000_000_001,
    updatedAt: 1_700_000_000_001,
    quoteCount: 2,
  },
  {
    id: "cust_2",
    name: "Bruno Sintético",
    company: "Bruno ME",
    email: "bruno@example.com",
    phone: "11999990001",
    address: "Rua B, 2",
    notes: "segunda",
    createdAt: 1_700_000_000_002,
    updatedAt: 1_700_000_000_002,
    quoteCount: 0,
  },
];

function historyFixture(id: string, timestamp: number): HistoryEntry {
  return {
    id,
    timestamp,
    type: "fdm",
    name: id,
    summary: "synthetic",
    totalCost: 10,
    sellPrice: 20,
    profit: 10,
    result: {
      materialCost: 1,
      energyCost: 1,
      machineCost: 1,
      hardwareCost: 1,
      consumablesCost: 1,
      laborCost: 1,
      softwareCost: 1,
      failureCost: 1,
      extrasCost: 1,
      postProcessingCost: 1,
      subtotal: 10,
      totalCost: 10,
      sellPrice: 20,
      profit: 10,
      marketplaceFee: 0,
      taxAmount: 0,
      costPerGram: 0.2,
      costPerUnit: 10,
      unitWeight: 50,
      estimatedPrintTime: 1,
      targetMarginPercent: 50,
      breakEvenPrice: 10,
      actualMargin: 50,
      carbonFootprintGrams: 1,
    },
    snapshot: null,
  } as HistoryEntry;
}

const HISTORY_FIXTURES = [
  historyFixture("hist_2", 1_700_000_000_202),
  historyFixture("hist_1", 1_700_000_000_101),
];

const QUOTE_FIXTURE = {
  id: "quote_1",
  number: 7,
  title: "Orçamento Sintético",
  customerId: "cust_1",
  customerSnapshot: undefined,
  items: [],
  globalDiscountPercent: 5,
  subtotal: 0,
  discountAmount: 0,
  total: 0,
  status: "draft" as const,
  validUntil: "2026-12-31",
  paymentTerms: "30 dias",
  deliveryEstimate: "5 dias",
  footerNote: undefined,
  createdAt: 1_700_000_000_010,
  updatedAt: 1_700_000_000_010,
};

/**
 * Wait for the vault writes the store's actions issued to commit.
 *
 * A store action persists fire-and-forget; this barrier resolves once those
 * writes have settled, so a test can then read what actually landed.
 */
async function drainWrites(): Promise<void> {
  await whenPiiWritesSettled();
}

/** Reset in-memory state WITHOUT writing, so each test starts from known data. */
function seedInMemory() {
  useCustomerStore.setState({
    customers: structuredClone(CUSTOMER_FIXTURES),
    searchQuery: "",
  });
  useQuoteStore.setState({
    quotes: [structuredClone(QUOTE_FIXTURE)],
    nextNumber: 8,
    searchQuery: "",
    statusFilter: "all",
  });
  useHistoryStore.setState({
    entries: structuredClone(HISTORY_FIXTURES),
    search: "",
    sortBy: "date",
    sortOrder: "desc",
    filterType: "all",
    dateFrom: null,
    dateTo: null,
  });
}

/** The locked/refused shape a store write produces. */
async function attemptWrite<S>(key: string, value: unknown): Promise<unknown> {
  return gatedStorageFor<S>(key)
    .setItem(key, value as never)
    .then(
      () => null,
      (error: unknown) => error,
    );
}

describe("Wave 3 — PII stores on the vault", () => {
  let idb: FakeIndexedDb;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  beforeEach(() => {
    idb = createFakeIndexedDb();
    setPiiStoreEnvironment(PII_STORE_ENVIRONMENT);
    setPiiPersistenceDeclined(false);
    setDemoPersistenceSuppressed(false);
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    zeroizeSessionPassphrase();
    window.localStorage.clear();
    seedInMemory();
  });

  afterEach(() => {
    setPiiStoreEnvironment(null);
    setPiiPersistenceDeclined(false);
    setDemoPersistenceSuppressed(false);
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    window.localStorage.clear();
  });

  // ── 1. Locked is not empty ──────────────────────────────────────────

  it("does not hydrate while locked and cannot overwrite the vault with its initial state", async () => {
    // Unlock once and persist the REAL records through the store's own action.
    await unlockPiiStoresAndRehydrate(PASS, options());
    useCustomerStore.setState({ customers: [] });
    useCustomerStore.getState().addCustomer({
      name: "Registro Real",
      company: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });
    // Drain the fire-and-forget write: the vault serialises per key, so a
    // no-op write resolves only after the store's write committed. The record
    // is therefore empty of the initial state we are about to prove cannot
    // overwrite it.
    await drainWrites();
    const before = await createPiiStore(CUSTOMERS, options()).read();
    expect(before).not.toBeNull();
    // The record holds the drain marker, NOT the initial empty customer list:
    // the action's own write was the pre-drain state, and this proves the store
    // can write at all before we lock it.
    expect(before).not.toContain('"customers":[]');
    // Lock: a fresh app process with no passphrase.
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());

    // A locked store must NOT have hydrated, even after an attempted rehydrate.
    expect(getPiiStoreHydrationStatus(CUSTOMERS)).toBe("idle");
    await rehydratePiiStores();
    expect(getPiiStoreHydrationStatus(CUSTOMERS)).toBe("failed");

    // The store's first `set()` (the empty-state persist path) is refused…
    const error = await attemptWrite(CUSTOMERS, {
      state: { customers: [] },
      version: 1,
    });
    expect(error).toBeInstanceOf(PiiStoreDeniedError);
    expect((error as PiiStoreDeniedError).reason).toBe("profile_locked");

    // …and the vault still holds the previous record, byte-identical: neither
    // the failed rehydrate nor the refused write touched it. Reading the vault
    // to PHOTOGRAPH the test's result is a deliberate test-only unlock, not an
    // application path: it changes no record, and the assertion below proves
    // the record is exactly what the locked session left behind.
    await unlockPiiStoresAndRehydrate(PASS, options());
    expect(await createPiiStore(CUSTOMERS, options()).read()).toBe(before);
  });

  it("a locked store action does not throw and records a typed refusal", async () => {
    lockAllPiiStores();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    await rehydratePiiStores();

    // A store action performs `set(...)`; zustand's wrapped set calls
    // `storage.setItem` and ignores the promise. The action must not throw.
    expect(() => useHistoryStore.getState().setSearch("query")).not.toThrow();
    // The refusal is recorded synchronously, but the rejected write is a
    // promise: await the gate's own write barrier rather than guessing a tick.
    await whenPiiWritesSettled();
    expect(getLastPiiWriteRefusal()).toEqual({
      key: HISTORY,
      reason: "profile_locked",
    });
  });

  it("refuses a NOT-YET-HYDRATED write even when the vault itself is unlocked", async () => {
    // The vault holds a key. Await only the unlock, so the stores are still
    // unhydrated. A write from their initial state would persist emptiness
    // over the record, so the gate refuses it independently of the lock state.
    await unlockPiiStoresAndRehydrate(PASS, options());
    await createPiiStore(CUSTOMERS, options()).write(
      '{"state":{"customers":[{"id":"keep"}]},"version":1}',
    );
    // Simulate a fresh store that never rehydrated.
    resetPiiStoreHydrationForTests();

    const error = await attemptWrite(CUSTOMERS, {
      state: { customers: [] },
      version: 1,
    });
    expect(error).toBeInstanceOf(PiiStoreDeniedError);
    expect((error as PiiStoreDeniedError).reason).toBe("profile_locked");
    // The stored record is untouched.
    expect(await createPiiStore(CUSTOMERS, options()).read()).toContain("keep");
  });

  // ── 2. Unlock restores exactly ──────────────────────────────────────

  it("rehydrates each store to the exact persisted state after unlock", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());

    // A FRESH process starts empty; body hydration is what fills it.
    useCustomerStore.setState({ customers: [], searchQuery: "" });
    useQuoteStore.setState({ quotes: [], nextNumber: 1, statusFilter: "all" });
    useHistoryStore.setState({ entries: [] });

    // First session writes known records through the actions.
    useCustomerStore.getState().addCustomer({
      ...CUSTOMER_FIXTURES[0],
      name: "Ana Síntética",
    } as never);
    useQuoteStore.getState().addQuote({
      title: QUOTE_FIXTURE.title,
      items: [],
      globalDiscountPercent: 5,
      validUntil: "2026-12-31",
      paymentTerms: "30 dias",
      deliveryEstimate: "5 dias",
    });
    useHistoryStore.getState().addEntry(HISTORY_FIXTURES[0]);
    await drainWrites();

    const expectedCustomers = structuredClone(
      useCustomerStore.getState().customers,
    );
    const expectedQuotes = structuredClone(useQuoteStore.getState().quotes);
    const expectedEntries = structuredClone(useHistoryStore.getState().entries);

    // A FRESH process: lock, wipe in-memory, reset hydration, unlock, rehydrate.
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    useCustomerStore.setState({ customers: [], searchQuery: "" });
    useQuoteStore.setState({ quotes: [], nextNumber: 1, statusFilter: "all" });
    useHistoryStore.setState({ entries: [] });
    configurePiiStoreRuntime(options());

    const outcomes = await unlockPiiStoresAndRehydrate(PASS, options());
    expect(outcomes.map((o) => o.status)).toEqual([
      "hydrated",
      "hydrated",
      "hydrated",
    ]);

    expect(useCustomerStore.getState().customers).toEqual(expectedCustomers);
    expect(useQuoteStore.getState().quotes).toEqual(expectedQuotes);
    // Same records, same order, same fields.
    expect(useHistoryStore.getState().entries).toEqual(expectedEntries);
  });

  // ── 3. Writes round-trip ────────────────────────────────────────────

  it("round-trips a write to the vault and reads it after a fresh unlock", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());

    useCustomerStore.setState({ customers: [] });
    const id = useCustomerStore.getState().addCustomer({
      name: "Round Trip",
      company: "RT Co",
      email: "rt@example.com",
      phone: "",
      address: "",
      notes: "",
    });
    // Wait for the persistence barrier (a following no-op write), so the
    // record is committed under the name this test owns — "Round Trip".
    await drainWrites();

    // Fresh unlock in the same profile.
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    useCustomerStore.setState({ customers: [], searchQuery: "" });
    await unlockPiiStoresAndRehydrate(PASS, options());

    // The record this test wrote is there. Its id is regenerated on hydration
    // only if it never committed; `name` is the field the assertion is about.
    expect(
      useCustomerStore
        .getState()
        .customers.some((c) => c.name === "Round Trip"),
    ).toBe(true);
    void id;
  });

  // ── 4. The vault is genuinely in use ────────────────────────────────

  it("leaves no plaintext localStorage entry for any migrated key after a write", async () => {
    await unlockPiiStoresAndRehydrate(PASS, options());
    useCustomerStore.getState().addCustomer({
      name: "Sem Plaintext",
      company: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
    });
    useHistoryStore.getState().addEntry(HISTORY_FIXTURES[0]);
    await drainWrites();

    for (const key of PII_STORE_KEYS) {
      expect(
        window.localStorage.getItem(key),
        `plaintext residue under ${key}`,
      ).toBeNull();
    }

    // And the sealed records DO exist — this is not a vacuous pass.
    expect(await createPiiStore(CUSTOMERS, options()).read()).toBeTypeOf(
      "string",
    );
    expect(await createPiiStore(HISTORY, options()).read()).toBeTypeOf(
      "string",
    );
  });

  it("selects approved Stable Web plaintext and retains the Desktop vault path", () => {
    for (const file of [
      "customerStore.ts",
      "quoteStore.ts",
      "historyStore.ts",
    ]) {
      const source = readFileSync(
        resolve(__dirname, "..", "..", "..", "stores", file),
        "utf8",
      );
      expect(source).toContain("stablePiiPersistStorage");
      expect(source).toContain("gatedPiiPersistStorage");
      expect(source).toContain("skipHydration:");
    }
  });

  // ── 5. Fail-closed for the vault, usable for non-PII ────────────────

  it("refuses PII writes in an insecure context while non-PII stores still work", async () => {
    setPiiStoreEnvironment({
      browser: true,
      secureContext: false,
      webCryptoAvailable: true,
      indexedDbAvailable: true,
    });
    const error = await attemptWrite(CUSTOMERS, {
      state: { customers: [] },
      version: 1,
    });
    expect(error).toBeInstanceOf(PiiStoreDeniedError);
    expect((error as PiiStoreDeniedError).reason).toBe("insecure_context");

    // A non-PII store is unaffected: it keeps persisting through manifestStorage.
    useProductInventory.setState({ products: [] });
    useProductInventory.getState().addProduct({
      name: "Peça Não-PII",
      weightGrams: 10,
      filamentType: "PLA",
      costPrice: 1,
      salePrice: 2,
    });
    expect(window.localStorage.getItem("open3dcalc_products")).not.toBeNull();
  });

  it("a declined user is refused with consent_declined", async () => {
    setPiiPersistenceDeclined(true);
    const error = await attemptWrite(QUOTES, {
      state: { quotes: [] },
      version: 1,
    });
    expect(error).toBeInstanceOf(PiiStoreDeniedError);
    expect((error as PiiStoreDeniedError).reason).toBe("consent_declined");
  });

  it("a non-PII store still hydrates normally on import", () => {
    window.localStorage.setItem(
      "open3dcalc_products",
      JSON.stringify({
        state: {
          products: [
            {
              id: "p1",
              name: "Já persistido",
              weightGrams: 1,
              filamentType: "PLA",
              costPrice: 1,
              salePrice: 2,
              sold: false,
              createdAt: 1,
              updatedAt: 1,
            },
          ],
        },
        version: 1,
      }),
    );
    useProductInventory.persist.rehydrate();
    expect(useProductInventory.getState().products).toHaveLength(1);
    expect(useProductInventory.getState().products[0].name).toBe(
      "Já persistido",
    );
  });

  // ── Legacy plaintext detection ──────────────────────────────────────
  //
  // Detection reads `localStorage` directly, so it needs a store that no
  // earlier case's fire-and-forget vault write can still be landing in. A
  // dedicated block with its own `beforeEach` waits for those writes and then
  // clears storage, which is what makes the counts deterministic.

  describe("legacy plaintext detection", () => {
    beforeEach(async () => {
      await whenPiiWritesSettled();
      window.localStorage.clear();
    });

    it("detects legacy plaintext residue and reports per-key counts", () => {
      window.localStorage.setItem(
        CUSTOMERS,
        JSON.stringify({ state: { customers: CUSTOMER_FIXTURES }, version: 1 }),
      );
      window.localStorage.setItem(
        HISTORY,
        JSON.stringify({ state: { entries: HISTORY_FIXTURES }, version: 2 }),
      );

      const report = detectLegacyPlaintextPii();
      expect(report.present).toBe(true);
      // CUSTOMER_FIXTURES is 2 records and HISTORY_FIXTURES is 2, so the total
      // is 4 exactly: the assertions below pin each key's own count too, which
      // is what catches one key's residue being attributed to another.
      expect(report.total).toBe(4);
      expect(report.keys).toEqual([
        { key: CUSTOMERS, present: true, count: 2 },
        { key: QUOTES, present: false, count: 0 },
        { key: HISTORY, present: true, count: 2 },
      ]);
    });

    it("reports no residue when the three keys hold nothing", () => {
      const report = detectLegacyPlaintextPii();
      expect(report.present).toBe(false);
      expect(report.total).toBe(0);
      expect(report.keys.every((entry) => entry.count === 0)).toBe(true);
    });

    it("counts a raw pre-zustand array, and reports present-but-unrecognizable as present", () => {
      window.localStorage.setItem(QUOTES, JSON.stringify([QUOTE_FIXTURE]));
      window.localStorage.setItem(CUSTOMERS, "{not json");

      const report = detectLegacyPlaintextPii();
      const byKey = Object.fromEntries(
        report.keys.map((entry) => [entry.key, entry]),
      );
      expect(byKey[QUOTES]).toEqual({ key: QUOTES, present: true, count: 1 });
      // Present but unparseable: still present (there IS residue), count 0.
      expect(byKey[CUSTOMERS]).toEqual({
        key: CUSTOMERS,
        present: true,
        count: 0,
      });
    });
  });
});
