import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  buildProjectPresetSnapshot,
  hasCalculationInProgress,
  projectPresets,
  type ProjectPresetId,
} from "@/shared/lib/projectPresets";

export function ProjectPresetPicker() {
  const { t } = useTranslation();
  const store = useCalculatorStore();
  const { printers, materials } = useCatalogStore(
    useShallow((state) => ({
      printers: state.printers,
      materials: state.materials,
    })),
  );
  const firstPreset = projectPresets[0];
  const [selectedPresetId, setSelectedPresetId] =
    useState<ProjectPresetId>(firstPreset.id);
  const [announcement, setAnnouncement] = useState("");
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const selectedPreset =
    projectPresets.find((preset) => preset.id === selectedPresetId) ?? firstPreset;

  const applyPreset = () => {
    if (
      hasCalculationInProgress(store) &&
      !window.confirm(t("calc.projectPresets.confirmOverwrite"))
    ) {
      setAnnouncement(t("calc.projectPresets.cancelled"));
      applyButtonRef.current?.focus();
      return;
    }

    const productName = t(
      `calc.projectPresets.items.${selectedPreset.id}.name`,
    );
    store.loadHistoryItem(
      buildProjectPresetSnapshot(store, selectedPreset, {
        productName,
        catalogMaterials: materials,
        catalogPrinters: printers,
      }),
    );
    setAnnouncement(
      t("calc.projectPresets.applied", { name: productName }),
    );
    applyButtonRef.current?.focus();
  };

  return (
    <section className="surface rounded-xl px-5 py-4" aria-label={t("calc.projectPresets.label")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <label
            htmlFor="project-preset-select"
            className="text-[12px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]"
          >
            {t("calc.projectPresets.selectLabel")}
          </label>
          <select
            id="project-preset-select"
            value={selectedPresetId}
            onChange={(event) =>
              setSelectedPresetId(event.target.value as ProjectPresetId)
            }
            className="min-h-[44px] w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-input)] px-3 text-sm text-[var(--text-primary)] outline-none transition-colors hover:border-[var(--border-strong)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
          >
            {projectPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {t(`calc.projectPresets.items.${preset.id}.name`)}
              </option>
            ))}
          </select>
        </div>
        <button
          ref={applyButtonRef}
          type="button"
          onClick={applyPreset}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] outline-none transition-colors hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {t("calc.projectPresets.fill")}
        </button>
      </div>
      <p
        className="mt-2 min-h-[1.25rem] text-xs text-[var(--text-muted)]"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </p>
    </section>
  );
}
