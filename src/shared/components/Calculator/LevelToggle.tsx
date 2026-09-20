import { useTranslation } from "react-i18next";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import { LEVEL_LABELS, LEVEL_DESCRIPTIONS } from "./Calculator.constants";

export function LevelToggle() {
	const { t } = useTranslation();
	const { calcLevel, setCalcLevel } = useCalculatorStore(
		useShallow((s) => ({ calcLevel: s.calcLevel, setCalcLevel: s.setCalcLevel })),
	);

	return (
		<div
			data-tutorial="level-toggle"
			className="inline-flex items-center rounded-xl p-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border-subtle)]"
		>
			{(['basic', 'intermediate', 'advanced'] as const).map((level) => (
				<button
					key={level}
					onClick={() => setCalcLevel(level)}
					className={`min-h-[44px] min-w-[44px] px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
						calcLevel === level
							? "bg-[var(--color-accent)] text-white shadow-md shadow-[var(--color-accent-muted)]"
							: "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]"
					}`}
				>
					<div className="flex flex-col items-center gap-0.5">
						<span>{t(LEVEL_LABELS[level])}</span>
						<span className="hidden sm:block text-[10px] opacity-70 leading-tight whitespace-nowrap">
							{t(LEVEL_DESCRIPTIONS[level])}
						</span>
					</div>
				</button>
			))}
		</div>
	);
}
