import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToastContainer } from "@/shared/components/ui/Toast";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useShallow } from "zustand/react/shallow";
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts";
import { QuickStartBanner } from "@/shared/components/ui/QuickStartBanner";
import { ResultsPanel } from "@/shared/components/Results/ResultsPanel";
import { TechToggle } from "./TechToggle";
import { LevelToggle } from "./LevelToggle";
import { ProductName } from "./ProductName";
import { SectionNav } from "./SectionNav";
import { SectionRenderer } from "./SectionRenderer";

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
      handler: () => window.print(),
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
        data-testid="calculator-layout"
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 pb-[72px] lg:pb-0 xl:gap-6 2xl:grid-cols-[auto_minmax(0,1fr)_360px] 2xl:gap-8"
      >
        <div data-testid="calculator-section-nav" className="col-start-1 row-start-1 min-w-0">
          <SectionNav
            activeSection={activeSection}
            onSectionClick={setActiveSection}
          />
        </div>
        <div
          data-tutorial="results-sidebar"
          data-testid="results-sidebar"
          className="col-start-2 row-start-1 hidden 2xl:flex 2xl:col-start-3 flex-col gap-5 w-[360px] shrink-0 sticky top-[92px] self-start max-h-[calc(100vh-120px)] overflow-y-auto"
        >
          <ResultsPanel
            variant="sidebar"
            onExportBlocked={notifyBlockedExport}
          />
        </div>
        <div
          data-testid="calculator-inputs"
          className="col-start-2 row-start-1 flex-1 min-w-0 2xl:min-w-[560px] @container space-y-5"
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
            onExportBlocked={notifyBlockedExport}
          />
        </div>
      </div>
    </>
  );
}
