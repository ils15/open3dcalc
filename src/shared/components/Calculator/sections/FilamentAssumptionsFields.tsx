import { useId, useState } from "react";
import { Info, FlaskConical } from "lucide-react";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import type { FdmFilamentParams } from "@/shared/types";

type FieldKey = keyof FdmFilamentParams;

interface FieldConfig {
  key: FieldKey;
  labelKey: string;
  tooltipKey: string;
  unit?: string;
  step: string;
  placeholder?: string;
  /**
   * true  → contínuo, deve ser > 0 (diâmetro/MVS: divisão por r² e teto de vazão).
   * false → aceita 0 e fracionário (purge: 0 = sem purga).
   */
  positive: boolean;
  /**
   * Campo opcional por design (D-EA4: MVS ausente = tabela do material).
   * Limpar o input commita `undefined` — o estimador volta ao lookup da tabela.
   */
  optional?: boolean;
}

/**
 * Os 3 parâmetros físicos do filamento que o estimador consome (D-EA2/D-EA4,
 * GA-2). A validação de UX espelha `sanitizeFdmFilament`: fora-de-domínio
 * nunca é commitado — a store retém o último valor válido.
 */
const FIELD_CONFIG: ReadonlyArray<FieldConfig> = [
  {
    key: "purgePercent",
    labelKey: "calc.filament.purgePercent",
    tooltipKey: "tooltip.filamentPurgePercent",
    unit: "%",
    step: "1",
    positive: false,
  },
  {
    key: "filamentDiameterMm",
    labelKey: "calc.filament.filamentDiameterMm",
    tooltipKey: "tooltip.filamentDiameter",
    unit: "mm",
    step: "0.01",
    positive: true,
  },
  {
    key: "maxVolumetricSpeedMm3PerS",
    labelKey: "calc.filament.maxVolumetricSpeedMm3PerS",
    tooltipKey: "tooltip.filamentMvs",
    unit: "mm³/s",
    step: "1",
    placeholder: "calc.filament.mvsPlaceholder",
    positive: true,
    optional: true,
  },
];

/**
 * Validação de UX (espelha `sanitizeFdmFilament` da store).
 * Retorna a chave de erro i18n ou null quando o valor é válido.
 */
function validateDraft(
  draft: string,
  positive: boolean,
  t: (key: string) => string,
): string | null {
  const errorKey = positive
    ? "calc.filament.errorPositive"
    : "calc.filament.errorNonNegative";
  if (draft.trim() === "") return t(errorKey);
  const num = Number(draft);
  if (!Number.isFinite(num)) return t(errorKey);
  if (positive) return num > 0 ? null : t("calc.filament.errorPositive");
  return num >= 0 ? null : t("calc.filament.errorNonNegative");
}

interface FilamentAssumptionFieldProps {
  config: FieldConfig;
  value: number | undefined;
  t: (key: string) => string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  onCommit: (v: number | undefined) => void;
}

function FilamentAssumptionField({
  config,
  value,
  t,
  handleInput,
  onCommit,
}: FilamentAssumptionFieldProps) {
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
  // MVS é opcional: ausente = tabela (renderiza input vazio, não "undefined").
  const displayed = draft ?? (value == null ? "" : String(value));

  return (
    <InputGroup
      label={t(config.labelKey)}
      value={displayed}
      onChange={(v) => {
        // Campo opcional limpo = "voltar à tabela" (D-EA4: ausente = tabela).
        if (config.optional && v.trim() === "") {
          setDraft(null);
          onCommit(undefined);
          return;
        }
        setDraft(v);
        // Só commita valores válidos — a store nunca recebe fora-de-domínio.
        if (validateDraft(v, config.positive, t) === null) {
          handleInput(v, (num) => onCommit(num));
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
      placeholder={config.placeholder}
      tooltip={t(config.tooltipKey)}
      error={error}
    />
  );
}

export interface FilamentAssumptionsFieldsProps {
  store: CalculatorState;
  t: (key: string) => string;
  handleInput: (value: string, setter: (v: number) => void) => void;
  isFieldVisible: (sectionId: string, fieldId: string) => boolean;
}

/**
 * Inputs dos parâmetros físicos do filamento (modo avançado apenas — o gating
 * vem do `isFieldVisible` da seção; campos não listados em
 * BASIC/INTERMEDIATE_FIELDS só aparecem no advanced). Renderiza null quando
 * não há campo visível. Espelha `SlicerProfileFields` (D-EA1).
 */
export function FilamentAssumptionsFields({
  store,
  t,
  handleInput,
  isFieldVisible,
}: FilamentAssumptionsFieldsProps) {
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
        <FlaskConical className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
        <span
          id={headingId}
          className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-muted)]"
        >
          {t("calc.filamentProfile")}
        </span>
        <Tooltip content={t("tooltip.filamentProfile")}>
          <Info className="w-3.5 h-3.5 text-[var(--color-text-muted)] cursor-help" />
        </Tooltip>
      </div>
      <div className="grid grid-cols-2 @form:grid-cols-3 gap-3">
        {visible.map((config) => (
          <FilamentAssumptionField
            key={config.key}
            config={config}
            value={store.fdmFilament[config.key]}
            t={t}
            handleInput={handleInput}
            onCommit={(v) => store.setFdmFilament({ [config.key]: v })}
          />
        ))}
      </div>
    </div>
  );
}
