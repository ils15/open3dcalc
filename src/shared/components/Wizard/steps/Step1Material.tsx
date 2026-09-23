import { useTranslation } from "react-i18next";
import { InputGroup, SelectGroup } from "@/shared/components/ui/InputGroup";
import { useCurrency } from "@/shared/hooks/useCurrency";
import {
  WIZARD_MATERIALS,
  type WizardDraft,
  type WizardErrorKind,
} from "@/shared/stores/wizardStore";

type WizardErrors = Partial<Record<keyof WizardDraft, WizardErrorKind>>;
type SetWizardField = <K extends keyof WizardDraft>(
  key: K,
  value: WizardDraft[K],
) => void;

export interface Step1MaterialProps {
  draft: WizardDraft;
  errors: WizardErrors;
  setField: SetWizardField;
}

export function Step1Material({
  draft,
  errors,
  setField,
}: Step1MaterialProps): React.ReactElement {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const currentErrors = errors ?? {};
  const fieldError = (key: keyof WizardDraft): string | undefined => {
    const kind = currentErrors[key];
    return kind ? t(`wizard.errors.${kind}`) : undefined;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <InputGroup
          label={t("wizard.fields.productName.label")}
          value={draft.productName}
          onChange={(value) => setField("productName", value)}
          placeholder={t("wizard.fields.productName.placeholder")}
        />
      </div>
      <div>
        <SelectGroup
          label={t("wizard.fields.materialType.label")}
          value={draft.materialType}
          onChange={(value) => setField("materialType", value)}
          options={WIZARD_MATERIALS.map((material) => ({
            label: material,
            value: material,
          }))}
        />
        {fieldError("materialType") && (
          <p
            role="alert"
            className="mt-1 text-[11px] text-[var(--color-danger)]"
          >
            {fieldError("materialType")}
          </p>
        )}
      </div>
      <InputGroup
        label={t("wizard.fields.weightGrams.label")}
        value={draft.weightGrams}
        onChange={(value) => setField("weightGrams", Number(value))}
        type="number"
        unit={t("wizard.fields.weightGrams.unit")}
        step="0.1"
        error={fieldError("weightGrams")}
      />
      <InputGroup
        label={t("wizard.fields.costPerKg.label")}
        value={draft.costPerKg}
        onChange={(value) => setField("costPerKg", Number(value))}
        type="number"
        prefix={symbol}
        unit={t("wizard.fields.costPerKg.unit")}
        step="0.01"
        error={fieldError("costPerKg")}
      />
      <InputGroup
        label={t("wizard.fields.quantity.label")}
        value={draft.quantity}
        onChange={(value) => setField("quantity", Number(value))}
        type="number"
        step="1"
        error={fieldError("quantity")}
      />
    </div>
  );
}
