import { useEffect, useRef, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  WIZARD_TOTAL_STEPS,
  useWizardStore,
} from "@/shared/stores/wizardStore";
import { WizardStepper } from "./WizardStepper";
import { Step1Material } from "./steps/Step1Material";
import { Step2Printer } from "./steps/Step2Printer";
import { Step3Labor } from "./steps/Step3Labor";
import { Step4Result } from "./steps/Step4Result";

export function GuidedWizard(): React.ReactElement {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = useWizardStore((state) => state.step);
  const draft = useWizardStore((state) => state.draft);
  const errors = useWizardStore((state) => state.errors);
  const setField = useWizardStore((state) => state.setField);
  const start = useWizardStore((state) => state.start);
  const next = useWizardStore((state) => state.next);
  const prev = useWizardStore((state) => state.prev);
  const goTo = useWizardStore((state) => state.goTo);
  const finish = useWizardStore((state) => state.finish);
  const exit = useWizardStore((state) => state.exit);
  const results = useCalculatorStore((state) => state.results);

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      prev();
    }
  };

  const renderStep = (): React.ReactNode => {
    switch (step) {
      case 1:
        return <Step1Material draft={draft} errors={errors} setField={setField} />;
      case 2:
        return <Step2Printer draft={draft} errors={errors} setField={setField} />;
      case 3:
        return <Step3Labor draft={draft} errors={errors} setField={setField} />;
      case 4:
        return <Step4Result results={results} onFinish={finish} />;
    }
  };

  return (
    <section
      role="region"
      aria-label={t("wizard.regionLabel")}
      onKeyDown={handleKeyDown}
      className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"
    >
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            {t("wizard.title")}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t("wizard.subtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={exit}
          className="min-h-11 shrink-0 rounded-lg border border-[var(--color-border)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {t("wizard.nav.exit")}
        </button>
      </header>

      <WizardStepper currentStep={step} onStepSelect={goTo} />

      <div
        data-testid="wizard-step-panel"
        className={`mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 shadow-sm sm:p-6 ${
          prefersReducedMotion ? "" : "wizard-step-enter"
        }`}
      >
        <div className="mb-5">
          <h2
            id="wizard-step-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-[var(--color-text-primary)] focus:outline-none"
          >
            {t(`wizard.steps.${step}.title`)}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t(`wizard.steps.${step}.description`)}
          </p>
        </div>
        {renderStep()}
      </div>

      <nav
        aria-label={t("wizard.nav.next")}
        className="mt-6 flex items-center justify-between gap-3"
      >
        <button
          type="button"
          onClick={prev}
          disabled={step === 1}
          className="min-h-11 rounded-lg border border-[var(--color-border)] px-4 font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("wizard.nav.previous")}
        </button>
        {step < WIZARD_TOTAL_STEPS && (
          <button
            type="button"
            onClick={next}
            className="min-h-11 rounded-lg bg-[var(--color-accent)] px-5 font-semibold text-[var(--color-bg)] transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          >
            {t("wizard.nav.next")}
          </button>
        )}
      </nav>
    </section>
  );
}
