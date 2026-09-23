import { useTranslation } from "react-i18next";
import { InputGroup, SelectGroup } from "@/shared/components/ui/InputGroup";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { printers } from "@/shared/lib/printers";
import type { WizardDraft, WizardErrorKind } from "@/shared/stores/wizardStore";

type WizardErrors = Partial<Record<keyof WizardDraft, WizardErrorKind>>;
type SetWizardField = <K extends keyof WizardDraft>(
  key: K,
  value: WizardDraft[K],
) => void;

export interface Step2PrinterProps {
  draft: WizardDraft;
  errors: WizardErrors;
  setField: SetWizardField;
}

export function Step2Printer({
  draft,
  errors,
  setField,
}: Step2PrinterProps): React.ReactElement {
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
        <SelectGroup
          label={t("wizard.fields.printer.label")}
          value={draft.printerId}
          onChange={(value) => setField("printerId", value)}
          options={printers.map((printer) => ({
            label: `${printer.brand} — ${printer.name}`,
            value: printer.id,
          }))}
        />
        {fieldError("printerId") && (
          <p
            role="alert"
            className="mt-1 text-[11px] text-[var(--color-danger)]"
          >
            {fieldError("printerId")}
          </p>
        )}
      </div>
      <InputGroup
        label={t("wizard.fields.printTimeHours.label")}
        value={draft.printTimeHours}
        onChange={(value) => setField("printTimeHours", Number(value))}
        type="number"
        unit={t("wizard.fields.printTimeHours.unit")}
        step="0.1"
        error={fieldError("printTimeHours")}
      />
      <InputGroup
        label={t("wizard.fields.energyCostPerKwh.label")}
        value={draft.energyCostPerKwh}
        onChange={(value) => setField("energyCostPerKwh", Number(value))}
        type="number"
        prefix={symbol}
        unit={t("wizard.fields.energyCostPerKwh.unit")}
        step="0.01"
        error={fieldError("energyCostPerKwh")}
      />
    </div>
  );
}
