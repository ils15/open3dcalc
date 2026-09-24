import { useEffect, useId } from "react";
import type { ReactElement } from "react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";

import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import {
  FIELD_LABELS,
  INTERMEDIATE_FIELDS,
  SECTIONS,
  isFieldVisibleForLevel,
} from "./Calculator.constants";

export interface FieldCustomizerProps {
  readonly className?: string;
}

/**
 * The single owner of field-level disclosure controls for the Classic surface.
 * Section headers intentionally remain presentational so one control owns every
 * section's personalization fields.
 */
export function FieldCustomizer({
  className = "",
}: FieldCustomizerProps): ReactElement | null {
  const { t } = useTranslation();
  const { calcLevel, hiddenFields, toggleField } = useCalculatorStore(
    useShallow((state) => ({
      calcLevel: state.calcLevel,
      hiddenFields: state.hiddenFields,
      toggleField: state.toggleField,
    })),
  );
  const { open, toggle, close, triggerRef, contentRef } =
    useDismissablePopover<HTMLButtonElement>();
  const popoverId = useId();
  const titleId = `${popoverId}-title`;

  const fieldSections = SECTIONS.filter(
    (section) => (INTERMEDIATE_FIELDS[section.id] ?? []).length > 0,
  );

  useEffect(() => {
    if (calcLevel === "basic") close();
  }, [calcLevel, close]);

  useEffect(() => {
    if (!open) return;
    contentRef.current
      ?.querySelector<HTMLInputElement>('input[type="checkbox"]')
      ?.focus();
  }, [open, contentRef]);

  if (calcLevel === "basic" || fieldSections.length === 0) return null;

  return (
    <div
      data-testid="field-customizer"
      className={`relative flex justify-end ${className}`}
    >
      <button
        type="button"
        ref={triggerRef}
        onClick={toggle}
        aria-label={t("calc.customizeFields")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        title={t("calc.customizeFields")}
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-raised)]"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={contentRef}
          id={popoverId}
          role="dialog"
          aria-labelledby={titleId}
          className="absolute right-0 top-12 z-50 max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-[var(--border-default)] bg-[var(--surface-overlay)] p-2 shadow-xl"
        >
          <p
            id={titleId}
            className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]"
          >
            {t("calc.customizeFields")}
          </p>
          <div className="space-y-2">
            {fieldSections.map((section) => {
              const fields = INTERMEDIATE_FIELDS[section.id] ?? [];
              const groupLabelId = `${popoverId}-${section.id}-group`;
              return (
                <fieldset
                  key={section.id}
                  aria-labelledby={groupLabelId}
                  className="space-y-1 border-0 p-0"
                >
                  <legend
                    id={groupLabelId}
                    className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]"
                  >
                    {t(section.shortKey)}
                  </legend>
                  {fields.map((fieldId) => {
                    const inputId = `${popoverId}-${section.id}-${fieldId}`;
                    const fieldKey = `${section.id}.${fieldId}`;
                    const checked = isFieldVisibleForLevel(
                      calcLevel,
                      hiddenFields,
                      section.id,
                      fieldId,
                    );
                    return (
                      <label
                        key={fieldId}
                        htmlFor={inputId}
                        className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]"
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleField(fieldKey)}
                          className="size-4 shrink-0 accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                        />
                        <span>{t(FIELD_LABELS[fieldId] ?? fieldId)}</span>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
