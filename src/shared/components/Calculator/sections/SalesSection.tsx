import { DollarSign } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallback } from "react";
import { InputGroup } from "@/shared/components/ui/InputGroup";
import { Select } from "@/shared/components/ui/Select";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useCurrency } from "@/shared/hooks/useCurrency";
import { SectionHeader } from "./SectionHeader";
import { INTERMEDIATE_FIELDS, BASIC_FIELDS } from "../Calculator.constants";

const MARKUP_PRESETS = [100, 150, 200, 250, 300, 500];

export function SalesSection() {
	const { t } = useTranslation();
	const store = useCalculatorStore();
	const catalogMarketplaces = useCatalogStore((s) => s.marketplaces);
	const { symbol: currencySymbol } = useCurrency();
	const isFDM = store.activeTab === "fdm";

	const handleInput = (value: string, setter: (v: number) => void) => {
		setter(value === "" ? 0 : parseFloat(value) || 0);
	};

	const isFieldVisible = useCallback(
		(sectionId: string, fieldId: string) => {
			const level = store.calcLevel;
			const sectionFields = INTERMEDIATE_FIELDS[sectionId] ?? [];
			const basicFields = BASIC_FIELDS[sectionId] ?? [];

			if (level === "basic") return basicFields.includes(fieldId);
			if (level === "intermediate") {
				return (basicFields.includes(fieldId) || sectionFields.includes(fieldId))
					&& !store.hiddenFields.includes(`${sectionId}.${fieldId}`);
			}
			return !store.hiddenFields.includes(`${sectionId}.${fieldId}`);
		},
		[store.calcLevel, store.hiddenFields],
	);

	const handleMarketplaceChange = (id: string) => {
		const mp = catalogMarketplaces.find((m) => m.id === id);
		if (mp) {
			store.setSelectedMarketplace(
				mp as Parameters<typeof store.setSelectedMarketplace>[0],
			);
			store.setFdmSales({
				...store.fdmSales,
				marketplaceFeePercent: mp.feePercent,
			});
		}
	};

	return (
		<div className="surface rounded-xl p-4 sm:p-5">
			<SectionHeader
				Icon={DollarSign}
				title={t("calc.sales")}
				subtitle={t("calc.sectionDesc.sales")}
				sectionId="sales"
			/>
			<div className="space-y-4">
				<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
					<InputGroup
						label={t("calc.quantity")}
						value={store.quantity}
						onChange={(v) =>
							handleInput(v, (val) => store.setQuantity(val > 0 ? val : 1))
						}
						type="number"
						unit="un"
						tooltip={t('tooltip.quantity')}
					/>
					{isFieldVisible("sales", "infillPercent") && (
						<InputGroup
							label={t("calc.infillPercent")}
							value={store.infillPercent}
							onChange={(v) =>
								handleInput(v, (val) => store.setInfillPercent(val))
							}
							type="number"
							unit="%"
							tooltip={t('tooltip.infillPercent')}
						/>
					)}
				</div>
				{isFieldVisible("sales", "extrasCost") && (
					<InputGroup
						label={t("calc.extras")}
						value={
							isFDM
								? store.fdmExtras.extrasCost
								: store.resinExtras.extrasCost
						}
						onChange={(v) =>
							handleInput(v, (val) =>
								isFDM
									? store.setFdmExtras({ extrasCost: val })
									: store.setResinExtras({ extrasCost: val }),
							)
						}
						type="number"
						prefix={currencySymbol}
						tooltip={t("tooltip.extras")}
					/>
				)}
				<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
					<InputGroup
						label={t("calc.packaging")}
						value={
							isFDM
								? store.fdmSales.packagingCost
								: store.resinSales.packagingCost
						}
						onChange={(v) =>
							handleInput(v, (val) =>
								isFDM
									? store.setFdmSales({
											...store.fdmSales,
											packagingCost: val,
										})
									: store.setResinSales({
											...store.resinSales,
											packagingCost: val,
										}),
							)
						}
						type="number"
						prefix={currencySymbol}
						tooltip={t('tooltip.packaging')}
					/>
					{isFieldVisible("sales", "shippingCost") && (
						<InputGroup
							label={t("calc.shipping")}
							value={
								isFDM
									? store.fdmSales.shippingCost
									: store.resinSales.shippingCost
							}
							onChange={(v) =>
								handleInput(v, (val) =>
									isFDM
										? store.setFdmSales({
												...store.fdmSales,
												shippingCost: val,
											})
										: store.setResinSales({
												...store.resinSales,
												shippingCost: val,
											}),
								)
							}
							type="number"
							prefix={currencySymbol}
							tooltip={t('tooltip.shipping')}
						/>
					)}
				</div>
				{isFieldVisible("sales", "marketplace") && (
					<>
						<div className="grid grid-cols-1 @form:grid-cols-2 gap-3">
							<Select
								label={t("calc.marketplace")}
								value={store.selectedMarketplace.id}
								onChange={handleMarketplaceChange}
								options={catalogMarketplaces.map((m) => ({
									label: m.name,
									value: m.id,
									subtitle: `${m.feePercent}% + R$ ${m.feeFixed}`,
								}))}
							/>
							<InputGroup
								label={t("calc.taxPercent")}
								value={
									isFDM
										? store.fdmSales.taxPercent
										: store.resinSales.taxPercent
								}
								onChange={(v) =>
									handleInput(v, (val) =>
										isFDM
											? store.setFdmSales({
													...store.fdmSales,
													taxPercent: val,
												})
											: store.setResinSales({
													...store.resinSales,
													taxPercent: val,
												}),
									)
								}
								type="number"
								unit="%"
								tooltip={t('tooltip.taxPercent')}
							/>
						</div>
						<div className="surface rounded-xl p-4 sm:p-5">
							<div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between mb-2">
							<span className="text-xs sm:text-sm text-[var(--color-text-secondary)]">
								{t("calc.markupPresets")}
							</span>
								<div className="flex flex-wrap gap-1.5">
									{MARKUP_PRESETS.map((pct) => (
										<button
											key={pct}
											onClick={() =>
												isFDM
													? store.setFdmSales({
															...store.fdmSales,
															profitMarginPercent: pct,
														})
													: store.setResinSales({
															...store.resinSales,
															profitMarginPercent: pct,
														})
											}
											className={`px-3 min-h-[44px] text-[11px] sm:text-xs rounded-md transition-all flex items-center ${
												(
													isFDM
														? store.fdmSales.profitMarginPercent
														: store.resinSales.profitMarginPercent
										) === pct
												? "bg-[var(--color-accent)] text-[var(--color-text-primary)]"
												: "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
											}`}
										>
											{pct}%
										</button>
									))}
								</div>
							</div>
						</div>
					</>
				)}
				<div className="surface rounded-xl p-4 sm:p-5">
					<InputGroup
						label={t("calc.profitMargin")}
						value={
							isFDM
								? store.fdmSales.profitMarginPercent
								: store.resinSales.profitMarginPercent
						}
						onChange={(v) =>
							handleInput(v, (val) =>
								isFDM
									? store.setFdmSales({
											...store.fdmSales,
											profitMarginPercent: val,
										})
									: store.setResinSales({
											...store.resinSales,
											profitMarginPercent: val,
										}),
							)
						}
						type="number"
						unit="%"
						tooltip={t('tooltip.profitMargin')}
					/>
				</div>
			</div>
		</div>
	);
}
