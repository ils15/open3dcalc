import { useState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCalculatorStore } from "@/shared/stores/calculatorStore";

/** Save-settings action kept beside history and product registration. */
export function SaveSettingsAction(): React.ReactElement {
  const { t } = useTranslation();
  const saveSettings = useCalculatorStore((state) => state.saveSettings);
  const [status, setStatus] = useState<"idle" | "saved">("idle");

  const handleSave = (): void => {
    saveSettings();
    setStatus("saved");
    window.setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleSave}
      className={`min-h-[44px] w-full rounded-xl py-2.5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none ${
        status === "saved"
          ? "bg-[var(--positive)] text-[var(--text-inverse)]"
          : "bg-[var(--accent)] text-[var(--text-inverse)] hover:bg-[var(--accent-hover)]"
      }`}
    >
      {status === "saved" ? (
        <CheckCircle2 aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
      ) : (
        <Save aria-hidden="true" className="mr-1 inline size-4 align-text-bottom" />
      )}
      {status === "saved" ? t("calc.saved") : t("calc.saveSettings")}
    </button>
  );
}
