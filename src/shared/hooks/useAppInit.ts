import { useEffect } from "react";
import { isPersistableCalculationState } from "@/shared/lib/calculationState";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import { persistCalculatorSettings } from "@/shared/stores/calculatorStore.helpers";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { computeValidatedStoreResults } from "@/shared/stores/calculatorStore.validation";
import { getSharedCalculation } from "@/shared/lib/calculationLink";
import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialTabNavigation } from "@/shared/hooks/useTutorialTabNavigation";
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

type HistoryMigrationBackup = {
  type: "open3dcalc-history-v2-backup";
  source: string;
  baseEntries: HistoryEntry[];
  productsSource?: string;
};

const MIGRATION_MARKER_KEY = "open3dcalc_migration_done_v2";
const HISTORY_KEY = "open3dcalc_history_v2";
const PRODUCTS_KEY = "open3dcalc_products";

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

function isHistoryMigrationBackup(
  value: string,
): HistoryMigrationBackup | null {
  try {
    const parsed = JSON.parse(value) as Partial<HistoryMigrationBackup>;
    if (
      parsed.type === "open3dcalc-history-v2-backup" &&
      typeof parsed.source === "string" &&
      Array.isArray(parsed.baseEntries) &&
      (parsed.productsSource === undefined ||
        typeof parsed.productsSource === "string")
    ) {
      return parsed as HistoryMigrationBackup;
    }
  } catch {
    // A non-JSON marker is the legacy "migration complete" value.
  }
  return null;
}

function migrateLegacyHistory(
  legacyItems: unknown[],
  source: string,
  backup?: HistoryMigrationBackup,
  legacyProducts?: unknown[],
  restoreBaseEntries = false,
): boolean {
  const historyStore = useHistoryStore.getState();
  const baseEntries = backup?.baseEntries ?? historyStore.entries;
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

  if (backup && restoreBaseEntries) {
    // Discard any persisted prefix, retaining entries that predated the
    // legacy-history import (for example products migrated in this startup).
    useHistoryStore.setState({ entries: baseEntries });
  } else if (!backup) {
    const recovery: HistoryMigrationBackup = {
      type: "open3dcalc-history-v2-backup",
      source,
      baseEntries,
    };
    // This write must complete before addEntry overwrites the shared key.
    guardedStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify(recovery));
  }

  const expected: Array<Record<string, unknown>> = baseEntries.map((entry) => ({
    ...entry,
  }));
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
  const persistedSource = guardedStorage.getItem(HISTORY_KEY);
  if (!persistedSource) return false;
  try {
    const persisted = JSON.parse(persistedSource) as {
      state?: { entries?: unknown };
    };
    if (
      !Array.isArray(persisted.state?.entries) ||
      !verified(inMemoryEntries) ||
      !verified(persisted.state.entries)
    ) {
      return false;
    }
  } catch {
    return false;
  }

  if (backup?.productsSource !== undefined && productsFullyConvertible) {
    // Retain the independent source until product and history entries have
    // both passed the in-memory and persisted-wrapper verification above.
    if (guardedStorage.getItem(PRODUCTS_KEY) === backup.productsSource) {
      guardedStorage.removeItem(PRODUCTS_KEY);
    }
  }

  // The original raw source is retained in the recovery marker until both the
  // in-memory store and the persisted Zustand wrapper contain the full result.
  guardedStorage.removeItem(MIGRATION_MARKER_KEY);
  return true;
}

function migrateLegacyData(): void {
  const migrationMarker = guardedStorage.getItem(MIGRATION_MARKER_KEY);
  if (migrationMarker) {
    const backup = isHistoryMigrationBackup(migrationMarker);
    if (!backup) return;
    try {
      const parsed = JSON.parse(backup.source) as unknown;
      if (Array.isArray(parsed)) {
        let legacyProducts: unknown[] | undefined;
        if (backup.productsSource !== undefined) {
          try {
            const parsedProducts = JSON.parse(backup.productsSource) as unknown;
            if (Array.isArray(parsedProducts)) legacyProducts = parsedProducts;
          } catch {
            // Keep an unrecognized product source untouched while recovering
            // the independently backed-up legacy history.
          }
        }
        migrateLegacyHistory(
          parsed,
          backup.source,
          backup,
          legacyProducts,
          true,
        );
      }
    } catch (error) {
      console.warn("Failed to recover open3dcalc_history_v2", error);
    }
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
        const recovery: HistoryMigrationBackup = {
          type: "open3dcalc-history-v2-backup",
          source: oldHistory,
          baseEntries: historyStore.entries,
          ...(oldProducts === null ? {} : { productsSource: oldProducts }),
        };
        // This durable snapshot must precede every write to the shared history
        // key, including writes made while converting the legacy products.
        guardedStorage.setItem(MIGRATION_MARKER_KEY, JSON.stringify(recovery));
        let legacyProducts: unknown[] | undefined;
        if (oldProducts !== null) {
          try {
            const parsedProducts = JSON.parse(oldProducts) as unknown;
            if (Array.isArray(parsedProducts)) legacyProducts = parsedProducts;
          } catch {
            // The product source is preserved; continue recovering history.
          }
        }
        migrateLegacyHistory(
          parsedHistory,
          oldHistory,
          recovery,
          legacyProducts,
        );
        return;
      }
    } catch (error) {
      console.warn(`Failed to migrate ${HISTORY_KEY}`, error);
      return;
    }
  }

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
    restoreAutoSnapshot();
    migrateLegacyData();

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
