import { Printer } from 'lucide-react'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import { ToggleSwitch } from '@/shared/components/ui/ToggleCard'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

export interface MachineSectionProps {
	renderSectionHeader: (
		Icon: typeof Printer,
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

export function MachineSection({
	renderSectionHeader,
	t,
	currencySymbol,
	handleInput,
	isFDM,
	store,
}: MachineSectionProps) {
	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			{renderSectionHeader(
				Printer,
				t('calc.machine'),
				t('calc.sectionDesc.machine'),
				'machine',
			)}
			<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
				<InputGroup
					label={t('calc.machineCost')}
					value={
						isFDM
							? store.fdmMachine.machineCost
							: store.resinMachine.machineCost
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmMachine({
										...store.fdmMachine,
										machineCost: val,
									})
								: store.setResinMachine({
										...store.resinMachine,
										machineCost: val,
									}),
						)
					}
					type="number"
					prefix={currencySymbol}
					tooltip={t('tooltip.machineCost')}
				/>
				<InputGroup
					label={t('calc.depreciationMonths')}
					value={
						isFDM
							? store.fdmMachine.depreciationMonths
							: store.resinMachine.depreciationMonths
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmMachine({
										...store.fdmMachine,
										depreciationMonths: val,
									})
								: store.setResinMachine({
										...store.resinMachine,
										depreciationMonths: val,
									}),
						)
					}
					type="number"
					unit="meses"
					tooltip={t('tooltip.depreciationMonths')}
				/>
				<InputGroup
					label={t('calc.hoursPerMonth')}
					value={
						isFDM
							? store.fdmMachine.hoursPerMonth
							: store.resinMachine.hoursPerMonth
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmMachine({
										...store.fdmMachine,
										hoursPerMonth: val,
									})
								: store.setResinMachine({
										...store.resinMachine,
										hoursPerMonth: val,
									}),
						)
					}
					type="number"
					unit="h/mês"
					tooltip={t('tooltip.hoursPerMonth')}
				/>
				<div className="@form:col-span-2 flex items-center justify-between surface rounded-xl p-4 sm:p-5">
				<span className="text-xs text-[var(--color-text-secondary)]">
					{t('calc.maintenance')}
				</span>
					<ToggleSwitch
						enabled={
							isFDM
								? store.fdmMachine.maintenanceEnabled
								: store.resinMachine.maintenanceEnabled
						}
						onToggle={(v) =>
							isFDM
								? store.setFdmMachine({
										...store.fdmMachine,
										maintenanceEnabled: v,
									})
								: store.setResinMachine({
										...store.resinMachine,
										maintenanceEnabled: v,
									})
						}
					/>
				</div>
				{(isFDM
					? store.fdmMachine.maintenanceEnabled
					: store.resinMachine.maintenanceEnabled) && (
					<div className="@form:col-span-2">
						<InputGroup
							label={t('calc.maintenanceCost')}
							value={
								isFDM
									? store.fdmMachine.maintenanceCost
									: store.resinMachine.maintenanceCost
							}
							onChange={(v) =>
								handleInput(v, (val) =>
									isFDM
										? store.setFdmMachine({
												...store.fdmMachine,
												maintenanceCost: val,
											})
										: store.setResinMachine({
												...store.resinMachine,
												maintenanceCost: val,
											}),
								)
							}
							type="number"
							prefix="R$/mês"
							tooltip={t('tooltip.maintenanceCost')}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
