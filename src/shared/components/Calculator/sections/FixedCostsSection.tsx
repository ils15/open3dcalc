import { Receipt } from 'lucide-react'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import { ToggleSwitch } from '@/shared/components/ui/ToggleCard'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

export interface FixedCostsSectionProps {
	renderSectionHeader: (
		Icon: typeof Receipt,
		title: string,
		subtitle?: string,
		sectionId?: string,
	) => React.ReactNode
	t: (key: string) => string
	currencySymbol: string
	handleInput: (value: string, setter: (v: number) => void) => void
	store: CalculatorState
}

export function FixedCostsSection({
	renderSectionHeader,
	t,
	currencySymbol,
	handleInput,
	store,
}: FixedCostsSectionProps) {
	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			{renderSectionHeader(
				Receipt,
				t('calc.fixedCost.title'),
				t('calc.fixedCost.description'),
				'fixedCost',
			)}
			<div className="flex items-center justify-between mb-3">
			<span className="text-xs text-[var(--color-text-secondary)]">
				{t('calc.fixedCost.title')}
			</span>
				<ToggleSwitch
					enabled={store.fixedCosts.enabled}
					onToggle={(v) => store.setFixedCostsField('enabled', v)}
				/>
			</div>
			{store.fixedCosts.enabled && (
				<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
					<InputGroup
						label={t('calc.fixedCost.monthlyCost')}
						value={store.fixedCosts.monthlyCost}
						onChange={(v) =>
							handleInput(v, (val) =>
								store.setFixedCostsField('monthlyCost', val),
							)
						}
						type="number"
						prefix={currencySymbol}
						tooltip={t('calc.fixedCost.monthlyCostTooltip')}
					/>
					<InputGroup
						label={t('calc.fixedCost.monthlyHours')}
						value={store.fixedCosts.monthlyPrintHours}
						onChange={(v) =>
							handleInput(v, (val) =>
								store.setFixedCostsField('monthlyPrintHours', val),
							)
						}
						type="number"
						unit="h/mês"
						tooltip={t('calc.fixedCost.monthlyHoursTooltip')}
					/>
				</div>
			)}
		</div>
	)
}
