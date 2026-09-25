import { FlaskConical, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";

export function TechToggle() {
  const { t } = useTranslation();
  const { activeTab, setActiveTab } = useCalculatorStore(
    useShallow((s) => ({
      activeTab: s.activeTab,
      setActiveTab: s.setActiveTab,
    })),
  );

  return (
    <div className="inline-flex items-center rounded-xl p-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]">
      <button
        onClick={() => setActiveTab("fdm")}
        className={`min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
          activeTab === "fdm"
            ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent-muted)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
        }`}
      >
        <Printer className="w-3.5 h-3.5" />
        {t("calc.fdm")}
      </button>
      <button
        onClick={() => setActiveTab("resin")}
        className={`min-h-[44px] min-w-[44px] flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
          activeTab === "resin"
            ? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent-muted)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
        }`}
      >
        <FlaskConical className="w-3.5 h-3.5" />
        {t("calc.resin")}
      </button>
    </div>
  );
}
