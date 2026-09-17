import { useId, useState } from "react";
import { Info, SlidersHorizontal } from "lucide-react";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import type { FdmSlicerProfile } from "@/shared/types";

type FieldKey = keyof FdmSlicerProfile;

interface FieldConfig {
  key: FieldKey;
  labelKey: string;
  tooltipKey: string;
  unit?: string;
  step: string;
  /**
   * true  → contínuo, deve ser > 0 (linha/camada/velocidade).
   * false → contagem inteira, aceita 0 (paredes/camadas; 0 = modo vaso).
   */
  positive: boolean;
}

/**
 * Os 6 parâmetros do perfil de fatiamento que o estimador STL consome
 * (D-EA1, GA-1). A validação de UX espelha `sanitizeFdmSlicerProfile`:
 * fora-de-domínio nunca é commitado — a store retém o último valor válido.
 */
const FIELD_CONFIG: ReadonlyArray<FieldConfig> = [
  {
    key: "wallCount",
    labelKey: "calc.slicer.wallCount",
    tooltipKey: "tooltip.slicerWallCount",
    step: "1",
    positive: false,
  },
  {
    key: "lineWidthMm",
    labelKey: "calc.slicer.lineWidthMm",
    tooltipKey: "tooltip.slicerLineWidth",
    unit: "mm",
    step: "0.01",
    positive: true,
  },
  {
    key: "topLayers",
    labelKey: "calc.slicer.topLayers",
    tooltipKey: "tooltip.slicerTopLayers",
    step: "1",
    positive: false,
  },
  {
    key: "bottomLayers",
    labelKey: "calc.slicer.bottomLayers",
    tooltipKey: "tooltip.slicerBottomLayers",
    step: "1",
    positive: false,
  },
  {
    key: "layerHeightMm",
    labelKey: "calc.slicer.layerHeightMm",
    tooltipKey: "tooltip.slicerLayerHeight",
    unit: "mm",
    step: "0.01",
    positive: true,
  },
  {
    key: "printSpeedMmPerS",
    labelKey: "calc.slicer.printSpeedMmPerS",
    tooltipKey: "tooltip.slicerPrintSpeed",
    unit: "mm/s",
    step: "5",
    positive: true,
  },
];

/**
 * Validação de UX (espelha `sanitizeFdmSlicerProfile` da store).
 * Retorna a chave de erro i18n ou null quando o valor é válido.
 */
function validateDraft(
  draft: string,
  positive: boolean,
  t: (key: string) => string,
): string | null {
  if (draft.trim() === "") {
    return t(positive ? "calc.slicer.errorPositive" : "calc.slicer.errorCount");
  }
  const num = Number(draft);
  if (!Number.isFinite(num)) {
    return t(positive ? "calc.slicer.errorPositive" : "calc.slicer.errorCount");
  }
  if (positive) {
    return num > 0 ? null : t("calc.slicer.errorPositive");
  }
  if (!Number.isInteger(num)) {
    return t("calc.slicer.errorCount");
  }
  return num >= 0 ? null : t("calc.slicer.errorCount");
}

interface SlicerProfileFieldProps {
  config: FieldConfig;
  value: number;
  t: (key: string) => string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  onCommit: (v: number) => void;
}

function SlicerProfileField({
  config,
  value,
  t,
  handleInput,
  onCommit,
}: SlicerProfileFieldProps) {
  // Draft local: permite digitar livremente (ex.: "0." a caminho de "0.08")
  // sem que o valor da store snapshot de volta no meio da digitação.
  const [draft, setDraft] = useState<string | null>(null);

  // Valor externo mudou (undo/histórico/reset) → descarta o draft stale.
  // Padrão "adjust state during render" (react.dev) — sem efeito em cascata.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(null);
  }

  const error =
    draft === null ? null : validateDraft(draft, config.positive, t);
  const displayed = draft ?? String(value);

  return (
    <InputGroup
      label={t(config.labelKey)}
      value={displayed}
      onChange={(v) => {
        setDraft(v);
        // Só commita valores válidos — a store nunca recebe fora-de-domínio.
        if (validateDraft(v, config.positive, t) === null) {
          handleInput(v, onCommit);
        }
      }}
      // Blur com valor inválido → reverte para o último valor válido da store.
      onBlur={() => {
        if (
          draft !== null &&
          validateDraft(draft, config.positive, t) !== null
        ) {
          setDraft(null);
        }
      }}
      type="number"
      step={config.step}
      unit={config.unit}
      tooltip={t(config.tooltipKey)}
      error={error}
    />
  );
}

export interface SlicerProfileFieldsProps {
  store: CalculatorState;
  t: (key: string) => string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
}

/**
 * Inputs do perfil de fatiamento (modo avançado apenas — o gating vem do
 * `isFieldVisible` da seção; campos não listados em BASIC/INTERMEDIATE_FIELDS
 * só aparecem no advanced). Renderiza null quando não há campo visível.
 */
export function SlicerProfileFields({
  store,
  t,
  handleInput,
  isFieldVisible,
}: SlicerProfileFieldsProps) {
  const headingId = useId();
  const visible = FIELD_CONFIG.filter((f) => isFieldVisible("material", f.key));

  if (visible.length === 0) return null;

  return (
    <div
      role="group"
      aria-labelledby={headingId}
      className="mt-3 surface rounded-xl border border-[var(--color-border)] p-3"
    >
      <div className="flex items-center gap-2 mb-3">
        <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <span
          id={headingId}
          className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          {t("calc.slicerProfile")}
        </span>
        <Tooltip content={t("tooltip.slicerProfile")}>
          <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] cursor-help" />
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 @form:grid-cols-3 gap-3">
        {visible.map((config) => (
          <SlicerProfileField
            key={config.key}
            config={config}
            value={store.fdmSlicerProfile[config.key]}
            t={t}
            handleInput={handleInput}
            onCommit={(v) => store.setFdmSlicerProfile({ [config.key]: v })}
          />
        ))}
      </div>
    </div>
  );
}
