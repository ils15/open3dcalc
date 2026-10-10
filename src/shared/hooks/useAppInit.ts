import { useEffect } from "react";
import { isBetaChannel } from "@/shared/config/betaChannel";
import { isPersistableCalculationState } from "@/shared/lib/calculationState";
import { restoreAutoSnapshot } from "@/shared/stores/storeBridge";
import { persistCalculatorSettings } from "@/shared/stores/calculatorStore.helpers";
import { guardedStorage } from "@/shared/lib/manifestStorage";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useCustomerStore } from "@/shared/stores/customerStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { computeValidatedStoreResults } from "@/shared/stores/calculatorStore.validation";
import { getSharedCalculation } from "@/shared/lib/calculationLink";
import { printers } from "@/shared/lib/printers";
import { findMarketplace, marketplaces } from "@/shared/lib/marketplace";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";
import { useLayoutStore } from "@/shared/stores/layoutStore";
import { useTutorialTabNavigation } from "@/shared/hooks/useTutorialTabNavigation";
import { seedDefaultStudioDataIfEmpty } from "@/shared/lib/initialWorkshopSeed";
import type { Tab } from "@/shared/components/AppShell/tabs";

/**
 * App bootstrap shared by both platforms (V2.0 Wave 1).
 *
 * Shared app initialization for beforeunload autosave, URL-hash shared
 * calculations, tutorial auto-start and the calculator→product deep link.
 * PII stores own their current-channel hydration; retired legacy migration is
 * deliberately not part of startup.
 */

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
    const marketplace = findMarketplace(
      shared.selectedMarketplaceId,
      useCatalogStore.getState().marketplaces ?? [],
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
