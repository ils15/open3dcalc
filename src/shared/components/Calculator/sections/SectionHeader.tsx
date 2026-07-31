import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import { useDismissablePopover } from "@/shared/hooks/useDismissablePopover";
import { INTERMEDIATE_FIELDS, FIELD_LABELS } from "../Calculator.constants";

interface SectionHeaderProps {
	Icon: LucideIcon;
	title: string;
	subtitle?: string;
	sectionId?: string;
}

export function SectionHeader({ Icon, title, subtitle, sectionId }: SectionHeaderProps) {
	const { t } = useTranslation();
	const { calcLevel, hiddenFields, toggleField } = useCalculatorStore(
		useShallow((s) => ({ calcLevel: s.calcLevel, hiddenFields: s.hiddenFields, toggleField: s.toggleField })),
	);

	const { open: isOpen, toggle: handleToggle, triggerRef, contentRef } = useDismissablePopover<HTMLButtonElement>();

	const isCustomizable = sectionId
		&& INTERMEDIATE_FIELDS[sectionId]?.length > 0
		&& calcLevel !== "basic";

	return (
		<div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-[var(--color-border)]">
			<Icon className="w-3.5 h-3.5 text-[var(--color-accent)] shrink-0" />
			<div className="flex-1 min-w-0">
				<h2 className="text-xs font-bold text-[var(--color-text-primary)] truncate">{title}</h2>
				{subtitle && (
					<p className="text-[10px] text-[var(--color-text-muted)] truncate">{subtitle}</p>
				)}
			</div>
			{isCustomizable && sectionId && (
				<div className="relative">
					<button
						type="button"
						ref={triggerRef}
						onClick={handleToggle}
						className="min-h-[44px] min-w-[44px] p-1 rounded-md hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
						title={t("calc.customizeFields")}
						aria-haspopup="menu"
						aria-expanded={isOpen}
					>
						<Settings className="w-3.5 h-3.5" />
					</button>
					{isOpen && (
					<div ref={contentRef} role="menu" aria-label={t("calc.customizeFields")} className="absolute right-0 top-8 z-50 w-56 surface border border-[var(--color-border)] rounded-xl p-2 shadow-xl">
						<p className="text-[10px] font-semibold text-[var(--color-text-muted)] px-2 py-1 uppercase tracking-wide">
								{t("calc.customizeFields")}
							</p>
							{(INTERMEDIATE_FIELDS[sectionId] ?? []).map((fieldId) => (
								<label
									key={fieldId}
									className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--color-bg-hover)] cursor-pointer text-xs text-[var(--color-text-secondary)]"
								>
									<input
										type="checkbox"
										checked={!hiddenFields.includes(`${sectionId}.${fieldId}`)}
										onChange={() => toggleField(`${sectionId}.${fieldId}`)}
										className="rounded border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
									/>
									{t(FIELD_LABELS[fieldId] ?? fieldId)}
								</label>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
