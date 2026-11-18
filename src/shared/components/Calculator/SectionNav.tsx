import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import { StepBadge } from "@/shared/components/ui/StepBadge";
import {
  SECTIONS,
  LEVEL_SECTIONS,
  SECTION_ENABLES,
  sectionStepNumbers,
} from "./Calculator.constants";

interface SectionNavProps {
  activeSection: string;
  onSectionClick: (id: string) => void;
}

export function SectionNav({ activeSection, onSectionClick }: SectionNavProps) {
  const { t } = useTranslation();
  const { calcLevel, enabledSections } = useCalculatorStore(
    useShallow((s) => ({
      calcLevel: s.calcLevel,
      enabledSections: s.enabledSections,
    })),
  );

  const visibleSections = SECTIONS.filter((s) =>
    LEVEL_SECTIONS[calcLevel].includes(s.id),
  );
  // Output sections (results) are not steps, so they carry no number. The rail
  // reads the same helper the section headings use, so a rail item and its
  // heading can never disagree about which step they are.
  const stepById = sectionStepNumbers(calcLevel);

  return (
    <>
      {/* Tablet section nav — icons only */}
      <nav className="hidden md:flex lg:hidden flex-col gap-1 w-14 shrink-0 sticky top-4 h-fit px-1 py-2">
        {visibleSections.map((s) => {
          const keys = SECTION_ENABLES[s.id] || [];
          const anyEnabled =
            keys.length === 0 || keys.some((k) => enabledSections[k]);
          const step = stepById.get(s.id);
          return (
            /* contrast-site: section-nav-desktop-item */
            <button
              key={s.id}
              onClick={() => {
                onSectionClick(s.id);
                document
                  .getElementById(`section-${s.id}`)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`w-full py-2 rounded-xl flex items-center justify-center min-h-[44px] transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                activeSection === s.id
                  ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] border border-[var(--color-accent)]/20"
                  : `text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-transparent ${
                      keys.length > 0 && !anyEnabled ? "opacity-50" : ""
                    }`
              }`}
              title={t(s.label)}
            >
              {/* w-14 rail: the sm badge keeps icon + numeral inside the 44px
                  target without widening the rail, which is pinned by test. */}
              {step !== undefined && <StepBadge step={step} size="sm" />}
              <s.Icon
                className={`w-4 h-4 ${activeSection === s.id ? "text-[var(--color-accent)]" : ""}`}
              />
            </button>
          );
        })}
      </nav>

      {/* Desktop sidebar — icon + label + cost toggle dot */}
      <nav className="hidden lg:flex flex-col gap-1 w-[134px] xl:w-[142px] shrink-0 sticky top-4 h-fit px-1.5 py-1">
        <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-[var(--color-text-muted)] mb-1 ml-2">
          {t("sections.title")}
        </div>
        {visibleSections.map((s) => {
          const keys = SECTION_ENABLES[s.id] || [];
          const anyEnabled =
            keys.length === 0 || keys.some((k) => enabledSections[k]);
          const step = stepById.get(s.id);
          const isActive = activeSection === s.id;
          return (
            <div key={s.id}>
              {/* contrast-site: section-nav-compact-item */}
              <button
                onClick={() => {
                  onSectionClick(s.id);
                  document
                    .getElementById(`section-${s.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`relative w-full py-2.5 px-2.5 rounded-xl flex items-center gap-2 min-h-[44px] transition-all text-left focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
                  isActive
                    ? "bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-semibold border border-[var(--color-accent)]/20 shadow-xs"
                    : `text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-transparent ${
                        keys.length > 0 && !anyEnabled ? "opacity-50" : ""
                      }`
                }`}
                title={t(s.label)}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-[var(--color-accent)]"
                  />
                )}
                {step !== undefined && <StepBadge step={step} size="sm" />}
                <s.Icon
                  className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--color-accent)]" : ""}`}
                />
                <span className="text-[11px] font-medium leading-tight truncate flex-1">
                  {t(s.shortKey)}
                </span>
                {keys.length > 0 && (
                  <span
                    aria-hidden="true"
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      anyEnabled
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-border-hover)]"
                    }`}
                  />
                )}
              </button>
            </div>
          );
        })}
      </nav>
    </>
  );
}
