import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { ToggleSwitch } from "@/shared/components/ui/ToggleCard";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { SectionHeader } from "./SectionHeader";

export function OpsSection() {
	const { t } = useTranslation();
	const store = useCalculatorStore();
	const { symbol: currencySymbol } = useCurrency();
	const isFDM = store.activeTab === "fdm";

	const handleInput = (value: string, setter: (v: number) => void) => {
		setter(value === "" ? 0 : parseFloat(value) || 0);
	};

	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			<SectionHeader
				Icon={ShieldCheck}
				title={t("calc.opsSoftware")}
				subtitle={t("calc.sectionDesc.ops")}
				sectionId="ops"
			/>
			<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
				<div>
				<div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
					<span className="text-xs font-semibold text-[var(--color-text-secondary)]">
						{t("calc.ppe")}
					</span>
						<ToggleSwitch
							enabled={isFDM ? store.fdmOps.enabled : store.resinOps.enabled}
							onToggle={(v) =>
								isFDM
									? store.setFdmOps({ ...store.fdmOps, enabled: v })
									: store.setResinOps({ ...store.resinOps, enabled: v })
							}
						/>
					</div>
					{(isFDM ? store.fdmOps.enabled : store.resinOps.enabled) && (
						<InputGroup
							label={t("calc.ppeCost")}
							value={
								isFDM
									? store.fdmOps.ppeCostPerPrint
									: store.resinOps.ppeCostPerPrint
							}
							onChange={(v) =>
								handleInput(v, (val) =>
									isFDM
										? store.setFdmOps({
												...store.fdmOps,
												ppeCostPerPrint: val,
											})
										: store.setResinOps({
												...store.resinOps,
												ppeCostPerPrint: val,
											}),
								)
							}
							type="number"
							prefix={currencySymbol}
							tooltip={t('tooltip.ppe')}
						/>
					)}
				</div>
				<div>
				<div className="flex items-center justify-between border-b border-[var(--color-border)] pb-2 mb-3">
					<span className="text-xs font-semibold text-[var(--color-text-secondary)]">
						{t("calc.software")}
					</span>
						<ToggleSwitch
							enabled={
								isFDM ? store.fdmSoft.enabled : store.resinSoft.enabled
							}
							onToggle={(v) =>
								isFDM
									? store.setFdmSoft({ ...store.fdmSoft, enabled: v })
									: store.setResinSoft({ ...store.resinSoft, enabled: v })
							}
						/>
					</div>
					{(isFDM ? store.fdmSoft.enabled : store.resinSoft.enabled) && (
						<div className="space-y-3">
							<InputGroup
								label={t("calc.slicerCost")}
								value={
									isFDM
										? store.fdmSoft.slicerMonthlyCost
										: store.resinSoft.slicerMonthlyCost
								}
								onChange={(v) =>
									handleInput(v, (val) =>
										isFDM
											? store.setFdmSoft({
													...store.fdmSoft,
													slicerMonthlyCost: val,
												})
											: store.setResinSoft({
													...store.resinSoft,
													slicerMonthlyCost: val,
												}),
									)
								}
								type="number"
								prefix={currencySymbol}
								tooltip={t('tooltip.slicerCost')}
							/>
							<InputGroup
								label={t("calc.modelCost")}
								value={
									isFDM
										? store.fdmSoft.modelFileCost
										: store.resinSoft.modelFileCost
								}
								onChange={(v) =>
									handleInput(v, (val) =>
										isFDM
											? store.setFdmSoft({
													...store.fdmSoft,
													modelFileCost: val,
												})
											: store.setResinSoft({
													...store.resinSoft,
													modelFileCost: val,
												}),
									)
								}
								type="number"
								prefix={currencySymbol}
								tooltip={t('tooltip.modelCost')}
							/>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
