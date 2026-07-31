import { Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { ToggleSwitch } from "@/shared/components/ui/ToggleCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { SectionHeader } from "./SectionHeader";

export function HardwareSection() {
	const { t } = useTranslation();
	const store = useCalculatorStore();
	const { symbol: currencySymbol } = useCurrency();
	const isFDM = store.activeTab === "fdm";

	const handleInput = (value: string, setter: (v: number) => void) => {
		setter(value === "" ? 0 : parseFloat(value) || 0);
	};

	return (
		<div className="surface rounded-xl p-4 sm:p-5 space-y-6">
			<SectionHeader
				Icon={Wrench}
				title={t("calc.fdmHardware")}
				subtitle={t(
					isFDM
						? "calc.sectionDesc.fdmHardware"
						: "calc.sectionDesc.resinHardware",
				)}
				sectionId="hardware"
			/>
			{isFDM && (
				<>
					<div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
						<div className="space-y-4">
							<div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
								<span className="text-xs font-semibold text-[var(--color-info)]">
									{t("calc.nozzle")}
								</span>
								<ToggleSwitch
									enabled={store.fdmHardware.nozzleEnabled}
									onToggle={(v) =>
										store.setFdmHardware({
											...store.fdmHardware,
											nozzleEnabled: v,
										})
									}
								/>
							</div>
							{store.fdmHardware.nozzleEnabled && (
								<>
									<InputGroup
										label={t("calc.nozzleCost")}
										value={store.fdmHardware.nozzleCost}
										onChange={(v) =>
											handleInput(v, (val) =>
												store.setFdmHardware({
													...store.fdmHardware,
													nozzleCost: val,
												}),
											)
										}
										type="number"
										prefix={currencySymbol}
										tooltip={t('tooltip.nozzleCost')}
									/>
									<InputGroup
										label={t("calc.nozzleLife")}
										value={store.fdmHardware.nozzleLifespanKg}
										onChange={(v) =>
											handleInput(v, (val) =>
												store.setFdmHardware({
													...store.fdmHardware,
													nozzleLifespanKg: val,
												}),
											)
										}
										type="number"
										unit="kg"
										tooltip={t('tooltip.nozzleLife')}
									/>
								</>
							)}
						</div>
						<div className="space-y-4">
							<div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2">
								<span className="text-xs font-semibold text-[var(--color-info)]">
									{t("calc.bed")}
								</span>
								<ToggleSwitch
									enabled={store.fdmHardware.bedEnabled}
									onToggle={(v) =>
										store.setFdmHardware({
											...store.fdmHardware,
											bedEnabled: v,
										})
									}
								/>
							</div>
							{store.fdmHardware.bedEnabled && (
								<InputGroup
									label={t("calc.bedCost")}
									value={store.fdmHardware.bedAdhesionCost}
									onChange={(v) =>
										handleInput(v, (val) =>
											store.setFdmHardware({
												...store.fdmHardware,
												bedAdhesionCost: val,
											}),
										)
									}
									type="number"
									prefix={currencySymbol}
									tooltip={t('tooltip.bedCost')}
								/>
							)}
						</div>
					</div>
					<div className="border-t border-[var(--color-border)] pt-6">
						<div className="flex items-center gap-2 mb-4">
							<span>🎨</span>
							<span className="text-sm font-semibold text-[var(--color-text-primary)]">
								{t("calc.fdmFinishing")}
							</span>
						</div>
						<InputGroup
							label={t("calc.finishingSupplies")}
							value={store.fdmFinishing.suppliesCost}
							onChange={(v) =>
								handleInput(v, (val) =>
									store.setFdmFinishing({
										...store.fdmFinishing,
										suppliesCost: val,
									}),
								)
							}
							type="number"
							prefix={currencySymbol}
							tooltip={t('tooltip.finishing')}
						/>
					</div>
				</>
			)}
			{!isFDM && (
				<>
					<div className="space-y-4">
						<div className="flex items-center gap-2 mb-2">
							<span>🧪</span>
							<span className="text-sm font-semibold text-[var(--color-text-primary)]">
								{t("calc.resinPostProcess")}
							</span>
						</div>
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-[var(--color-text-secondary)]">
								{t("calc.washing")}
							</span>
							<ToggleSwitch
								enabled={store.resinPostProcess.washingEnabled}
								onToggle={(v) =>
									store.setResinPostProcess({
										...store.resinPostProcess,
										washingEnabled: v,
									})
								}
							/>
						</div>
						{store.resinPostProcess.washingEnabled && (
							<div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-[var(--color-border)]">
								<InputGroup
									label={t("calc.alcoholCost")}
									value={store.resinPostProcess.alcoholCostPerLiter}
									onChange={(v) =>
										handleInput(v, (val) =>
											store.setResinPostProcess({
												...store.resinPostProcess,
												alcoholCostPerLiter: val,
											}),
										)
									}
									type="number"
									prefix="R$/L"
									tooltip={t('tooltip.alcoholCostPerLiter')}
								/>
								<InputGroup
									label={t("calc.alcoholVol")}
									value={store.resinPostProcess.alcoholVolumeLiters}
									onChange={(v) =>
										handleInput(v, (val) =>
											store.setResinPostProcess({
												...store.resinPostProcess,
												alcoholVolumeLiters: val,
											}),
										)
									}
									type="number"
									unit="L"
									tooltip={t('tooltip.alcoholVolume')}
								/>
							</div>
						)}
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-[var(--color-text-secondary)]">
								{t("calc.curing")}
							</span>
							<ToggleSwitch
								enabled={store.resinPostProcess.curingEnabled}
								onToggle={(v) =>
									store.setResinPostProcess({
										...store.resinPostProcess,
										curingEnabled: v,
									})
								}
							/>
						</div>
						{store.resinPostProcess.curingEnabled && (
							<div className="grid grid-cols-2 gap-3 pl-3 border-l-2 border-[var(--color-border)]">
								<InputGroup
									label={t("calc.cureTime")}
									value={store.resinPostProcess.curingTimeMinutes}
									onChange={(v) =>
										handleInput(v, (val) =>
											store.setResinPostProcess({
												...store.resinPostProcess,
												curingTimeMinutes: val,
											}),
										)
									}
									type="number"
									unit="min"
									tooltip={t('tooltip.cureTime')}
								/>
								<InputGroup
									label={t("calc.curePower")}
									value={store.resinPostProcess.curingPowerWatts}
									onChange={(v) =>
										handleInput(v, (val) =>
											store.setResinPostProcess({
												...store.resinPostProcess,
												curingPowerWatts: val,
											}),
										)
									}
									type="number"
									unit="W"
									tooltip={t('tooltip.curePower')}
								/>
							</div>
						)}
					</div>
					<div className="border-t border-[var(--color-border)] pt-6">
						<div className="flex items-center gap-2 mb-4">
							<span>🖥️</span>
							<span className="text-sm font-semibold text-[var(--color-text-primary)]">
								{t("calc.resinHardware")}
							</span>
						</div>
						<div className="grid grid-cols-1 @md:grid-cols-2 gap-3">
							<InputGroup
								label={t("calc.lcdCost")}
								value={store.resinHardware.lcdCost}
								onChange={(v) =>
									handleInput(v, (val) =>
										store.setResinHardware({
											...store.resinHardware,
											lcdCost: val,
										}),
									)
								}
								type="number"
								prefix={currencySymbol}
								tooltip={t('tooltip.lcdCost')}
							/>
							<InputGroup
								label={t("calc.lcdLife")}
								value={store.resinHardware.lcdLifespanHours}
								onChange={(v) =>
									handleInput(v, (val) =>
										store.setResinHardware({
											...store.resinHardware,
											lcdLifespanHours: val,
										}),
									)
								}
								type="number"
								unit="h"
								tooltip={t('tooltip.lcdLife')}
							/>
							<InputGroup
								label={t("calc.fepCost")}
								value={store.resinHardware.fepCost}
								onChange={(v) =>
									handleInput(v, (val) =>
										store.setResinHardware({
											...store.resinHardware,
											fepCost: val,
										}),
									)
								}
								type="number"
								prefix={currencySymbol}
								tooltip={t('tooltip.fepCost')}
							/>
							<InputGroup
								label={t("calc.fepLife")}
								value={store.resinHardware.fepLifespanPrints}
								onChange={(v) =>
									handleInput(v, (val) =>
										store.setResinHardware({
											...store.resinHardware,
											fepLifespanPrints: val,
										}),
									)
								}
								type="number"
								unit="prints"
								tooltip={t('tooltip.fepLife')}
							/>
						</div>
					</div>
				</>
			)}
		</div>
	);
}
