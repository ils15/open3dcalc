import { useEffect } from "react";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { isPersistableCalculationState } from "@/shared/lib/calculationState";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import { persistCalculatorSettings } from "@/shared/stores/calculatorStore.helpers";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import {
  MIGRATION_MARKER_KEY,
  MIGRATION_PROGRESS_KEY,
  historyMigrationProgressValue,
  isHistoryMigrationBackup,
  isHistoryMigrationProgress,
  type HistoryMigrationBackup,
} from "@/shared/lib/migration/marker";
import {
  MIGRATION_FINGERPRINT_KEY,
  migrationFingerprintValue,
} from "@/shared/lib/migration/migrationDrift";
import {
  didPiiWritesCommit,
  getPiiStoreHydrationStatus,
  readPiiPersistedRecord,
} from "@/shared/lib/crypto/piiStoreHydration";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { computeValidatedStoreResults } from "@/shared/stores/calculatorStore.validation";
import { getSharedCalculation } from "@/shared/lib/calculationLink";
import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialTabNavigation } from "@/shared/hooks/useTutorialTabNavigation";
import { seedDefaultStudioDataIfEmpty } from "@/shared/lib/initialWorkshopSeed";
import type { Tab } from "@/shared/components/AppShell/tabs";
import type {
  CalculationResult,
  CalculationSnapshot,
  HistoryEntry,
} from "@/shared/types";

/**
 * App bootstrap shared by both platforms (V2.0 Wave 1).
 *
 * Extracted verbatim from the duplicated App.tsx bodies: legacy-data
 * migration, the beforeunload autosave, URL-hash shared calculations, the
 * tutorial auto-start and the calculator→product deep link. Pure logic — no
 * UI — so both platforms run identical init.
 */

type LegacyProduct = {
  id?: string;
  timestamp?: number;
  name?: string;
  result?: CalculationResult;
  snapshot?: Partial<CalculationSnapshot> | null;
};

type LegacyHistoryItem = {
  id?: string;
  timestamp?: number;
  type?: "fdm" | "resin";
  summary?: string;
  totalCost?: number;
  sellPrice?: number;
  profit?: number;
  result?: CalculationResult;
  snapshot?: CalculationSnapshot | null;
};

const HISTORY_KEY = "open3dcalc_history_v2";
const PRODUCTS_KEY = "open3dcalc_products";

/**
 * What a legacy-history migration needs to run or resume — WITHOUT carrying any
 * record content.
 *
 * W4.4: the recovery marker must never be PII in plaintext. The preimage is no
 * longer needed because the mode is copy-without-delete: the legacy source is
 * never erased, so a resumed run re-reads it from the intact key. This context
 * therefore holds only value-free facts (the pre-import base entries, an opaque
 * product-source string used solely for the "can this key be dropped?" compare,
 * and two flags).
 */
type HistoryMigrationContext = {
  /** Entries that predated the import; the store resets to them on resume. */
  baseEntries: HistoryEntry[];
  /** The raw product source seen at start (business data, never PII). */
  productsSource?: string;
  /** Reset the store to `baseEntries` and re-import the full set (resume). */
  restoreBaseEntries: boolean;
  /** A legacy PII marker was consumed; clear it after verification (§3.3). */
  legacyMarker: boolean;
};

/** Parse a storage value into an array, or `undefined` when it is not one. */
function parseArrayOrUndefined(raw: string | null): unknown[] | undefined {
  if (raw === null) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A stable content signature for a history record that does NOT depend on its
 * id.
 *
 * A legacy record may omit the id; `addEntry` then assigns a GENERATED id that
 * differs on every run, so an id set alone cannot recognize the record an
 * interrupted run already added and the merge would duplicate it on every
 * resume. Two records with the same content produce the same signature, which
 * is what makes the id-less half of the merge idempotent. Value-preserving:
 * every persisted field that is not the id participates, and nothing is
 * invented.
 */
function entrySignature(entry: {
  timestamp?: number;
  type?: "fdm" | "resin";
  name?: string;
  summary?: string;
  totalCost?: number;
  sellPrice?: number;
  profit?: number;
  result?: unknown;
  snapshot?: unknown;
}): string {
  return JSON.stringify([
    entry.timestamp ?? null,
    entry.type ?? null,
    entry.name ?? null,
    entry.summary ?? null,
    entry.totalCost ?? null,
    entry.sellPrice ?? null,
    entry.profit ?? null,
    entry.result ?? null,
    entry.snapshot ?? null,
  ]);
}

const FALLBACK_RESULT: CalculationResult = {
  materialCost: 0,
  energyCost: 0,
  machineCost: 0,
  hardwareCost: 0,
  consumablesCost: 0,
  laborCost: 0,
  softwareCost: 0,
  failureCost: 0,
  extrasCost: 0,
  postProcessingCost: 0,
  subtotal: 0,
  totalCost: 0,
  sellPrice: 0,
  profit: 0,
  marketplaceFee: 0,
  taxAmount: 0,
  costPerGram: 0,
  costPerUnit: 0,
  unitWeight: 0,
  estimatedPrintTime: 0,
  targetMarginPercent: 0,
  breakEvenPrice: 0,
  actualMargin: 0,
  carbonFootprintGrams: 0,
};

async function migrateLegacyHistory(
  legacyItems: unknown[],
  context: HistoryMigrationContext,
  legacyProducts?: unknown[],
): Promise<boolean> {
  const historyStore = useHistoryStore.getState();
  const baseEntries = context.baseEntries;
  const historyEntries = legacyItems.map((item) => {
    const legacyItem = item as LegacyHistoryItem;
    return {
      id: legacyItem.id,
      timestamp: legacyItem.timestamp,
      type: legacyItem.type || "fdm",
      name: legacyItem.summary || "Histórico",
      summary: legacyItem.summary || "",
      totalCost: legacyItem.totalCost || 0,
      sellPrice: legacyItem.sellPrice || 0,
      profit: legacyItem.profit || 0,
      result: legacyItem.result || FALLBACK_RESULT,
      snapshot: legacyItem.snapshot || null,
    };
  });
  const productEntries = (legacyProducts ?? []).flatMap((item) => {
    const product = item as LegacyProduct;
    if (!product.result) return [];
    const type = product.snapshot?.type ?? "fdm";
    const summary = product.snapshot?.summary || product.name || "Produto";
    const totalCost = Number(product.result.totalCost || 0);
    const sellPrice = Number(product.result.sellPrice || 0);
    return [
      {
        id: product.id,
        timestamp: product.timestamp,
        type,
        name: product.name || "Produto",
        summary,
        totalCost,
        sellPrice,
        profit: sellPrice - totalCost,
        result: product.result,
        snapshot: (product.snapshot as CalculationSnapshot) || null,
      },
    ];
  });
  const productsFullyConvertible =
    legacyProducts !== undefined &&
    productEntries.length === legacyProducts.length;
  const entries = [
    ...(productsFullyConvertible ? productEntries : []),
    ...historyEntries,
  ];

  if (context.restoreBaseEntries) {
    // Discard any persisted prefix, retaining entries that predated the
    // legacy-history import (for example products migrated in this startup).
    useHistoryStore.setState({ entries: baseEntries });
  }

  const expected: Array<Record<string, unknown>> = baseEntries.map((entry) => ({
    ...entry,
  }));
  // Idempotent-merge guard: an entry already present is preserved as-is rather
  // than duplicated. On resume the base entries can already contain a record
  // this migration previously wrote (the interrupted run's durable prefix) or a
  // record the user created after the interruption; copy-without-delete also
  // means the legacy source still holds the same record. Skipping a known id
  // keeps the union lossless and duplicate-free.
  const seenIds = new Set(baseEntries.map((entry) => entry.id));
  // Id-less half of the guard (F3): a legacy record without an id gets a
  // GENERATED id on every run, so `seenIds` cannot match it. The stable content
  // signature can, which is what keeps the merge idempotent for that shape too.
  const seenSignatures = new Set(
    baseEntries.map((entry) => entrySignature(entry)),
  );
  for (const entry of entries) {
    if (entry.id !== undefined) {
      if (seenIds.has(entry.id)) continue;
    } else if (seenSignatures.has(entrySignature(entry))) {
      continue;
    }
    const id = historyStore.addEntry(entry);
    const migrated = historyStore.getEntry(id);
    if (!migrated) return false;
    if (entry.id !== undefined) seenIds.add(entry.id);
    seenSignatures.add(entrySignature(migrated));
    expected.push({
      id,
      timestamp: entry.timestamp ?? migrated.timestamp,
      type: entry.type,
      name: entry.name,
      summary: entry.summary,
      totalCost: entry.totalCost,
      sellPrice: entry.sellPrice,
      profit: entry.profit,
      result: entry.result,
      snapshot: entry.snapshot,
    });
  }

  const verified = (actual: unknown[]): boolean => {
    if (actual.length !== expected.length) return false;
    const actualById = new Map<string, Record<string, unknown>>();
    for (const value of actual) {
      if (!value || typeof value !== "object") return false;
      const record = value as Record<string, unknown>;
      if (typeof record.id !== "string" || actualById.has(record.id)) {
        return false;
      }
      actualById.set(record.id, record);
    }
    if (actualById.size !== expected.length) return false;
    return expected.every((entry) => {
      const migrated = actualById.get(entry.id as string);
      return (
        migrated !== undefined &&
        Object.entries(entry).every(
          ([key, value]) =>
            JSON.stringify(migrated[key]) === JSON.stringify(value),
        )
      );
    });
  };

  const inMemoryEntries = useHistoryStore.getState().entries;
  if (!verified(inMemoryEntries)) return false;

  // Verify against the LIVE destination.
  //
  // After Wave 3 the history store persists through the encrypted vault, so the
  // migration must confirm the vault holds what it just wrote before it removes
  // the durable recovery marker. The write is asynchronous, so this awaits the
  // gate's write barrier first, then reads the sealed record back.
  //
  // The legacy localStorage key is read ONLY as compatibility INPUT: copy-and-
  // never-delete retains it, and it must not disagree with memory when present.
  // It is no longer written, so it is never the destination being verified.
  if (getPiiStoreHydrationStatus(HISTORY_KEY) === "hydrated") {
    // The vault is the live destination. Require every write the store issued
    // to have COMMITTED, and then read the sealed record back and confirm it
    // holds the full migrated set. A rejected write (the interrupted case) or a
    // record that does not match leaves the recovery marker in place so the
    // next startup can resume.
    if (!(await didPiiWritesCommit())) return false;
    const vaultRecord = await readPiiPersistedRecord(HISTORY_KEY);
    if (vaultRecord === null) return false;
    try {
      const persisted = JSON.parse(vaultRecord) as {
        state?: { entries?: unknown };
      };
      if (
        !Array.isArray(persisted.state?.entries) ||
        !verified(persisted.state.entries)
      ) {
        return false;
      }
    } catch {
      return false;
    }
  } else {
    const persistedSource = guardedStorage.getItem(HISTORY_KEY);
    if (persistedSource !== null) {
      try {
        const persisted = JSON.parse(persistedSource) as {
          state?: { entries?: unknown };
        };
        if (
          !Array.isArray(persisted.state?.entries) ||
          !verified(persisted.state.entries)
        ) {
          return false;
        }
      } catch {
        return false;
      }
    }
  }

  if (context.productsSource !== undefined && productsFullyConvertible) {
    // Retain the independent source until product and history entries have
    // both passed the in-memory and persisted-wrapper verification above.
    if (guardedStorage.getItem(PRODUCTS_KEY) === context.productsSource) {
      guardedStorage.removeItem(PRODUCTS_KEY);
    }
  }

  // W4.4: completion is recorded by REMOVING the value-free progress marker.
  // No record content is ever written. A legacy PII marker consumed on this run
  // is cleaned here too, only after the full set verified (§3.3).
  guardedStorage.removeItem(MIGRATION_PROGRESS_KEY);
  if (context.legacyMarker) {
    guardedStorage.removeItem(MIGRATION_MARKER_KEY);
  }

  // T4.6: register a VALUE-FREE fingerprint of the source just committed so a
  // later scan can disclose honestly whether the legacy source changed after
  // this logical commit. Counts only — never a record value. A product source
  // that was absent or dropped (fully converted) is recorded as `null`.
  guardedStorage.setItem(
    MIGRATION_FINGERPRINT_KEY,
    migrationFingerprintValue(
      legacyItems.length,
      legacyProducts === undefined || productsFullyConvertible
        ? null
        : legacyProducts.length,
    ),
  );
  return true;
}

function migrateLegacyData(): void {
  void migrateLegacyDataAsync().catch((error: unknown) => {
    console.warn("[useAppInit] Legacy migration failed:", error);
  });
}

/**
 * Resume a migration recorded by a LEGACY PII-bearing marker (an old build).
 *
 * Read compatibility only: the preimage lives in the marker's `source`, which
 * is consumed here. The marker is cleared after the run verifies (§3.3) — the
 * current code never writes it.
 *
 * MERGE, never reset: the marker's `baseEntries` is a STALE snapshot taken
 * before the interruption. Resetting to it would discard every entry created
 * after the interruption and would resurrect an entry the user deleted since.
 * The base this resume preserves is therefore the store's CURRENT contents,
 * exactly as `resumeFromLiveSource` does; the marker's embedded `source` is
 * merged on top, deduplicated, so the final set is the lossless union.
 */
async function resumeFromLegacyMarker(
  backup: HistoryMigrationBackup,
): Promise<void> {
  try {
    const parsed = JSON.parse(backup.source) as unknown;
    if (!Array.isArray(parsed)) return;
    await migrateLegacyHistory(
      parsed,
      {
        baseEntries: useHistoryStore.getState().entries,
        ...(backup.productsSource === undefined
          ? {}
          : { productsSource: backup.productsSource }),
        restoreBaseEntries: true,
        legacyMarker: true,
      },
      parseArrayOrUndefined(backup.productsSource ?? null),
    );
  } catch (error) {
    console.warn("Failed to recover open3dcalc_history_v2", error);
  }
}

/**
 * Resume a migration recorded by the value-free progress marker.
 *
 * Copy-without-delete guarantees the legacy source is still present, so the run
 * re-reads it rather than trusting a stored preimage — which is what lets the
 * marker be value-free. An unusable source clears the flag so it cannot stall
 * startup forever.
 */
async function resumeFromLiveSource(): Promise<void> {
  const parsed = parseArrayOrUndefined(guardedStorage.getItem(HISTORY_KEY));
  if (parsed === undefined) {
    guardedStorage.removeItem(MIGRATION_PROGRESS_KEY);
    return;
  }
  const oldProducts = guardedStorage.getItem(PRODUCTS_KEY);
  try {
    await migrateLegacyHistory(
      parsed,
      {
        // MERGE, never reset-to-empty: whatever the store already holds (the
        // interrupted run's durable prefix, or records the user created after
        // the interruption) is the base this resume preserves. The migration
        // then adds the legacy records whose ids are not already present, so the
        // final set is the lossless, duplicate-free union.
        baseEntries: useHistoryStore.getState().entries,
        ...(oldProducts === null ? {} : { productsSource: oldProducts }),
        restoreBaseEntries: true,
        legacyMarker: false,
      },
      parseArrayOrUndefined(oldProducts),
    );
  } catch (error) {
    console.warn("Failed to recover open3dcalc_history_v2", error);
  }
}

async function migrateLegacyDataAsync(): Promise<void> {
  // 1. A legacy PII-bearing marker (old build) is consumed for its preimage and
  //    cleaned after verification. Read-only from the current code's side.
  const legacyMarker = guardedStorage.getItem(MIGRATION_MARKER_KEY);
  if (legacyMarker !== null) {
    const backup = isHistoryMigrationBackup(legacyMarker);
    if (backup) await resumeFromLegacyMarker(backup);
    return;
  }

  // 2. The value-free progress marker: an interrupted run resumes from the
  //    intact legacy source. It carries no PII, so there is nothing to scrub.
  const progressMarker = guardedStorage.getItem(MIGRATION_PROGRESS_KEY);
  if (
    progressMarker !== null &&
    isHistoryMigrationProgress(progressMarker) !== null
  ) {
    await resumeFromLiveSource();
    return;
  }

  const historyStore = useHistoryStore.getState();
  const existing = historyStore.entries.length;

  // Skip if already migrated, or if historyStore already holds data
  // (prevent duplicates).
  if (existing > 0) return;

  // Read both independent legacy sources before any product migration can
  // persist over HISTORY_KEY (the history store's destination key).
  const oldProducts = guardedStorage.getItem(PRODUCTS_KEY);
  const oldHistory = guardedStorage.getItem(HISTORY_KEY);
  if (oldHistory) {
    try {
      const parsedHistory = JSON.parse(oldHistory) as unknown;
      if (Array.isArray(parsedHistory)) {
        // W4.4: the marker is VALUE-FREE. The raw source is NOT copied into it;
        // copy-without-delete keeps `open3dcalc_history_v2` intact, so a resumed
        // run re-reads it. This write still precedes every write to the shared
        // history key, so an interrupted run is detected and resumed.
        guardedStorage.setItem(
          MIGRATION_PROGRESS_KEY,
          historyMigrationProgressValue(),
        );
        await migrateLegacyHistory(
          parsedHistory,
          {
            baseEntries: historyStore.entries,
            ...(oldProducts === null ? {} : { productsSource: oldProducts }),
            restoreBaseEntries: false,
            legacyMarker: false,
          },
          parseArrayOrUndefined(oldProducts),
        );
        return;
      }
    } catch (error) {
      console.warn(`Failed to migrate ${HISTORY_KEY}`, error);
      return;
    }
  }

  // Verify the migrated entries against the store. This is the in-memory half:
  // the durable-destination verification for the combined path lives in
  // `migrateLegacyHistory`, which awaits the vault before it clears the recovery
  // marker. The product branch below removes only the independent PRODUCT
  // source, which is a different key from the destination, so confirming the
  // history store holds the converted records is what its safety requires.
  const migrateAndVerify = (
    entries: Array<{
      id?: string;
      timestamp?: number;
      type: "fdm" | "resin";
      name: string;
      summary: string;
      totalCost: number;
      sellPrice: number;
      profit: number;
      result: CalculationResult;
      snapshot: CalculationSnapshot | null;
    }>,
  ): boolean => {
    const expected: Array<Record<string, unknown>> = [];
    for (const entry of entries) {
      const id = historyStore.addEntry(entry);
      const migrated = historyStore.getEntry(id);
      if (!migrated) return false;
      expected.push({
        id,
        timestamp: entry.timestamp ?? migrated.timestamp,
        type: entry.type,
        name: entry.name,
        summary: entry.summary,
        totalCost: entry.totalCost,
        sellPrice: entry.sellPrice,
        profit: entry.profit,
        result: entry.result,
        snapshot: entry.snapshot,
      });
    }
    const migratedById = new Map(
      useHistoryStore.getState().entries.map((entry) => [entry.id, entry]),
    );
    return expected.every((entry) => {
      const migrated = migratedById.get(entry.id as string);
      return (
        migrated !== undefined &&
        Object.entries(entry).every(
          ([key, value]) =>
            JSON.stringify(migrated[key as keyof typeof migrated]) ===
            JSON.stringify(value),
        )
      );
    });
  };

  // Only the old raw array represented the pre-Zustand product store. A
  // Zustand wrapper is the current inventory and must never be discarded.
  try {
    if (oldProducts) {
      const parsed = JSON.parse(oldProducts) as unknown;
      if (Array.isArray(parsed)) {
        const entries = parsed.flatMap((p) => {
          const product = p as LegacyProduct;
          if (!product.result) return [];
          const type = product.snapshot?.type ?? "fdm";
          const summary =
            product.snapshot?.summary || product.name || "Produto";
          const totalCost = Number(product.result?.totalCost || 0);
          const sellPrice = Number(product.result?.sellPrice || 0);
          return [
            {
              id: product.id,
              timestamp: product.timestamp,
              type,
              name: product.name || "Produto",
              summary,
              totalCost,
              sellPrice,
              profit: sellPrice - totalCost,
              result: product.result,
              snapshot: (product.snapshot as CalculationSnapshot) || null,
            },
          ];
        });
        // Do not discard unconvertible legacy records (for example entries
        // without a calculation result). Migrate/remove only as a complete set.
        if (entries.length === parsed.length && migrateAndVerify(entries)) {
          // This key is distinct from the destination, so remove the legacy
          // source only after every migrated field has been verified.
          guardedStorage.removeItem(PRODUCTS_KEY);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to migrate open3dcalc_products", error);
  }
}

function saveSettingsBeforeUnload(): void {
  const calc = useCalculatorStore.getState();
  if (!isPersistableCalculationState(calc)) {
    console.warn(
      "[calculatorStore] Skipped beforeunload save: INVALID_CALCULATION_STATE",
    );
    return;
  }
  const data = {
    activeTab: calc.activeTab,
    fdmMaterial: calc.fdmMaterial,
    fdmPrintParams: calc.fdmPrintParams,
    fdmMachine: calc.fdmMachine,
    fdmHardware: calc.fdmHardware,
    fdmFinishing: calc.fdmFinishing,
    fdmLabor: calc.fdmLabor,
    fdmExtras: calc.fdmExtras,
    fdmSales: calc.fdmSales,
    fdmOps: calc.fdmOps,
    fdmSoft: calc.fdmSoft,
    resinMaterial: calc.resinMaterial,
    resinPrintParams: calc.resinPrintParams,
    resinPostProcess: calc.resinPostProcess,
    resinMachine: calc.resinMachine,
    resinHardware: calc.resinHardware,
    resinLabor: calc.resinLabor,
    resinExtras: calc.resinExtras,
    resinSales: calc.resinSales,
    resinOps: calc.resinOps,
    resinSoft: calc.resinSoft,
    selectedPrinterId: calc.selectedPrinter.id,
    selectedMarketplaceId: calc.selectedMarketplace.id,
    fdmAmsEnabled: false,
    fdmAmsSlots: calc.fdmAmsSlots,
    productName: calc.productName,
    quantity: calc.quantity,
    infillPercent: calc.infillPercent,
    targetMarginMode: calc.targetMarginMode,
    enabledSections: calc.enabledSections,
    currency: calc.currency,
  };
  persistCalculatorSettings(data);
}

function loadSharedCalculation(): void {
  const shared = getSharedCalculation();
  if (!shared) return;

  const state = useCalculatorStore.getState();
  const merged: Record<string, unknown> = {
    ...state,
    activeTab: shared.activeTab ?? state.activeTab,
    fdmMaterial: shared.fdmMaterial ?? state.fdmMaterial,
    fdmPrintParams: shared.fdmPrintParams ?? state.fdmPrintParams,
    fdmMachine: shared.fdmMachine ?? state.fdmMachine,
    fdmHardware: shared.fdmHardware ?? state.fdmHardware,
    fdmFinishing: shared.fdmFinishing ?? state.fdmFinishing,
    fdmLabor: shared.fdmLabor ?? state.fdmLabor,
    fdmExtras: shared.fdmExtras ?? state.fdmExtras,
    fdmSales: shared.fdmSales ?? state.fdmSales,
    fdmOps: shared.fdmOps ?? state.fdmOps,
    fdmSoft: shared.fdmSoft ?? state.fdmSoft,
    resinMaterial: shared.resinMaterial ?? state.resinMaterial,
    resinPrintParams: shared.resinPrintParams ?? state.resinPrintParams,
    resinPostProcess: shared.resinPostProcess ?? state.resinPostProcess,
    resinMachine: shared.resinMachine ?? state.resinMachine,
    resinHardware: shared.resinHardware ?? state.resinHardware,
    resinLabor: shared.resinLabor ?? state.resinLabor,
    resinExtras: shared.resinExtras ?? state.resinExtras,
    resinSales: shared.resinSales ?? state.resinSales,
    resinOps: shared.resinOps ?? state.resinOps,
    resinSoft: shared.resinSoft ?? state.resinSoft,
    fdmAmsEnabled: false,
    fdmAmsSlots: shared.fdmAmsSlots ?? state.fdmAmsSlots,
    fixedCosts: shared.fixedCosts ?? state.fixedCosts,
    productName: shared.productName ?? state.productName,
    quantity: shared.quantity ?? state.quantity,
    infillPercent: shared.infillPercent ?? state.infillPercent,
    targetMarginMode: shared.targetMarginMode ?? state.targetMarginMode,
    enabledSections: shared.enabledSections ?? state.enabledSections,
  };
  // Resolve printer/marketplace by ID
  if (shared.selectedPrinterId) {
    const printer = printers.find((p) => p.id === shared.selectedPrinterId);
    if (printer) merged.selectedPrinter = printer as (typeof printers)[number];
  }
  if (shared.selectedMarketplaceId) {
    const marketplace = marketplaces.find(
      (m) => m.id === shared.selectedMarketplaceId,
    );
    if (marketplace)
      merged.selectedMarketplace = marketplace as (typeof marketplaces)[number];
  }
  // Recompute through the same boundary used by every other restore path.
  const validated = computeValidatedStoreResults(merged);
  if (
    !isPersistableCalculationState({
      calculationIssues: validated.calculationIssues,
      quantity: validated.input.quantity,
    })
  ) {
    window.location.hash = "";
    return;
  }
  useCalculatorStore.setState({
    ...merged,
    ...validated.input,
    results: validated.results,
    calculationIssues: validated.calculationIssues,
  });
  // Clear the hash so it doesn't re-trigger
  window.location.hash = "";
}

export function useAppInit(onTabChange: (tab: Tab) => void): void {
  const layoutMode = useLayoutStore((state) => state.layoutMode);

  // Deep-link from the calculator → product bridge (ResultsPanel dispatches
  // "open3dcalc:go-products" after registering a product). Issue #85.
  useEffect(() => {
    const goToProducts = () => onTabChange("products");
    window.addEventListener("open3dcalc:go-products", goToProducts);
    return () =>
      window.removeEventListener("open3dcalc:go-products", goToProducts);
  }, [onTabChange]);

  // Tour steps that live on another surface navigate before being spotted;
  // the owning tab has to mount for the anchor to resolve.
  useTutorialTabNavigation(onTabChange);

  useEffect(() => {
    if (isBetaChannel) {
      // Hydrate exact Beta namespaces in dependency order before any Beta
      // startup task can observe or mutate customer-linked quote snapshots.
      const hydrateBetaStores = async (): Promise<void> => {
        await useCustomerStore.persist.rehydrate();
        await useHistoryStore.persist.rehydrate();
        await useQuoteStore.persist.rehydrate();
      };
      void hydrateBetaStores().catch((error: unknown) => {
        console.error("[useAppInit] Beta data hydration failed", error);
      });
      return;
    }

    restoreAutoSnapshot();
    migrateLegacyData();
    seedDefaultStudioDataIfEmpty();

    const handleBeforeUnload = saveSettingsBeforeUnload;
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Load shared calculation from URL hash
  useEffect(() => {
    loadSharedCalculation();
  }, []);

  // Auto-start tutorial on first visit (after short delay). Classic is the only
  // surface with the Classic tour anchors; Guided is already the guided flow.
  useEffect(() => {
    if (layoutMode !== "classic") return;

    const timer = setTimeout(() => {
      // Re-check at execution time so a layout switch during the delay wins.
      if (useLayoutStore.getState().layoutMode !== "classic") return;

      // Don't start tutorial if onboarding is still pending
      const onboardingDone = guardedStorage.getItem("open3dcalc_onboarded");
      if (!onboardingDone) return;

      const store = useTutorialStore.getState();
      if (!store.isCompleted && !store.isActive) {
        store.startTutorial();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [layoutMode]);
}
