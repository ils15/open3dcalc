import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import { MaterialSection } from "./sections/MaterialSection";
import { PrintSection } from "./sections/PrintSection";
import { FailureSection } from "./sections/FailureSection";
import { MachineSection } from "./sections/MachineSection";
import { FixedCostsSection } from "./sections/FixedCostsSection";
import { LaborSection } from "./sections/LaborSection";
import { HardwareSection } from "./sections/HardwareSection";
import { OpsSection } from "./sections/OpsSection";
import { SalesSection } from "./sections/SalesSection";
import { ResultsPanel } from "@/shared/components/Results/ResultsPanel";
import { SectionHeader } from "./sections/SectionHeader";
import { FieldCustomizer } from "./FieldCustomizer";
import {
  SECTIONS,
  LEVEL_SECTIONS,
  isFieldVisibleForLevel,
  sectionStepNumbers,
} from "./Calculator.constants";

interface SectionRendererProps {
  t: (key: string) => string;
  currencySymbol: string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  isFDM: boolean;
  showSpoolSelector: boolean;
  setShowSpoolSelector: (show: boolean) => void;
  inventorySpools: FilamentSpool[];
  catalogMaterials: Array<{ name: string; type: string }>;
  catalogPrinters: Array<{
    id: string;
    name: string;
    power: number;
    value: number;
    brand: string;
    image?: string;
  }>;
  handlePrinterSelect: (id: string) => void;
  /** Forwards demo-mode export feedback down to the mobile ResultsPanel. */
  onExportBlocked?: (message: string) => void;
}

export function SectionRenderer(props: SectionRendererProps) {
  const {
    t,
    currencySymbol,
    handleInput,
    isFDM,
    showSpoolSelector,
    setShowSpoolSelector,
    inventorySpools,
    catalogMaterials,
    catalogPrinters,
    handlePrinterSelect,
    onExportBlocked,
  } = props;

  const { calcLevel, hiddenFields } = useCalculatorStore(
    useShallow((s) => ({
      calcLevel: s.calcLevel,
      hiddenFields: s.hiddenFields,
    })),
  );
  const store = useCalculatorStore();

  const isFieldVisible = useCallback(
    (sectionId: string, fieldId: string) =>
      isFieldVisibleForLevel(calcLevel, hiddenFields, sectionId, fieldId),
    [calcLevel, hiddenFields],
  );

  const stepById = sectionStepNumbers(calcLevel);

  // The print-time total feeds the "Tempo & Máquina" slot of the Example.
  // `estimatedPrintTime` is in HOURS (calculator.ts sets it from
  // `print.printTimeHours`, the same field the energy math multiplies as
  // hours), so it is formatted here directly. Hidden until a result exists:
  // a dash would claim a total that was never computed.
  const timeMetric =
    store.results && Number.isFinite(store.results.estimatedPrintTime)
      ? `${t("calc.sectionMetric.totalTime")}: ${store.results.estimatedPrintTime.toFixed(1)} ${t("common.hours")}`
      : undefined;

  // Bound per section so the numeral reaches the heading without every
  // section having to thread a step prop through its own signature.
  const headerFor = useCallback(
    (step: number | undefined, metric?: React.ReactNode) =>
      (Icon: LucideIcon, title: string, subtitle?: string) => (
        <SectionHeader
          Icon={Icon}
          title={title}
          subtitle={subtitle}
          step={step}
          metric={metric}
        />
      ),
    [],
  );

  const visibleSections = SECTIONS.filter((s) =>
    LEVEL_SECTIONS[calcLevel].includes(s.id),
  );
  const orderedSections = [...visibleSections].sort((a, b) => {
    if (a.id === "results") return -1;
    if (b.id === "results") return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {orderedSections.map((s) => {
        switch (s.id) {
          case "material":
            return (
              <div
                key="material"
                id="section-material"
                data-tutorial="material"
                className="scroll-mt-24"
              >
                <MaterialSection
                  renderSectionHeader={headerFor(stepById.get("material"))}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  isFDM={isFDM}
                  store={store}
                  isFieldVisible={isFieldVisible}
                  showSpoolSelector={showSpoolSelector}
                  setShowSpoolSelector={setShowSpoolSelector}
                  inventorySpools={inventorySpools}
                  catalogMaterials={catalogMaterials}
                />
              </div>
            );
          case "print":
            return (
              <div
                key="print"
                id="section-print"
                data-tutorial="print"
                className="scroll-mt-24"
              >
                <PrintSection
                  renderSectionHeader={headerFor(
                    stepById.get("print"),
                    timeMetric,
                  )}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  isFDM={isFDM}
                  store={store}
                  isFieldVisible={isFieldVisible}
                  handlePrinterSelect={handlePrinterSelect}
                  catalogPrinters={catalogPrinters}
                />
              </div>
            );
          case "failure":
            return (
              <div
                key="failure"
                id="section-failure"
                data-tutorial="failure"
                className="scroll-mt-24"
              >
                <FailureSection
                  renderSectionHeader={headerFor(stepById.get("failure"))}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  isFDM={isFDM}
                  store={store}
                />
              </div>
            );
          case "hardware":
            return (
              <div
                key="hardware"
                id="section-hardware"
                data-tutorial="hardware"
                className="scroll-mt-24"
              >
                <HardwareSection step={stepById.get("hardware")} />
              </div>
            );
          case "machine":
            return (
              <div
                key="machine"
                id="section-machine"
                data-tutorial="machine"
                className="scroll-mt-24"
              >
                <MachineSection
                  renderSectionHeader={headerFor(stepById.get("machine"))}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  isFDM={isFDM}
                  store={store}
                />
              </div>
            );
          case "fixedCost":
            return (
              <div
                key="fixedCost"
                id="section-fixedCost"
                data-tutorial="fixedCost"
                className="scroll-mt-24"
              >
                <FixedCostsSection
                  renderSectionHeader={headerFor(stepById.get("fixedCost"))}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  store={store}
                />
              </div>
            );
          case "labor":
            return (
              <div
                key="labor"
                id="section-labor"
                data-tutorial="labor"
                className="scroll-mt-24"
              >
                <LaborSection
                  renderSectionHeader={headerFor(stepById.get("labor"))}
                  t={t}
                  currencySymbol={currencySymbol}
                  handleInput={handleInput}
                  isFDM={isFDM}
                  store={store}
                />
              </div>
            );
          case "ops":
            return (
              <div
                key="ops"
                id="section-ops"
                data-tutorial="ops"
                className="scroll-mt-24"
              >
                <OpsSection step={stepById.get("ops")} />
              </div>
            );
          case "sales":
            return (
              <div
                key="sales"
                id="section-sales"
                data-tutorial="sales"
                className="scroll-mt-24"
              >
                <SalesSection step={stepById.get("sales")} />
              </div>
            );
          case "results":
            return (
              <div
                key="results"
                id="section-results"
                data-tutorial="results"
                className="scroll-mt-24 2xl:hidden"
              >
                <ResultsPanel
                  variant="mobile"
                  onExportBlocked={onExportBlocked}
                />
              </div>
            );
          default:
            return null;
        }
      })}
      {/* Field customization remains available after the answer-first flow. */}
      <FieldCustomizer />
    </div>
  );
}
