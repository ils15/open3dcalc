import { useTranslation } from "react-i18next";
import {
  WIZARD_STEPS,
  WIZARD_TOTAL_STEPS,
  type WizardStep,
} from "@/shared/stores/wizardStore";

export interface WizardStepperProps {
  currentStep: WizardStep;
  onStepSelect: (step: WizardStep) => void;
}

export function WizardStepper({
  currentStep,
  onStepSelect,
}: WizardStepperProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <nav aria-label={t("wizard.title")} className="w-full">
      <p className="mb-3 text-center text-xs text-[var(--color-text-muted)]">
        {t("wizard.stepOf", {
          current: currentStep,
          total: WIZARD_TOTAL_STEPS,
        })}
      </p>
      <ol className="grid grid-cols-4 gap-2" aria-label={t("wizard.title")}>
        {WIZARD_STEPS.map((step) => {
          const isCurrent = step === currentStep;
          return (
            <li key={step} className="min-w-0">
              <button
                type="button"
                aria-label={t(`wizard.steps.${step}.title`)}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onStepSelect(step)}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                  isCurrent
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] ${
                    isCurrent
                      ? "bg-[var(--accent-fill)] text-[var(--accent-fill-fg)]"
                      : "bg-[var(--color-bg-elevated)]"
                  }`}
                >
                  {step}
                </span>
                <span className="hidden min-w-0 truncate sm:inline">
                  {t(`wizard.steps.${step}.title`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
