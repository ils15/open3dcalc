import { HardHat } from 'lucide-react'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

export interface LaborSectionProps {
	renderSectionHeader: (
		Icon: typeof HardHat,
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

export function LaborSection({
	renderSectionHeader,
	t,
	currencySymbol,
	handleInput,
	isFDM,
	store,
}: LaborSectionProps) {
	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			{renderSectionHeader(
				HardHat,
				t('calc.labor'),
				t('calc.sectionDesc.labor'),
				'labor',
			)}
			<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
				<InputGroup
					label={t('calc.setupTime')}
					value={
						isFDM
							? store.fdmLabor.setupTimeMinutes
							: store.resinLabor.setupTimeMinutes
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmLabor({
										...store.fdmLabor,
										setupTimeMinutes: val,
									})
								: store.setResinLabor({
										...store.resinLabor,
										setupTimeMinutes: val,
									}),
						)
					}
					type="number"
					unit="min"
					tooltip={t('tooltip.setupTime')}
				/>
				<InputGroup
					label={t('calc.postTime')}
					value={
						isFDM
							? store.fdmLabor.postProcessingTimeMinutes
							: store.resinLabor.postProcessingTimeMinutes
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmLabor({
										...store.fdmLabor,
										postProcessingTimeMinutes: val,
									})
								: store.setResinLabor({
										...store.resinLabor,
										postProcessingTimeMinutes: val,
									}),
						)
					}
					type="number"
					unit="min"
					tooltip={t('tooltip.postProcessingTime')}
				/>
				<InputGroup
					label={t('calc.hourlyRate')}
					value={
						isFDM ? store.fdmLabor.hourlyRate : store.resinLabor.hourlyRate
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmLabor({ ...store.fdmLabor, hourlyRate: val })
								: store.setResinLabor({
										...store.resinLabor,
										hourlyRate: val,
									}),
						)
					}
					type="number"
					prefix={currencySymbol}
					tooltip={t('tooltip.hourlyRate')}
				/>
			</div>
		</div>
	)
}
