/**
 * Beta5 desktop re-home — the SAME contract as the web re-home, sourced from
 * the SQLite legacy rows over IPC instead of `localStorage`.
 *
 * On desktop the three migrated PII keys live as `storage` rows that the
 * persistence bridge deliberately stops hydrating, so a legacy profile unlocks
 * to EMPTY stores while the records stay in plaintext. `fetchLegacy` supplies
 * that residue (the renderer twin of `privacy:legacy-rows`) and the rest of the
 * contract is unchanged: consent-gated, fail-closed on a locked vault,
 * copy-without-delete, verify-before-complete, idempotent.
 *
 * Real Web Crypto, the real vault gate, a fake IndexedDB — no crypto mocks
 * (TEST-MATRIX §0). Synthetic fixtures only. The desktop residue is a plain map
 * here (a test must not need a SQLite file to exercise the renderer contract);
 * `electron/__tests__/legacyRows.test.ts` covers the real reader.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGACY_PII_REHOME_MARKER_KEY,
  migrateLegacyPlaintextPiiToVault,
} from "@/shared/lib/migration/legacyPiiRehome";
import type {
  DesktopLegacyPiiRowsResult,
  LegacyPiiRowMap,
} from "@/shared/lib/migration/desktopLegacyRows";
import { LEGACY_PII_PLAINTEXT_KEYS } from "@/shared/lib/legacyPiiPlaintext";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useHistoryStore } from "@/shared/stores/historyStore";
import {
  configurePiiStoreRuntime,
  readPiiPersistedRecord,
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
import type { Customer, HistoryEntry, Quote } from "@/shared/types";

const CUSTOMERS = "open3dcalc_customers_v1";
const QUOTES = "open3dcalc_quotes_v1";
const HISTORY = "open3dcalc_history_v2";
const PASS = "senha-sintetica-desktop-rehome-4242";

const CUSTOMER_FIXTURES: Customer[] = [
  {
    id: "legacy_cust_1",
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
    id: "legacy_cust_2",
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

const QUOTE_FIXTURE = {
  id: "legacy_quote_1",
  number: 7,
  title: "Orçamento Sintético",
  customerId: "legacy_cust_1",
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
} as unknown as Quote;

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
  historyFixture("legacy_hist_2", 1_700_000_000_202),
  historyFixture("legacy_hist_1", 1_700_000_000_101),
];

/** A zustand-wrapper value, the shape the old bridge stored in SQLite. */
function wrapper(field: string, records: unknown[]): string {
  return JSON.stringify({ state: { [field]: records }, version: 1 });
}

/** The desktop residue: the SQLite `storage` values the IPC reader returns. */
function desktopResidue(): LegacyPiiRowMap {
  return {
    [CUSTOMERS]: wrapper("customers", CUSTOMER_FIXTURES),
    [QUOTES]: wrapper("quotes", [QUOTE_FIXTURE]),
    [HISTORY]: wrapper("entries", HISTORY_FIXTURES),
  };
}

function sourceWithRows(rows: LegacyPiiRowMap): DesktopLegacyPiiRowsResult {
  return { status: "available", rows };
}

async function drainWrites(): Promise<void> {
  await whenPiiWritesSettled();
  await new Promise((resolve) => setTimeout(resolve, 0));
  await whenPiiWritesSettled();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("Beta5 desktop re-home — migrateLegacyPlaintextPiiToVault over IPC source", () => {
  let idb: FakeIndexedDb;
  const options = () => ({
    indexedDb: idb.factory,
    environment: PII_STORE_ENVIRONMENT,
  });

  function resetAll(): void {
    resetPiiStoreGateForTests();
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    zeroizeSessionPassphrase();
    setPiiPersistenceDeclined(false);
    setDemoPersistenceSuppressed(false);
    window.localStorage.clear();

    useCustomerStore.setState({ customers: [], searchQuery: "" });
    useQuoteStore.setState({
      quotes: [],
      nextNumber: 1,
      searchQuery: "",
      statusFilter: "all",
    });
    useHistoryStore.setState({
      entries: [],
      search: "",
      sortBy: "date",
      sortOrder: "desc",
      filterType: "all",
      dateFrom: null,
      dateTo: null,
    });
    useConsentStore.setState({
      privacyBannerDismissed: false,
      consentGiven: false,
      consentDate: null,
      receipt: null,
      receiptDigest: null,
      withdrawnReceipts: [],
      migrationConsentGiven: false,
      migrationConsentDate: null,
      migrationReceipt: null,
      migrationReceiptDigest: null,
      withdrawnMigrationReceipts: [],
    });
  }

  async function unlockVault(): Promise<void> {
    await unlockPiiStoresAndRehydrate(PASS, options());
    await drainWrites();
  }

  beforeEach(() => {
    idb = createFakeIndexedDb();
    resetAll();
    setPiiStoreEnvironment(PII_STORE_ENVIRONMENT);
    configurePiiStoreRuntime(options());
  });

  afterEach(() => {
    resetAll();
    delete (window as { electronAPI?: unknown }).electronAPI;
  });

  // ── 1. Locked vault refuses, writing nothing ────────────────────────

  it("refuses a locked vault without persisting any of the desktop residue", async () => {
    const residue = desktopResidue();
    const fetchLegacy = vi.fn(async () => sourceWithRows(residue));
    await useConsentStore.getState().grantMigrationConsent();

    // No unlock: the vault is locked.
    const result = await migrateLegacyPlaintextPiiToVault({ fetchLegacy });

    expect(result.status).toBe("vault_unavailable");
    expect(result.migratedKeys).toEqual([]);
    // The residue was read for detection only; nothing was opened or written.
    expect(fetchLegacy).toHaveBeenCalled();
    expect(idb.databaseNames()).toEqual([]);
    expect(
      window.localStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY),
    ).toBeNull();
    // Copy-without-delete: the "SQLite" source map is unchanged.
    expect(residue[CUSTOMERS]).toBe(wrapper("customers", CUSTOMER_FIXTURES));
    expect(useCustomerStore.getState().customers).toHaveLength(0);
  });

  // ── 2. Consent gate ─────────────────────────────────────────────────

  it("refuses without migration consent and writes nothing", async () => {
    const fetchLegacy = vi.fn(async () => sourceWithRows(desktopResidue()));
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({ fetchLegacy });

    expect(result.status).toBe("consent_required");
    expect(await readPiiPersistedRecord(CUSTOMERS)).toBeNull();
    expect(
      window.localStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY),
    ).toBeNull();
  });

  // ── 3. Happy path: vault verified, source preserved, nothing in localStorage ─

  it("copies the desktop residue into the vault, verifies it, and never writes PII to localStorage", async () => {
    const residue = desktopResidue();
    const origins = { ...residue };
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => sourceWithRows(residue),
    });

    expect(result.status).toBe("migrated");
    expect([...result.migratedKeys].sort()).toEqual(
      [...LEGACY_PII_PLAINTEXT_KEYS].sort(),
    );

    // In-memory stores hold the re-homed records.
    expect(useCustomerStore.getState().customers).toHaveLength(2);
    expect(useQuoteStore.getState().quotes).toHaveLength(1);
    expect(useHistoryStore.getState().entries).toHaveLength(2);

    // The encrypted destination VERIFIABLY holds them.
    const vaultCustomers = JSON.parse(
      (await readPiiPersistedRecord(CUSTOMERS)) as string,
    ) as { state: { customers: Customer[] } };
    expect(vaultCustomers.state.customers.map((c) => c.id).sort()).toEqual([
      "legacy_cust_1",
      "legacy_cust_2",
    ]);

    // Copy-without-delete: the desktop source map is byte-identical.
    for (const key of LEGACY_PII_PLAINTEXT_KEYS) {
      expect(residue[key]).toBe(origins[key]);
    }

    // The renderer NEVER mirrors the residue into localStorage: the three PII
    // keys are absent there (the persistence bridge refuses them) and only the
    // value-free marker is present.
    for (const key of LEGACY_PII_PLAINTEXT_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull();
    }
    const marker = window.localStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY);
    expect(marker).not.toBeNull();
    expect(marker).not.toMatch(
      /Ana|Bruno|legacy_cust|legacy_hist|example\.com/,
    );
  });

  // ── 4. Idempotency ──────────────────────────────────────────────────

  it("is idempotent: a second run re-imports nothing and overwrites nothing", async () => {
    const residue = desktopResidue();
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const first = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => sourceWithRows(residue),
    });
    expect(first.status).toBe("migrated");
    const vaultBefore = await readPiiPersistedRecord(CUSTOMERS);

    const second = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => sourceWithRows(residue),
    });
    expect(second.status).toBe("already_migrated");
    expect(useCustomerStore.getState().customers).toHaveLength(2);
    expect(await readPiiPersistedRecord(CUSTOMERS)).toBe(vaultBefore);
  });

  // ── 5. Corrupt source does not destroy the destination ──────────────

  it("does not destroy the destination when a desktop legacy value is corrupt", async () => {
    // Session 1: a real, unrelated vault record for the same key.
    await unlockVault();
    useHistoryStore.getState().addEntry(historyFixture("keep_me", 1));
    await drainWrites();
    const destinationBefore = await readPiiPersistedRecord(HISTORY);
    expect(destinationBefore).toContain("keep_me");

    // Fresh session, corrupt desktop residue for the same key.
    lockAllPiiStores();
    resetPiiStoreRuntimeForTests();
    resetPiiStoreHydrationForTests();
    configurePiiStoreRuntime(options());
    useHistoryStore.setState({ entries: [] });
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => sourceWithRows({ [HISTORY]: "{ not json" }),
    });

    expect(result.status).toBe("incomplete");
    expect(result.skippedKeys).toContain(HISTORY);
    // Destination byte-identical: corruption never overwrites the vault.
    expect(await readPiiPersistedRecord(HISTORY)).toBe(destinationBefore);
    expect(
      window.localStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY),
    ).toBeNull();
  });

  // ── 6. No desktop source → the web path is untouched ────────────────

  it("does not infer absence when the desktop fetch is unavailable", async () => {
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => ({
        status: "unavailable",
        reason: "bridge_missing",
      }),
    });

    expect(result.status).toBe("source_unavailable");
  });

  it("reports no_residue only for a positively established absent source", async () => {
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({
      fetchLegacy: async () => ({ status: "absent" }),
    });

    expect(result.status).toBe("no_residue");
  });

  it("uses the localStorage residue and never touches IPC when it is present", async () => {
    window.localStorage.setItem(
      CUSTOMERS,
      wrapper("customers", CUSTOMER_FIXTURES),
    );
    const fetchLegacy = vi.fn(async () => sourceWithRows(desktopResidue()));
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault({ fetchLegacy });

    expect(result.status).toBe("migrated");
    // The sync source won: the async desktop source was not consulted.
    expect(fetchLegacy).not.toHaveBeenCalled();
  });

  // ── 7. The default source is the read-only IPC reader ───────────────

  it("reads the desktop residue through electronAPI.privacy.legacyRows by default", async () => {
    const residue = desktopResidue();
    const legacyRows = vi.fn(async () => ({
      scannedAt: new Date().toISOString(),
      rows: LEGACY_PII_PLAINTEXT_KEYS.map((key) => ({
        key,
        value: residue[key] ?? null,
        status: residue[key] ? "legacy_plaintext" : "absent",
      })),
    }));
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows },
    };
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault();

    expect(legacyRows).toHaveBeenCalled();
    expect(result.status).toBe("migrated");
    expect(useCustomerStore.getState().customers).toHaveLength(2);
  });

  it("reports source_unavailable when the IPC reader refuses (fail-closed, no throw)", async () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = {
      privacy: { legacyRows: async () => Promise.reject(new Error("refused")) },
    };
    await useConsentStore.getState().grantMigrationConsent();
    await unlockVault();

    const result = await migrateLegacyPlaintextPiiToVault();

    expect(result.status).toBe("source_unavailable");
    expect(
      window.localStorage.getItem(LEGACY_PII_REHOME_MARKER_KEY),
    ).toBeNull();
  });
});
