import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "@/shared/components/ui/Toast";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { guardExport } from "@/shared/lib/demoExportGuard";
import { QuickStartBanner } from "@/shared/components/ui/QuickStartBanner";
import { ResultsSidebar } from "@/shared/components/Results/ResultsSidebar";
import { TechToggle } from "./TechToggle";
import { LevelToggle } from "./LevelToggle";
import { ProductName } from "./ProductName";
import { SectionNav } from "./SectionNav";
import { SectionRenderer } from "./SectionRenderer";
import { hasCalculatorRailSpace } from "./Calculator.layout";
import "./Calculator.css";

export function Calculator() {
  const { t } = useTranslation();
  const undo = useCalculatorStore((s) => s.undo);

  useKeyboardShortcuts([
    { key: "z", ctrl: true, handler: () => undo(), description: "Desfazer" },
    {
      key: "e",
      ctrl: true,
      handler: () =>
        (
          document.querySelector('[data-shortcut="export"]') as HTMLElement
        )?.click(),
      description: "Exportar",
    },
    {
      key: "p",
      ctrl: true,
      handler: () => {
        if (guardExport()) return;
        window.print();
      },
      description: "Imprimir",
    },
  ]);
  const store = useCalculatorStore();

  const { printers: catalogPrinters, materials: catalogMaterials } =
    useCatalogStore(
      useShallow((s) => ({ printers: s.printers, materials: s.materials })),
    );
  const inventorySpools = useFilamentInventory((s) => s.spools);
  const [showSpoolSelector, setShowSpoolSelector] = useState(false);

  const [activeSection, setActiveSection] = useState("material");
  const [hasThreeRegionSpace, setHasThreeRegionSpace] = useState(false);
  const layoutMeasureRef = useRef<HTMLDivElement>(null);
  const [toastItems, setToastItems] = useState<
    { id: number; message: string; type: "error" | "success" | "info" }[]
  >([]);

  const dismissToast = (id: number) => {
    setToastItems((prev) => prev.filter((t) => t.id !== id));
  };

  // Explanatory feedback for export/share actions blocked in demo mode.
  const toastId = useRef(0);
  const notifyBlockedExport = useCallback((message: string) => {
    toastId.current += 1;
    setToastItems((prev) => [
      ...prev,
      { id: toastId.current, message, type: "info" },
    ]);
  }, []);

  const isFDM = store.activeTab === "fdm";
  const { symbol: currencySymbol } = useCurrency();

  useEffect(() => {
    const element = layoutMeasureRef.current;
    if (!element) return;

    const updateLayoutMode = (availableWidth: number): void => {
      const rootFontSize =
        Number.parseFloat(
          window.getComputedStyle(document.documentElement).fontSize,
        ) || 16;
      setHasThreeRegionSpace(
        hasCalculatorRailSpace(availableWidth, rootFontSize),
      );
    };

    // Measure once synchronously: the CSS breakout is already applied at the
    // desktop viewport, and ResizeObserver's first delivery is asynchronous.
    updateLayoutMode(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      updateLayoutMode(entry.contentRect.width);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const handlePrinterSelect = (id: string) => {
    const p = catalogPrinters.find((p) => p.id === id);
    // Wave B (B4): a action setSelectedPrinter deriva power e custos da
    // máquina ativa (single source of truth) — sem double-set no componente.
    if (p) {
      store.setSelectedPrinter(
        p as Parameters<typeof store.setSelectedPrinter>[0],
      );
    }
  };

  const handleInput = useCallback(
    (value: string, setter: (v: number) => void) => {
      setter(value === "" ? 0 : parseFloat(value) || 0);
    },
    [],
  );

  return (
    <>
      <ToastContainer items={toastItems} onDismiss={dismissToast} />
      <h1 className="sr-only">{t("nav.calculator")}</h1>
      <div
        ref={layoutMeasureRef}
        data-testid="calculator-measure"
        className="calculator-viewport-measure min-w-0"
      >
        <div
          data-testid="calculator-layout"
          data-layout-mode={
            hasThreeRegionSpace ? "three-region" : "inline-results"
          }
          className={`grid pb-[72px] lg:pb-0 ${
            hasThreeRegionSpace
              ? "calculator-layout--three-region"
              : "grid-cols-[auto_minmax(0,1fr)] gap-4 xl:gap-6"
          }`}
        >
          <div
            data-testid="calculator-section-nav"
            className="col-start-1 row-start-1 min-w-0"
          >
            <SectionNav
              activeSection={activeSection}
              onSectionClick={setActiveSection}
            />
          </div>
          <div
            id="section-results"
            data-tutorial="results"
            data-testid="results-sidebar"
            className={`min-w-0 ${
              hasThreeRegionSpace
                ? "calculator-results-sidebar col-start-3 row-start-1 flex flex-col gap-5 sticky top-[76px] self-start h-[calc(100vh-120px)] max-h-[calc(100vh-120px)] overflow-hidden scroll-mt-24"
                : "col-start-2 row-start-1 scroll-mt-24"
            }`}
          >
            <div
              data-tutorial="results-sidebar"
              className="flex min-h-0 h-full flex-col gap-5"
            >
              <ResultsSidebar
                onExportBlocked={notifyBlockedExport}
                presentation={hasThreeRegionSpace ? "sidebar" : "inline"}
              />
            </div>
          </div>
          <div
            data-testid="calculator-inputs"
            className={`col-start-2 min-w-0 @container space-y-5 ${
              hasThreeRegionSpace ? "row-start-1" : "row-start-2"
            }`}
          >
            <QuickStartBanner />
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-1">
              <TechToggle />
              <LevelToggle />
            </div>
            <ProductName />
            <SectionRenderer
              t={t}
              currencySymbol={currencySymbol}
              handleInput={handleInput}
              isFDM={isFDM}
              showSpoolSelector={showSpoolSelector}
              setShowSpoolSelector={setShowSpoolSelector}
              inventorySpools={inventorySpools}
              catalogMaterials={catalogMaterials}
              catalogPrinters={catalogPrinters}
              handlePrinterSelect={handlePrinterSelect}
            />
          </div>
        </div>
      </div>
    </>
  );
}
