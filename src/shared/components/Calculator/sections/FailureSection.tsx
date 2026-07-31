import { AlertTriangle } from 'lucide-react'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import { Select } from '@/shared/components/ui/Select'
import { ToggleSwitch } from '@/shared/components/ui/ToggleCard'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

export interface FailureSectionProps {
	renderSectionHeader: (
		Icon: typeof AlertTriangle,
		title: string,
		subtitle?: string,
		sectionId?: string,
	) => React.ReactNode
	t: (key: string) => string
	currencySymbol: string
	handleInput: (value: string, setter: (v: number) => void) => void
	isFDM: boolean
	store: CalculatorState
}

export function FailureSection({
	renderSectionHeader,
	t,
	isFDM,
	store,
}: FailureSectionProps) {
	const failureMode = isFDM
		? store.fdmPrintParams.failureMode
		: store.resinPrintParams.failureMode;
	const failureValue = isFDM
		? store.fdmPrintParams.failureValue
		: store.resinPrintParams.failureValue;
	const riskMultiplier = isFDM
		? store.fdmPrintParams.riskMultiplier
		: store.resinPrintParams.riskMultiplier;
	const failureEnabled = store.enabledSections.failure;

	const setFailureField = (field: Partial<typeof store.fdmPrintParams>) => {
		const current = isFDM ? store.fdmPrintParams : store.resinPrintParams;
		const update = { ...current, ...field };
		if (isFDM) {
			store.setFdmPrintParams(update);
		} else {
			store.setResinPrintParams(update);
		}
	};

	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			{renderSectionHeader(
				AlertTriangle,
				t("calc.failure.title"),
				t("calc.failure.description"),
				"failure",
			)}
			<div className="space-y-4">
				<div className="flex items-center justify-between surface rounded-xl px-4 py-3">
				<span className="text-xs font-semibold text-[var(--color-text-secondary)]">
					{t("calc.failure.enableFailure")}
				</span>
					<ToggleSwitch
						enabled={failureEnabled}
						onToggle={() => {
							store.toggleSection("failure");
							if (!failureEnabled && failureMode === "none") {
								setFailureField({ failureMode: "percent", failureValue: 10 });
							}
						}}
					/>
				</div>
				<div
					className={`space-y-4 transition-all duration-300 ${failureEnabled ? "" : "opacity-40 pointer-events-none"}`}
				>
					<div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
						<Select
							label={t("calc.failure.mode")}
							value={failureMode === "none" ? "percent" : failureMode}
							onChange={(v) =>
								setFailureField({
									failureMode: v as "percent" | "fixed",
									failureValue:
										v === "percent" ? failureValue || 10 : failureValue,
								})
							}
							options={[
								{ value: "percent", label: t("calc.failure.modePercent") },
								{ value: "fixed", label: t("calc.failure.modeFixed") },
							]}
						/>
						<InputGroup
							label={t("calc.failure.value")}
							value={failureValue}
							onChange={(v) =>
								setFailureField({ failureValue: parseFloat(v) || 0 })
							}
							type="number"
							unit={failureMode === "fixed" ? undefined : "%"}
							prefix={failureMode === "fixed" ? "R$" : undefined}
							tooltip={t('tooltip.risk')}
						/>
					</div>
					<InputGroup
						label={t("calc.failure.riskMultiplier")}
						value={riskMultiplier}
						onChange={(v) =>
							setFailureField({ riskMultiplier: parseFloat(v) || 0 })
						}
						type="number"
						step="0.1"
						tooltip={t("calc.failure.riskMultiplierTooltip")}
					/>
				</div>
			</div>
		</div>
	);
}
