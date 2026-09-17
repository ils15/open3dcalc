import { useId } from "react";
import { Info, FlaskConical, HelpCircle } from "lucide-react";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import type { FdmSlicerProfile } from "@/shared/types";
import type { EstimationMode } from "@/shared/types/estimation";
import {
  maxVolumetricSpeedFor,
  resolveFilamentDensity,
} from "@/shared/lib/filamentProfiles";

export interface AssumptionsPanelProps {
  store: CalculatorState;
  mode: EstimationMode;
  /** Proveniência do peso exibido (âncora G-code vs estimativa STL). */
  weightFromGcode: boolean;
  /** Proveniência do tempo exibido (âncora G-code vs estimativa STL). */
  timeFromGcode: boolean;
  t: (key: string) => string;
  /**
   * CTA "≤2 cliques" (D-EA5): alterna para o modo Custom, que já revela a
   * âncora G-code e o k de calibração logo acima neste painel.
   */
  onSwitchToCustom?: () => void;
}

interface SlicerRowConfig {
  key: keyof FdmSlicerProfile;
  labelKey: string;
  unit?: string;
}

/**
 * Campos do perfil de fatiamento que efetivamente alimentaram o estimador
 * (D-EA1). Labels/unidades reutilizados das chaves do D-EA1 — sem duplicar
 * i18n (YAGNI).
 */
const SLICER_ROWS: ReadonlyArray<SlicerRowConfig> = [
  { key: "layerHeightMm", labelKey: "calc.slicer.layerHeightMm", unit: "mm" },
  { key: "wallCount", labelKey: "calc.slicer.wallCount" },
  { key: "lineWidthMm", labelKey: "calc.slicer.lineWidthMm", unit: "mm" },
  {
    key: "printSpeedMmPerS",
    labelKey: "calc.slicer.printSpeedMmPerS",
    unit: "mm/s",
  },
  { key: "topLayers", labelKey: "calc.slicer.topLayers" },
  { key: "bottomLayers", labelKey: "calc.slicer.bottomLayers" },
];

/**
 * Formata um número para exibição sem ruído de ponto flutuente
 * (0.1 + 0.2 → 0.30000000000000004). Não altera o valor — é read-only.
 */
function formatValue(value: number): string {
  return String(Number(value.toFixed(6)));
}

function AssumptionRow({
  label,
  value,
  source,
  tooltip,
}: {
  label: string;
  value: string;
  source?: string;
  /** Tooltip keyboard-focusable (WCAG AA 1.4.13) do valor/source. */
  tooltip?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <dt className="text-[11px] text-[var(--color-text-muted)] shrink-0">
        {label}
      </dt>
      <dd className="text-[11px] font-semibold text-[var(--color-text-primary)] text-right inline-flex items-center gap-1.5 min-w-0">
        <span className="truncate">{value}</span>
        {source && (
          <span className="inline-flex items-center gap-1 font-normal text-[var(--color-text-muted)] shrink-0">
            <span aria-hidden="true">·</span>
            <span>{source}</span>
          </span>
        )}
        {tooltip && (
          <Tooltip content={tooltip}>
            <Info className="w-3 h-3 text-[var(--color-text-muted)] cursor-help shrink-0" />
          </Tooltip>
        )}
      </dd>
    </div>
  );
}

/**
 * Painel "premissas usadas" (D-EA5): mostra, de forma read-only, quais
 * parâmetros entraram na estimativa atual — perfil de fatiamento (D-EA1),
 * família/MVS efetivo (D-EA4), densidade aplicada, purge, diâmetro (D-EA2) e
 * o modo da estimativa (STL vs âncora G-code). Todos os valores são
 * COMPUTADOS da store + resolvedores — nenhum literal físico.
 *
 * Educação (YAGNI): um explainer curto "por que não bate com meu slicer?" +
 * CTA para o modo Custom existente — não reescreve o tutorial.
 */
export function AssumptionsPanel({
  store,
  mode,
  weightFromGcode,
  timeFromGcode,
  t,
  onSwitchToCustom,
}: AssumptionsPanelProps) {
  const headingId = useId();
  const slicerGroupId = useId();
  const filamentGroupId = useId();

  const family = store.fdmMaterial.type;
  const profile = store.fdmSlicerProfile;
  const filament = store.fdmFilament;

  // MVS efetivo: override manual (D-EA4) vence; ausente = tabela do material.
  const mvsOverride = filament.maxVolumetricSpeedMm3PerS;
  const hasOverride =
    mvsOverride != null && Number.isFinite(mvsOverride) && mvsOverride > 0;
  const effectiveMvs = maxVolumetricSpeedFor(family, mvsOverride);
  // Densidade aplicada: override da calculadora vence; senão, tabela.
  const appliedDensity = resolveFilamentDensity(
    family,
    store.fdmMaterial.density,
  );

  const isSimple = mode !== "advanced";

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="surface rounded-xl border border-[var(--color-border)] p-3 space-y-3"
    >
      <div className="flex items-center gap-2">
        <FlaskConical className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <span
          id={headingId}
          className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          {t("stl.assumptionsTitle")}
        </span>
        <Tooltip content={t("stl.assumptionsTooltip")}>
          <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] cursor-help" />
        </Tooltip>
      </div>

      <dl className="space-y-0.5">
        <AssumptionRow
          label={t("stl.assumptionsMode")}
          value={t(
            isSimple
              ? "stl.assumptionsModeSimple"
              : "stl.assumptionsModeCustom",
          )}
          // simple = rough ±30% (GA/contrato rough_estimate); a provenência
          // peso/tempo do modo Custom vem nas linhas dedicadas abaixo.
          source={isSimple ? t("stl.assumptionsRoughBadge") : undefined}
          tooltip={isSimple ? t("stl.assumptionsRoughTooltip") : undefined}
        />
        {!isSimple && (
          <>
            <AssumptionRow
              label={t("stl.assumptionsWeight")}
              value={t(
                weightFromGcode ? "stl.gcodeBadge" : "stl.estimatedBadge",
              )}
            />
            <AssumptionRow
              label={t("stl.assumptionsTime")}
              value={t(timeFromGcode ? "stl.gcodeBadge" : "stl.estimatedBadge")}
            />
          </>
        )}
      </dl>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
        <div>
          <p
            id={slicerGroupId}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1"
          >
            {t("stl.assumptionsSlicerGroup")}
          </p>
          <dl className="space-y-0.5">
            {SLICER_ROWS.map((row) => (
              <AssumptionRow
                key={row.key}
                label={t(row.labelKey)}
                value={`${formatValue(profile[row.key])}${
                  row.unit ? ` ${row.unit}` : ""
                }`}
              />
            ))}
          </dl>
        </div>

        <div>
          <p
            id={filamentGroupId}
            className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1"
          >
            {t("stl.assumptionsFilamentGroup")}
          </p>
          <dl className="space-y-0.5">
            <AssumptionRow
              label={t("stl.assumptionsMaterial")}
              value={family}
            />
            <AssumptionRow
              label={t("stl.assumptionsMvs")}
              value={`${formatValue(effectiveMvs)} mm³/s`}
              source={t(
                hasOverride
                  ? "stl.assumptionsMvsOverride"
                  : "stl.assumptionsMvsTable",
              )}
            />
            <AssumptionRow
              label={t("calc.density")}
              value={`${formatValue(appliedDensity)} g/cm³`}
            />
            <AssumptionRow
              label={t("calc.filament.purgePercent")}
              value={`${formatValue(filament.purgePercent)}%`}
            />
            <AssumptionRow
              label={t("calc.filament.filamentDiameterMm")}
              value={`${formatValue(filament.filamentDiameterMm)} mm`}
            />
          </dl>
        </div>
      </div>

      {isSimple && onSwitchToCustom && (
        <div className="rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-2.5 space-y-2">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <p className="text-[11px] font-semibold text-[var(--color-text-primary)]">
                {t("stl.assumptionsWhyTitle")}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                {t("stl.assumptionsWhyText")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchToCustom}
            className="text-[11px] font-semibold text-[var(--color-accent)] hover:underline underline-offset-2 min-h-[44px] w-full text-left flex items-center gap-1.5"
          >
            {t("stl.assumptionsCtaCustom")}
          </button>
        </div>
      )}
    </div>
  );
}
