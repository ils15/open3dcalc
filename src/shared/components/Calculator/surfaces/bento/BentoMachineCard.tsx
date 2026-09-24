import { Cpu } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { isFieldVisibleForLevel } from "../../Calculator.constants";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { printers } from "@/shared/lib/printers";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { BentoCard } from "./BentoCard";
import { BentoField } from "./BentoField";
import { BentoMetric } from "./BentoMetric";
import { BentoToggleField } from "./BentoToggleField";

export interface BentoMachineCardProps {
  readonly printHours: number;
  readonly energyCost: number;
  readonly machineCost: number;
}

function parseNumber(value: string): number {
  return value === "" ? 0 : Number.parseFloat(value) || 0;
}

/** Editable print, energy, machine ownership and maintenance assumptions. */
export function BentoMachineCard({
  printHours,
  energyCost,
  machineCost,
}: BentoMachineCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { format, symbol } = useCurrency();
  const {
    activeTab,
    calcLevel,
    hiddenFields,
    selectedPrinter,
    fdmPrintParams,
    resinPrintParams,
    fdmMachine,
    resinMachine,
    setSelectedPrinter,
    setFdmPrintParams,
    setResinPrintParams,
    setFdmMachine,
    setResinMachine,
  } = useCalculatorStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      calcLevel: state.calcLevel,
      hiddenFields: state.hiddenFields,
      selectedPrinter: state.selectedPrinter,
      fdmPrintParams: state.fdmPrintParams,
      resinPrintParams: state.resinPrintParams,
      fdmMachine: state.fdmMachine,
      resinMachine: state.resinMachine,
      setSelectedPrinter: state.setSelectedPrinter,
      setFdmPrintParams: state.setFdmPrintParams,
      setResinPrintParams: state.setResinPrintParams,
      setFdmMachine: state.setFdmMachine,
      setResinMachine: state.setResinMachine,
    })),
  );

  const isFDM = activeTab === "fdm";
  const printParams = isFDM ? fdmPrintParams : resinPrintParams;
  const machine = isFDM ? fdmMachine : resinMachine;
  const isPrintVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "print", fieldId);
  const isMachineVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "machine", fieldId);
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const formattedHours = printHours.toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const months = t("bento.monthCount", { count: machine.depreciationMonths });
  const maintenanceSummary = machine.maintenanceEnabled
    ? `${format(machine.maintenanceCost)} / ${t("bento.perMonth")}`
    : t("bento.notIncluded");
  const printerOptions = printers.map((printer) => ({
    label: printer.name,
    value: printer.id,
  }));

  return (
    <BentoCard title={t("bento.cards.machine")} icon={Cpu}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isFDM && isPrintVisible("selectedPrinter") && (
          <BentoField
            label={t("calc.printer")}
            value={selectedPrinter.id}
            onChange={(value) => {
              const printer = printers.find((item) => item.id === value);
              if (printer) setSelectedPrinter(printer);
            }}
            options={printerOptions}
            helper={t("bento.helpers.printer")}
            className="sm:col-span-2"
          />
        )}
        {isPrintVisible("printTimeHours") && (
          <BentoField
            label={t("calc.printTime")}
            value={printParams.printTimeHours}
            onChange={(value) => {
              const printTimeHours = parseNumber(value);
              if (isFDM) {
                setFdmPrintParams({ ...fdmPrintParams, printTimeHours });
              } else {
                setResinPrintParams({ ...resinPrintParams, printTimeHours });
              }
            }}
            type="number"
            unit="h"
            step="0.1"
            min="0"
            helper={t("tooltip.printTimeHours")}
          />
        )}
        {isPrintVisible("printerPowerWatts") && (
          <BentoField
            label={t("calc.printerPower")}
            value={printParams.printerPowerWatts}
            onChange={(value) => {
              const printerPowerWatts = parseNumber(value);
              if (isFDM) {
                setFdmPrintParams({ ...fdmPrintParams, printerPowerWatts });
              } else {
                setResinPrintParams({ ...resinPrintParams, printerPowerWatts });
              }
            }}
            type="number"
            unit="W"
            step="1"
            min="0"
            helper={t("tooltip.printerPowerWatts")}
          />
        )}
        {isPrintVisible("energyCostPerKwh") && (
          <BentoField
            label={t("calc.energyCost")}
            value={printParams.energyCostPerKwh}
            onChange={(value) => {
              const energyCostPerKwh = parseNumber(value);
              if (isFDM) {
                setFdmPrintParams({ ...fdmPrintParams, energyCostPerKwh });
              } else {
                setResinPrintParams({ ...resinPrintParams, energyCostPerKwh });
              }
            }}
            type="number"
            prefix={symbol}
            unit="/kWh"
            step="0.01"
            min="0"
            helper={t("tooltip.energyCostPerKwh")}
          />
        )}
        {isMachineVisible("machineCost") && (
          <BentoField
            label={t("calc.machineCost")}
            value={machine.machineCost}
            onChange={(value) => {
              const nextMachineCost = parseNumber(value);
              if (isFDM) {
                setFdmMachine({ ...fdmMachine, machineCost: nextMachineCost });
              } else {
                setResinMachine({ ...resinMachine, machineCost: nextMachineCost });
              }
            }}
            type="number"
            prefix={symbol}
            step="0.01"
            min="0"
            helper={t("tooltip.machineCost")}
          />
        )}
        {isMachineVisible("depreciationMonths") && (
          <BentoField
            label={t("calc.depreciationMonths")}
            value={machine.depreciationMonths}
            onChange={(value) => {
              const depreciationMonths = parseNumber(value);
              if (isFDM) {
                setFdmMachine({ ...fdmMachine, depreciationMonths });
              } else {
                setResinMachine({ ...resinMachine, depreciationMonths });
              }
            }}
            type="number"
            unit={t("bento.units.months")}
            step="1"
            min="1"
            helper={t("tooltip.depreciationMonths")}
          />
        )}
        {isMachineVisible("enabled") && (
          <BentoToggleField
            label={t("bento.toggles.monthlyUsage")}
            description={t("bento.helpers.monthlyUsage")}
            checked={machine.enabled}
            onChange={(enabled) => {
              if (isFDM) setFdmMachine({ ...fdmMachine, enabled });
              else setResinMachine({ ...resinMachine, enabled });
            }}
          />
        )}
        {isMachineVisible("hoursPerMonth") && machine.enabled && (
          <BentoField
            label={t("calc.hoursPerMonth")}
            value={machine.hoursPerMonth}
            onChange={(value) => {
              const hoursPerMonth = parseNumber(value);
              if (isFDM) setFdmMachine({ ...fdmMachine, hoursPerMonth });
              else setResinMachine({ ...resinMachine, hoursPerMonth });
            }}
            type="number"
            unit={t("bento.units.hoursPerMonth")}
            step="1"
            min="0"
            helper={t("tooltip.hoursPerMonth")}
            className="sm:col-span-2"
          />
        )}
        {isMachineVisible("maintenanceEnabled") && (
          <BentoToggleField
            label={t("calc.maintenance")}
            description={t("bento.helpers.maintenance")}
            checked={machine.maintenanceEnabled}
            onChange={(maintenanceEnabled) => {
              if (isFDM) setFdmMachine({ ...fdmMachine, maintenanceEnabled });
              else setResinMachine({ ...resinMachine, maintenanceEnabled });
            }}
          />
        )}
        {isMachineVisible("maintenanceCost") && machine.maintenanceEnabled && (
          <BentoField
            label={t("calc.maintenanceCost")}
            value={machine.maintenanceCost}
            onChange={(value) => {
              const maintenanceCost = parseNumber(value);
              if (isFDM) setFdmMachine({ ...fdmMachine, maintenanceCost });
              else setResinMachine({ ...resinMachine, maintenanceCost });
            }}
            type="number"
            prefix={`${symbol}/${t("bento.perMonth")}`}
            step="0.01"
            min="0"
            helper={t("tooltip.maintenanceCost")}
            className="sm:col-span-2"
          />
        )}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.printHours")}
          value={`${formattedHours} h`}
          tone="machine"
        />
        <BentoMetric
          label={t("bento.fields.energy")}
          value={format(energyCost)}
          tone="energy"
        />
        <BentoMetric
          label={t("bento.fields.depreciation")}
          value={`${format(machineCost)} · ${months}`}
          tone="machine"
        />
        <BentoMetric
          label={t("bento.fields.maintenance")}
          value={maintenanceSummary}
          tone="machine"
        />
      </dl>
    </BentoCard>
  );
}
