import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { isPersonalPrinter } from "@/shared/lib/printerCatalog";
import { useCatalogStore } from "@/shared/stores/catalogStore";
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
  onManagePrinters?: () => void;
}

export function Step2Printer({
  draft,
  errors,
  setField,
  onManagePrinters,
}: Step2PrinterProps): React.ReactElement {
  const { t } = useTranslation();
  const { symbol } = useCurrency();
  const printers = useCatalogStore((state) => state.printers);
  const currentErrors = errors ?? {};
  const fieldError = (key: keyof WizardDraft): string | undefined => {
    const kind = currentErrors[key];
    return kind ? t(`wizard.errors.${kind}`) : undefined;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Select
          label={t("wizard.fields.printer.label")}
          value={draft.printerId}
          onChange={(value) => setField("printerId", value)}
          options={printers.map((printer) => {
            const personal = isPersonalPrinter(printer);
            return {
              label: printer.name,
              value: printer.id,
              image: printer.image,
              group: personal ? t("catalog.myPrinters") : printer.brand,
              subtitle: `${printer.power}W · ${symbol} ${printer.value}${
                personal ? ` · ${t("catalog.customPrinter")}` : ""
              }`,
            };
          })}
          groups
          search
        />
        {onManagePrinters && (
          <button
            type="button"
            onClick={onManagePrinters}
            className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-[var(--color-accent)] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {t("wizard.fields.printer.manage")}
          </button>
        )}
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
