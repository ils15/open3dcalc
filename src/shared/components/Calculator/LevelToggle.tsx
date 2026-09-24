import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "./Calculator.constants";

const LEVELS = ["basic", "intermediate", "advanced"] as const;

export function LevelToggle(): React.ReactElement {
	const { t } = useTranslation();
	const prefersReducedMotion = useReducedMotion();
	const { calcLevel, setCalcLevel } = useCalculatorStore(
		useShallow((s) => ({ calcLevel: s.calcLevel, setCalcLevel: s.setCalcLevel })),
	);
	const transitionClass = prefersReducedMotion
		? "transition-none"
		: "transition-colors duration-200";

	return (
		<div
			data-tutorial="level-toggle"
			className="inline-flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1"
		>
			{LEVELS.map((level) => {
				const isActive = calcLevel === level;
				const label = t(LEVEL_LABELS[level]);

				return (
					<button
						key={level}
						type="button"
						aria-label={label}
						aria-pressed={isActive}
						onClick={() => setCalcLevel(level)}
						className={`min-h-[44px] min-w-[44px] rounded-lg px-3.5 py-1.5 text-[13px] font-semibold ${transitionClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-overlay)] ${
							isActive
								? "bg-[var(--accent)] text-[var(--text-inverse)] shadow-[var(--shadow-sm)]"
								: "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
						}`}
					>
						<div className="flex flex-col items-center gap-0.5">
							<span>{label}</span>
							<span className="hidden text-[10px] leading-tight whitespace-nowrap opacity-70 sm:block">
								{t(LEVEL_DESCRIPTIONS[level])}
							</span>
						</div>
					</button>
				);
			})}
		</div>
	);
}
