import { BadgeDollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { isFieldVisibleForLevel } from "../../Calculator.constants";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import type { CalculationResult, SalesParameters } from "@/shared/types";
import { BentoCard } from "./BentoCard";
import { BentoField } from "./BentoField";
import { BentoMetric } from "./BentoMetric";

export interface BentoPricingCardProps {
  readonly result: CalculationResult;
  readonly sales: SalesParameters;
  readonly quantity: number;
  readonly breakEvenPrice: number;
  readonly profit: number;
}

function parseNumber(value: string): number {
  return value === "" ? 0 : Number.parseFloat(value) || 0;
}

/** Editable commercial assumptions plus derived pricing signals. */
export function BentoPricingCard({
  result,
  sales,
  quantity,
  breakEvenPrice,
  profit,
}: BentoPricingCardProps): React.ReactElement {
  const { t, i18n } = useTranslation();
  const { format, symbol } = useCurrency();
  const {
    activeTab,
    calcLevel,
    hiddenFields,
    infillPercent,
    enabledSections,
    fdmPrintParams,
    resinPrintParams,
    fdmSales,
    resinSales,
    setFdmPrintParams,
    setResinPrintParams,
    setFdmSales,
    setResinSales,
    setQuantity,
    setInfillPercent,
  } = useCalculatorStore(
    useShallow((state) => ({
      activeTab: state.activeTab,
      calcLevel: state.calcLevel,
      hiddenFields: state.hiddenFields,
      infillPercent: state.infillPercent,
      enabledSections: state.enabledSections,
      fdmPrintParams: state.fdmPrintParams,
      resinPrintParams: state.resinPrintParams,
      fdmSales: state.fdmSales,
      resinSales: state.resinSales,
      setFdmPrintParams: state.setFdmPrintParams,
      setResinPrintParams: state.setResinPrintParams,
      setFdmSales: state.setFdmSales,
      setResinSales: state.setResinSales,
      setQuantity: state.setQuantity,
      setInfillPercent: state.setInfillPercent,
    })),
  );

  const isFDM = activeTab === "fdm";
  const currentSales = isFDM ? fdmSales : resinSales;
  const printParams = isFDM ? fdmPrintParams : resinPrintParams;
  const isSalesVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "sales", fieldId);
  const isFailureVisible = (fieldId: string): boolean =>
    isFieldVisibleForLevel(calcLevel, hiddenFields, "failure", fieldId);
  const locale = i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "pt-BR";
  const percent = (value: number): string =>
    `${value.toLocaleString(locale, { maximumFractionDigits: 2 })}%`;
  const failureIsFixed = printParams.failureMode === "fixed";
  const marginTone = result.actualMargin < 0 ? "negative" : "margin";

  const setSalesField = (
    field: "marketplaceFeePercent" | "taxPercent" | "profitMarginPercent" | "shippingCost",
    value: number,
  ): void => {
    const nextSales = { ...currentSales, [field]: value };
    if (isFDM) {
      setFdmSales(nextSales);
    } else {
      setResinSales(nextSales);
    }
  };

  const setFailureValue = (value: number): void => {
    if (isFDM) {
      setFdmPrintParams({ ...fdmPrintParams, failureValue: value });
    } else {
      setResinPrintParams({ ...resinPrintParams, failureValue: value });
    }
  };

  return (
    <BentoCard
      title={t("bento.cards.pricing")}
      icon={BadgeDollarSign}
      className="lg:col-span-2"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {isSalesVisible("quantity") && (
          <BentoField
            label={t("bento.fields.quantity")}
            value={quantity}
            onChange={(value) => {
              const nextQuantity = parseNumber(value);
              setQuantity(nextQuantity > 0 ? nextQuantity : 1);
            }}
            type="number"
            unit={t("bento.units.items")}
            step="1"
            min="1"
            helper={t("tooltip.quantity")}
          />
        )}
        {isSalesVisible("infillPercent") && (
          <BentoField
            label={t("calc.infillPercent")}
            value={infillPercent}
            onChange={(value) => setInfillPercent(parseNumber(value))}
            type="number"
            unit="%"
            step="1"
            min="0"
            max="100"
            helper={t("tooltip.infillPercent")}
          />
        )}
        {isSalesVisible("marketplace") && (
          <BentoField
            label={t("bento.fields.fee")}
            value={sales.marketplaceFeePercent}
            onChange={(value) => setSalesField("marketplaceFeePercent", parseNumber(value))}
            type="number"
            unit="%"
            step="0.1"
            min="0"
            max="100"
            helper={t("tooltip.marketplaceFee")}
          />
        )}
        {isSalesVisible("taxPercent") && (
          <BentoField
            label={t("bento.fields.tax")}
            value={sales.taxPercent}
            onChange={(value) => setSalesField("taxPercent", parseNumber(value))}
            type="number"
            unit="%"
            step="0.1"
            min="0"
            max="100"
            helper={t("tooltip.taxPercent")}
          />
        )}
        {isFailureVisible("failureValue") && (
          <BentoField
            label={t(failureIsFixed ? "bento.fields.failure" : "bento.fields.failureRate")}
            value={printParams.failureValue}
            onChange={(value) => setFailureValue(parseNumber(value))}
            type="number"
            prefix={failureIsFixed ? symbol : undefined}
            unit={failureIsFixed ? undefined : "%"}
            step="0.1"
            min="0"
            max={failureIsFixed ? undefined : "100"}
            disabled={!enabledSections.failure}
            helper={t("tooltip.failureValue")}
          />
        )}
        {isSalesVisible("profitMarginPercent") && (
          <BentoField
            label={t("bento.fields.targetMargin")}
            value={sales.profitMarginPercent}
            onChange={(value) => setSalesField("profitMarginPercent", parseNumber(value))}
            type="number"
            unit="%"
            step="0.1"
            min="0"
            helper={t("tooltip.profitMargin")}
          />
        )}
        {isSalesVisible("shippingCost") && (
          <BentoField
            label={t("calc.shipping")}
            value={sales.shippingCost}
            onChange={(value) => setSalesField("shippingCost", parseNumber(value))}
            type="number"
            prefix={symbol}
            step="0.01"
            min="0"
            helper={t("tooltip.shipping")}
          />
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2">
        <BentoMetric
          label={t("bento.fields.actualMargin")}
          value={percent(result.actualMargin)}
          tone={marginTone}
        />
        <BentoMetric
          label={t("bento.fields.failure")}
          value={format(result.failureCost)}
          tone="failure"
        />
        <BentoMetric
          label={t("bento.fields.breakEven")}
          value={format(breakEvenPrice)}
          tone="margin"
        />
        <BentoMetric
          label={t("bento.fields.profit")}
          value={format(profit)}
          tone={profit < 0 ? "negative" : "revenue"}
        />
      </dl>
    </BentoCard>
  );
}
