import { useTranslation } from "react-i18next";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { useCurrency } from "@/shared/hooks/useCurrency";
import type { WizardDraft, WizardErrorKind } from "@/shared/stores/wizardStore";

type WizardErrors = Partial<Record<keyof WizardDraft, WizardErrorKind>>;
type SetWizardField = <K extends keyof WizardDraft>(
  key: K,
  value: WizardDraft[K],
) => void;

export interface Step3LaborProps {
  draft: WizardDraft;
  errors: WizardErrors;
  setField: SetWizardField;
}

export function Step3Labor({
  draft,
  errors,
  setField,
}: Step3LaborProps): React.ReactElement {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const currentErrors = errors ?? {};
  const fieldError = (key: keyof WizardDraft): string | undefined => {
    const kind = currentErrors[key];
    return kind ? t(`wizard.errors.${kind}`) : undefined;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <InputGroup
        label={t("wizard.fields.setupTimeMinutes.label")}
        value={draft.setupTimeMinutes}
        onChange={(value) => setField("setupTimeMinutes", Number(value))}
        type="number"
        unit={t("wizard.fields.setupTimeMinutes.unit")}
        step="1"
        error={fieldError("setupTimeMinutes")}
      />
      <InputGroup
        label={t("wizard.fields.postProcessingMinutes.label")}
        value={draft.postProcessingMinutes}
        onChange={(value) =>
          setField("postProcessingMinutes", Number(value))
        }
        type="number"
        unit={t("wizard.fields.postProcessingMinutes.unit")}
        step="1"
        error={fieldError("postProcessingMinutes")}
      />
      <InputGroup
        label={t("wizard.fields.hourlyRate.label")}
        value={draft.hourlyRate}
        onChange={(value) => setField("hourlyRate", Number(value))}
        type="number"
        prefix={symbol}
        unit={t("wizard.fields.hourlyRate.unit")}
        step="0.01"
        error={fieldError("hourlyRate")}
      />
      <InputGroup
        label={t("wizard.fields.packagingCost.label")}
        value={draft.packagingCost}
        onChange={(value) => setField("packagingCost", Number(value))}
        type="number"
        prefix={symbol}
        unit={t("wizard.fields.packagingCost.unit")}
        step="0.01"
        error={fieldError("packagingCost")}
      />
      <InputGroup
        label={t("wizard.fields.profitMarginPercent.label")}
        value={draft.profitMarginPercent}
        onChange={(value) => setField("profitMarginPercent", Number(value))}
        type="number"
        unit={t("wizard.fields.profitMarginPercent.unit")}
        step="0.1"
        error={fieldError("profitMarginPercent")}
      />
    </div>
  );
}
