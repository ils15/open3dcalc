import { useEffect } from "react";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { computeStoreResults } from "@/shared/stores/calculatorStore.compute";
import type { ComputeStoreInput } from "@/shared/stores/calculatorStore.types";
import { getSharedCalculation } from "@/shared/lib/calculationLink";
import { printers } from "@/shared/lib/printers";
import { marketplaces } from "@/shared/lib/marketplace";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useTutorialTabNavigation } from "@/shared/hooks/useTutorialTabNavigation";
import type { Tab } from "@/shared/components/AppShell/tabs";
import type { CalculationResult, CalculationSnapshot } from "@/shared/types";

/**
 * App bootstrap shared by both platforms (V2.0 Wave 1).
 *
 * Extracted verbatim from the duplicated App.tsx bodies: legacy-data
 * migration, the beforeunload autosave, URL-hash shared calculations, the
 * tutorial auto-start and the calculator→product deep link. Pure logic — no
 * UI — so both platforms run identical init.
 */

type LegacyProduct = {
  name?: string;
  result?: CalculationResult;
  snapshot?: Partial<CalculationSnapshot> | null;
};

type LegacyHistoryItem = {
  type?: "fdm" | "resin";
  summary?: string;
  totalCost?: number;
  sellPrice?: number;
  profit?: number;
  result?: CalculationResult;
  snapshot?: CalculationSnapshot | null;
};

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

function migrateLegacyData(): void {
  const historyStore = useHistoryStore.getState();
  const existing = historyStore.entries.length;

  // Skip if already migrated, or if historyStore already holds data
  // (prevent duplicates).
  if (guardedStorage.getItem("open3dcalc_migration_done_v2")) return;
  if (existing > 0) return;

  // Migrar productStore antigo
  try {
    const oldProducts = guardedStorage.getItem("open3dcalc_products");
    if (oldProducts) {
      const parsed = JSON.parse(oldProducts) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((p) => {
          const product = p as LegacyProduct;
          if (!product.result) return;
          const type = product.snapshot?.type ?? "fdm";
          const summary =
            product.snapshot?.summary || product.name || "Produto";
          const totalCost = Number(product.result?.totalCost || 0);
          const sellPrice = Number(product.result?.sellPrice || 0);
          historyStore.addEntry({
            type,
            name: product.name || "Produto",
            summary,
            totalCost,
            sellPrice,
            profit: sellPrice - totalCost,
            result: product.result,
            snapshot: (product.snapshot as CalculationSnapshot) || null,
          });
        });
      }
      guardedStorage.removeItem("open3dcalc_products");
    }
  } catch (error) {
    console.warn("Failed to migrate open3dcalc_products", error);
  }

  // Migrar calculatorStore.history antigo (v1)
  try {
    const oldHistory = guardedStorage.getItem("open3dcalc_history_v2");
    if (oldHistory) {
      const parsed = JSON.parse(oldHistory) as unknown;
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          const legacyItem = item as LegacyHistoryItem;
          historyStore.addEntry({
            type: legacyItem.type || "fdm",
            name: legacyItem.summary || "Histórico",
            summary: legacyItem.summary || "",
            totalCost: legacyItem.totalCost || 0,
            sellPrice: legacyItem.sellPrice || 0,
            profit: legacyItem.profit || 0,
            result: legacyItem.result || FALLBACK_RESULT,
            snapshot: legacyItem.snapshot || null,
          });
        });
        guardedStorage.removeItem("open3dcalc_history_v2");
      }
    }
  } catch (error) {
    console.warn("Failed to migrate open3dcalc_history_v2", error);
  }
}

function saveSettingsBeforeUnload(): void {
  const calc = useCalculatorStore.getState();
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
    fdmAmsEnabled: calc.fdmAmsEnabled,
    fdmAmsSlots: calc.fdmAmsSlots,
    productName: calc.productName,
    quantity: calc.quantity,
    infillPercent: calc.infillPercent,
    targetMarginMode: calc.targetMarginMode,
    enabledSections: calc.enabledSections,
  };
  guardedStorage.setItem("open3dcalc_settings_v2", JSON.stringify(data));
}

function loadSharedCalculation(): void {
  const shared = getSharedCalculation();
  if (!shared) return;

  const state = useCalculatorStore.getState();
  const merged: Record<string, unknown> = {
    ...state,
    activeTab: shared.activeTab,
    ...(shared.fdmMaterial && { fdmMaterial: shared.fdmMaterial }),
    ...(shared.fdmPrintParams && { fdmPrintParams: shared.fdmPrintParams }),
    ...(shared.fdmMachine && { fdmMachine: shared.fdmMachine }),
    ...(shared.fdmHardware && { fdmHardware: shared.fdmHardware }),
    ...(shared.fdmFinishing && { fdmFinishing: shared.fdmFinishing }),
    ...(shared.fdmLabor && { fdmLabor: shared.fdmLabor }),
    ...(shared.fdmExtras && { fdmExtras: shared.fdmExtras }),
    ...(shared.fdmSales && { fdmSales: shared.fdmSales }),
    ...(shared.fdmOps && { fdmOps: shared.fdmOps }),
    ...(shared.fdmSoft && { fdmSoft: shared.fdmSoft }),
    ...(shared.resinMaterial && { resinMaterial: shared.resinMaterial }),
    ...(shared.resinPrintParams && {
      resinPrintParams: shared.resinPrintParams,
    }),
    ...(shared.resinMachine && { resinMachine: shared.resinMachine }),
    ...(shared.resinHardware && { resinHardware: shared.resinHardware }),
    ...(shared.resinPostProcess && {
      resinPostProcess: shared.resinPostProcess,
    }),
    ...(shared.resinLabor && { resinLabor: shared.resinLabor }),
    ...(shared.resinExtras && { resinExtras: shared.resinExtras }),
    ...(shared.resinSales && { resinSales: shared.resinSales }),
    ...(shared.resinOps && { resinOps: shared.resinOps }),
    ...(shared.resinSoft && { resinSoft: shared.resinSoft }),
    ...(shared.fdmAmsEnabled !== undefined && {
      fdmAmsEnabled: shared.fdmAmsEnabled,
    }),
    ...(shared.fdmAmsSlots && { fdmAmsSlots: shared.fdmAmsSlots }),
    ...(shared.fixedCosts && { fixedCosts: shared.fixedCosts }),
    ...(shared.productName !== undefined && {
      productName: shared.productName,
    }),
    ...(shared.quantity !== undefined && { quantity: shared.quantity }),
    ...(shared.infillPercent !== undefined && {
      infillPercent: shared.infillPercent,
    }),
    ...(shared.targetMarginMode !== undefined && {
      targetMarginMode: shared.targetMarginMode,
    }),
    ...(shared.enabledSections && {
      enabledSections: shared.enabledSections,
    }),
  };
  // Resolve printer/marketplace by ID
  if (shared.selectedPrinterId) {
    const printer = printers.find((p) => p.id === shared.selectedPrinterId);
    if (printer)
      merged.selectedPrinter = printer as (typeof printers)[number];
  }
  if (shared.selectedMarketplaceId) {
    const marketplace = marketplaces.find(
      (m) => m.id === shared.selectedMarketplaceId,
    );
    if (marketplace)
      merged.selectedMarketplace = marketplace as (typeof marketplaces)[number];
  }
  // Recompute results
  const results = computeStoreResults(merged as ComputeStoreInput);
  useCalculatorStore.setState({ ...merged, results });
  // Clear the hash so it doesn't re-trigger
  window.location.hash = "";
}

export function useAppInit(onTabChange: (tab: Tab) => void): void {
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

  // Auto-start tutorial on first visit (after short delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      // Don't start tutorial if onboarding is still pending
      const onboardingDone = guardedStorage.getItem("open3dcalc_onboarded");
      if (!onboardingDone) return;

      const store = useTutorialStore.getState();
      if (!store.isCompleted && !store.isActive) {
        store.startTutorial();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, []);
}
