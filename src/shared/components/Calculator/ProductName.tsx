import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";

export function ProductName() {
  const id = useId();
  const { t } = useTranslation();
  const { productName, setProductName } = useCalculatorStore(
    useShallow((s) => ({
      productName: s.productName,
      setProductName: s.setProductName,
    })),
  );

  return (
    <div className="calculator-product-name surface rounded-xl px-3 py-2.5 sm:px-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
      >
        {t("calc.productIdentity")}
      </label>
      <input
        id={id}
        type="text"
        value={productName}
        onChange={(e) => setProductName(e.target.value)}
        placeholder={t("calc.productNamePlaceholder")}
        className="w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg px-3 py-2 min-h-[44px] text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
      />
    </div>
  );
}
