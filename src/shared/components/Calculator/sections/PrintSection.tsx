import { SlidersHorizontal } from 'lucide-react'
import { InputGroup } from '@/shared/components/ui/InputGroup'
import { Select } from '@/shared/components/ui/Select'
import type { CalculatorState } from '@/shared/stores/calculatorStore'

export interface PrintSectionProps {
	renderSectionHeader: (
		Icon: typeof SlidersHorizontal,
		title: string,
		subtitle?: string,
		sectionId?: string,
	) => React.ReactNode
	t: (key: string) => string
	currencySymbol: string
	handleInput: (value: string, setter: (v: number) => void) => void
	isFDM: boolean
	store: CalculatorState
	isFieldVisible: (sectionId: string, fieldId: string) => boolean
	handlePrinterSelect: (id: string) => void
	catalogPrinters: Array<{
		id: string
		name: string
		power: number
		value: number
		image?: string
		brand: string
	}>
}

export function PrintSection({
	renderSectionHeader,
	t,
	handleInput,
	isFDM,
	store,
	isFieldVisible,
	handlePrinterSelect,
	catalogPrinters,
}: PrintSectionProps) {
	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			{renderSectionHeader(
				SlidersHorizontal,
				t("calc.printParams"),
				t("calc.sectionDesc.print"),
				"print",
			)}
			<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
				<InputGroup
					label={t("calc.printTime")}
					value={
						isFDM
							? store.fdmPrintParams.printTimeHours
							: store.resinPrintParams.printTimeHours
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmPrintParams({
										...store.fdmPrintParams,
										printTimeHours: val,
									})
								: store.setResinPrintParams({
										...store.resinPrintParams,
										printTimeHours: val,
									}),
						)
					}
					type="number"
					unit="h"
					tooltip={t('tooltip.printTimeHours')}
				/>
				<InputGroup
					label={t("calc.printerPower")}
					value={
						isFDM
							? store.fdmPrintParams.printerPowerWatts
							: store.resinPrintParams.printerPowerWatts
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmPrintParams({
										...store.fdmPrintParams,
										printerPowerWatts: val,
									})
								: store.setResinPrintParams({
										...store.resinPrintParams,
										printerPowerWatts: val,
									}),
						)
					}
					type="number"
					unit="W"
					tooltip={t('tooltip.printerPowerWatts')}
				/>
				<InputGroup
					label={t("calc.energyCost")}
					value={
						isFDM
							? store.fdmPrintParams.energyCostPerKwh
							: store.resinPrintParams.energyCostPerKwh
					}
					onChange={(v) =>
						handleInput(v, (val) =>
							isFDM
								? store.setFdmPrintParams({
										...store.fdmPrintParams,
										energyCostPerKwh: val,
									})
								: store.setResinPrintParams({
										...store.resinPrintParams,
										energyCostPerKwh: val,
									}),
						)
					}
					type="number"
					unit="R$/kWh"
					step="0.01"
					tooltip={t('tooltip.energyCostPerKwh')}
				/>
				{isFDM && isFieldVisible("print", "selectedPrinter") && (
					<div className="@form:col-span-2">
						<Select
							label={t("calc.printer")}
							value={store.selectedPrinter.id}
							onChange={handlePrinterSelect}
							options={catalogPrinters.map((p) => ({
								label: p.name,
								value: p.id,
								image: p.image,
								subtitle: `${p.power}W · R$ ${p.value}`,
								group: p.brand,
							}))}
							groups
							search
						/>
					</div>
				)}
			</div>
		</div>
	);
}
