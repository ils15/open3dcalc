import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { useShallow } from "zustand/react/shallow";

import {
  buildProjectPresetDraft,
  hasCalculationInProgress,
  previewProjectPreset,
  PresetDraftError,
  projectPresets,
  type ProjectPresetId,
} from "@/shared/lib/projectPresets";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import {
  deriveRealMarginPercent,
  formatRealMarginPercent,
} from "@/shared/lib/realMargin";

function displayValue(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

export function ProjectPresetPicker() {
  const { t, i18n } = useTranslation();
  const locale = i18n?.language?.startsWith("en") ? "en-US" : "pt-BR";
  const calculator = useCalculatorStore();
  const catalog = useCatalogStore(
    useShallow((state) => ({
      printers: state.printers,
      materials: state.materials,
    })),
  );
  const firstPreset = projectPresets[0];
  const [selectedPresetId, setSelectedPresetId] =
    useState<ProjectPresetId>(firstPreset.id);
  const [announcement, setAnnouncement] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const applyButtonRef = useRef<HTMLButtonElement>(null);

  const selectedPreset =
    projectPresets.find((preset) => preset.id === selectedPresetId) ?? firstPreset;

  const builtPreview = useMemo(() => {
    try {
      const draft = buildProjectPresetDraft(calculator, selectedPreset, {
        catalog,
        productName: t(`calc.projectPresets.items.${selectedPreset.id}.name`),
        exampleLabel: t("calc.projectPresets.exampleLabel"),
      });
      return {
        draft,
        preview: previewProjectPreset(calculator, draft, catalog),
      };
    } catch (error) {
      return { error: errorMessage(error) };
    }
    function errorMessage(value: unknown): string {
      const code = value instanceof PresetDraftError ? value.code : "invalid-preset";
      return t(`calc.projectPresets.errors.${code}`);
    }
  }, [calculator, catalog, selectedPreset, t]);

  const errorMessage = actionError ?? ("error" in builtPreview ? builtPreview.error : null);
  const preview = "preview" in builtPreview ? builtPreview.preview : null;
  const draft = "draft" in builtPreview ? builtPreview.draft : null;
  const realMargin = preview
    ? deriveRealMarginPercent(preview.results.profit, preview.results.sellPrice)
    : null;
  const realMarginValue = formatRealMarginPercent(realMargin, locale);
  const activeSales = draft
    ? draft.technology === "fdm"
      ? draft.preserved.fdmSales
      : draft.preserved.resinSales
    : null;
  const activePrint = draft
    ? draft.technology === "fdm"
      ? draft.reset.fdmPrintParams
      : draft.reset.resinPrintParams
    : null;
  const activeMaterial = draft
    ? draft.technology === "fdm"
      ? draft.reset.fdmMaterial
      : draft.reset.resinMaterial
    : null;
  const activeMachine = draft
    ? draft.technology === "fdm"
      ? draft.reset.fdmMachine
      : draft.reset.resinMachine
    : null;
  const inactiveName = draft?.preserved.inactiveTechnology.fdm
    ? "FDM"
    : draft?.preserved.inactiveTechnology.resin
      ? "Resin"
      : "—";

  const applyPreset = () => {
    setActionError(null);
    const currentCalculator = useCalculatorStore.getState();
    const currentCatalog = useCatalogStore.getState();
    let built: ReturnType<typeof buildProjectPresetDraft>;
    try {
      built = buildProjectPresetDraft(currentCalculator, selectedPreset, {
        catalog: currentCatalog,
        productName: t(`calc.projectPresets.items.${selectedPreset.id}.name`),
        exampleLabel: t("calc.projectPresets.exampleLabel"),
      });
    } catch (error) {
      const code = error instanceof PresetDraftError ? error.code : "invalid-preset";
      setActionError(t(`calc.projectPresets.errors.${code}`));
      applyButtonRef.current?.focus();
      return;
    }

    if (
      hasCalculationInProgress(currentCalculator) &&
      !window.confirm(t("calc.projectPresets.confirmOverwrite"))
    ) {
      setAnnouncement(t("calc.projectPresets.cancelled"));
      applyButtonRef.current?.focus();
      return;
    }

    try {
      currentCalculator.applyProjectPresetDraft(built);
      setAnnouncement(
        t("calc.projectPresets.applied", {
          name: t(`calc.projectPresets.items.${selectedPreset.id}.name`),
        }),
      );
    } catch (error) {
      const code = error instanceof PresetDraftError ? error.code : "invalid-preset";
      setActionError(t(`calc.projectPresets.errors.${code}`));
    }
    applyButtonRef.current?.focus();
  };

  return (
    <section
      className="surface rounded-xl px-5 py-4"
      aria-label={t("calc.projectPresets.label")}
    >
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
            onChange={(event) => {
              setActionError(null);
              setSelectedPresetId(event.target.value as ProjectPresetId);
            }}
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
          disabled={!draft}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-contrast)] outline-none transition-colors hover:bg-[var(--accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          {t("calc.projectPresets.fill")}
        </button>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {preview && draft ? (
        <div
          data-testid="project-preset-preview"
          className="mt-4 grid gap-3 border-t border-[var(--border-default)] pt-4 text-sm md:grid-cols-3"
        >
          <div>
            <h3 className="font-semibold">{t("calc.projectPresets.previewTitle")}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {t("calc.projectPresets.exampleLabel")}: {draft.reset.productName}
            </p>
            <p data-testid="project-preset-demo-price" className="mt-2 font-medium">
              {t("calc.projectPresets.demoLabel")}: {displayValue(selectedPreset.demoSellPriceBRL)} BRL
            </p>
          </div>
          <div>
            <h4 className="font-semibold">{t("calc.projectPresets.fields.reset")}</h4>
            <dl className="mt-1 space-y-0.5 text-xs">
              <PreviewRow label={t("calc.projectPresets.fields.technology")} value={draft.technology} />
              <PreviewRow label={t("calc.projectPresets.fields.printer")} value={draft.printerRef.canonical.name} />
              <PreviewRow label={t("calc.projectPresets.fields.material")} value={activeMaterial?.type} />
              <PreviewRow label={t("calc.projectPresets.fields.printTime")} value={activePrint?.printTimeHours} suffix=" h" />
              <PreviewRow label={t("calc.projectPresets.fields.failure")} value={`${activePrint?.failureMode}: ${activePrint?.failureValue}`} />
              <PreviewRow label={t("calc.projectPresets.fields.risk")} value={activePrint?.riskMultiplier} />
              <PreviewRow label={t("calc.projectPresets.fields.energyPrice")} value={activePrint?.energyCostPerKwh} />
              <PreviewRow label={t("calc.projectPresets.fields.machine")} value={activeMachine?.machineCost} />
              <PreviewRow label={t("calc.projectPresets.fields.ams")} value={draft.reset.fdmAmsEnabled ? t("common.yes") : t("common.no")} />
              <PreviewRow label={t("calc.projectPresets.fields.spool")} value={draft.reset.selectedSpoolId} />
              <PreviewRow label={t("calc.projectPresets.fields.infill")} value={draft.reset.infillPercent} suffix="%" />
            </dl>
          </div>
          <div>
            <h4 className="font-semibold">{t("calc.projectPresets.fields.preserved")}</h4>
            <dl className="mt-1 space-y-0.5 text-xs">
              <PreviewRow label={t("calc.projectPresets.fields.marketplace")} value={draft.preserved.selectedMarketplace.name} />
              <PreviewRow label={t("calc.projectPresets.fields.quantity")} value={draft.preserved.quantity} />
              <PreviewRow
                label={t("calc.profitMargin")}
                value={activeSales?.profitMarginPercent}
                suffix="%"
                helper={t("tooltip.profitMargin")}
              />
              <PreviewRow label={t("calc.projectPresets.fields.labor")} value={draft.preserved.fdmLabor.enabled ? t("common.yes") : t("common.no")} />
              <PreviewRow label={t("calc.projectPresets.fields.inactive")} value={inactiveName} />
              <PreviewRow label={t("calc.projectPresets.fields.product")} value={draft.preserved.selectedMarketplaceId} />
            </dl>
            <h4 className="mt-3 font-semibold">{t("calc.projectPresets.fields.results")}</h4>
            <dl className="mt-1 space-y-0.5 text-xs">
              <PreviewRow
                label={t("calc.projectPresets.fields.sellPrice")}
                value={preview.results.sellPrice}
                testId="project-preset-results-sell-price"
              />
              <PreviewRow
                label={t("calc.projectPresets.fields.actualMargin")}
                value={realMarginValue}
                helper={t("tooltip.profitMargin")}
                testId="project-preset-results-actual-margin"
              />
              <PreviewRow label={t("calc.projectPresets.fields.totalCost")} value={preview.results.totalCost} />
            </dl>
          </div>
        </div>
      ) : null}

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

function PreviewRow({
  label,
  value,
  suffix = "",
  helper,
  testId,
}: {
  label: string;
  value: unknown;
  suffix?: string;
  helper?: string;
  testId?: string;
}) {
  return (
    <div className="flex justify-between gap-2" data-testid={testId}>
      <div className="min-w-0">
        <dt className="text-[var(--text-muted)]">{label}</dt>
        {helper && <p className="text-[10px] text-[var(--text-muted)]">{helper}</p>}
      </div>
      <dd className="text-right font-medium">{displayValue(value)}{suffix}</dd>
    </div>
  );
}
