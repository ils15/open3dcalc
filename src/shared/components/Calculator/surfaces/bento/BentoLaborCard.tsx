import { HandCoins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { isFieldVisibleForLevel } from "../../Calculator.constants";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { LaborCosts } from "@/shared/types";
import { BentoCard } from "./BentoCard";
import { BentoField } from "./BentoField";
import { BentoMetric } from "./BentoMetric";

export interface BentoLaborCardProps {
  readonly labor: LaborCosts;
  readonly laborCost: number;
  readonly extrasCost: number;
}

function parseNumber(value: string): number {
  return value === "" ? 0 : Number.parseFloat(value) || 0;
}

/** Editable labor assumptions and costs plus the derived labor total. */
export function BentoLaborCard({
  labor,
  laborCost,
  extrasCost,
}: BentoLaborCardProps): React.ReactElement {
  const { t } = useTranslation();
  const { format, symbol } = useCurrency();
  const {
    activeTab,
    calcLevel,
    hiddenFields,
    fdmLabor,
    resinLabor,
    fdmExtras,
    resinExtras,
    fdmSales,
    resinSales,
    setFdmLabor,
    setResinLabor,
    setFdmExtras,
    setResinExtras,
    setFdmSales,
    setResinSales,
  } = useCalculatorStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      calcLevel: state.calcLevel,
      hiddenFields: state.hiddenFields,
      fdmLabor: state.fdmLabor,
      resinLabor: state.resinLabor,
      fdmExtras: state.fdmExtras,
      resinExtras: state.resinExtras,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
      setFdmLabor: state.setFdmLabor,
      setResinLabor: state.setResinLabor,
      setFdmExtras: state.setFdmExtras,
      setResinExtras: state.setResinExtras,
      setFdmSales: state.setFdmSales,
      setResinSales: state.setResinSales,
    })),
  );

  const isFDM = activeTab === "fdm";
  const sales = isFDM ? fdmSales : resinSales;
  const isLaborVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "labor", fieldId);
  const isSalesVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "sales", fieldId);

  const setLaborField = (
    field: "setupTimeMinutes" | "postProcessingTimeMinutes" | "hourlyRate",
    value: number,
  ): void => {
    if (isFDM) {
      setFdmLabor({ ...fdmLabor, [field]: value });
    } else {
      setResinLabor({ ...resinLabor, [field]: value });
    }
  };

  return (
    <BentoCard title={t("bento.cards.labor")} icon={HandCoins}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {isLaborVisible("setupTimeMinutes") && (
          <BentoField
            label={t("calc.setupTime")}
            value={labor.setupTimeMinutes}
            onChange={(value) => setLaborField("setupTimeMinutes", parseNumber(value))}
            type="number"
            unit="min"
            step="1"
            min="0"
            helper={t("tooltip.setupTime")}
          />
        )}
        {isLaborVisible("postProcessingTimeMinutes") && (
          <BentoField
            label={t("calc.postTime")}
            value={labor.postProcessingTimeMinutes}
            onChange={(value) =>
              setLaborField("postProcessingTimeMinutes", parseNumber(value))
            }
            type="number"
            unit="min"
            step="1"
            min="0"
            helper={t("tooltip.postProcessingTime")}
          />
        )}
        {isLaborVisible("hourlyRate") && (
          <BentoField
            label={t("calc.hourlyRate")}
            value={labor.hourlyRate}
            onChange={(value) => setLaborField("hourlyRate", parseNumber(value))}
            type="number"
            prefix={symbol}
            unit="/h"
            step="0.01"
            min="0"
            helper={t("tooltip.hourlyRate")}
          />
        )}
        {isSalesVisible("extrasCost") && (
          <BentoField
            label={t("calc.extras")}
            value={extrasCost}
            onChange={(value) => {
              const nextExtrasCost = parseNumber(value);
              if (isFDM) {
                setFdmExtras({ ...fdmExtras, extrasCost: nextExtrasCost });
              } else {
                setResinExtras({ ...resinExtras, extrasCost: nextExtrasCost });
              }
            }}
            type="number"
            prefix={symbol}
            step="0.01"
            min="0"
            helper={t("tooltip.extras")}
          />
        )}
        {isSalesVisible("packagingCost") && (
          <BentoField
            label={t("calc.packaging")}
            value={sales.packagingCost}
            onChange={(value) => {
              const packagingCost = parseNumber(value);
              if (isFDM) {
                setFdmSales({ ...fdmSales, packagingCost });
              } else {
                setResinSales({ ...resinSales, packagingCost });
              }
            }}
            type="number"
            prefix={symbol}
            step="0.01"
            min="0"
            helper={t("tooltip.packaging")}
          />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.laborCost")}
          value={format(laborCost)}
          tone="labor"
        />
      </dl>
    </BentoCard>
  );
}
