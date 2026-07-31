import { useCallback } from "react";
import type { LucideIcon } from "lucide-react";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useShallow } from "zustand/react/shallow";
import type { FilamentSpool } from "@/shared/stores/filamentInventory";
import { MaterialSection } from "./sections/MaterialSection";
import { PrintSection } from "./sections/PrintSection";
import { FailureSection } from "./sections/FailureSection";
import { MachineSection } from "./sections/MachineSection";
import { FixedCostsSection } from "./sections/FixedCostsSection";
import { LaborSection } from "./sections/LaborSection";
import { HardwareSection } from "./sections/HardwareSection";
import { OpsSection } from "./sections/OpsSection";
import { SalesSection } from "./sections/SalesSection";
import { ResultsPanel } from "./ResultsPanel";
import { SectionHeader } from "./sections/SectionHeader";
import { SECTIONS, INTERMEDIATE_FIELDS, BASIC_FIELDS, LEVEL_SECTIONS } from "./Calculator.constants";

interface SectionRendererProps {
	t: (key: string) => string;
	currencySymbol: string;
	handleInput: (value: string, setter: (v: number) => void) => void;
	isFDM: boolean;
	showSpoolSelector: boolean;
	setShowSpoolSelector: (show: boolean) => void;
	inventorySpools: FilamentSpool[];
	catalogMaterials: Array<{ name: string; type: string }>;
	catalogPrinters: Array<{ id: string; name: string; power: number; value: number; brand: string; image?: string }>;
	handlePrinterSelect: (id: string) => void;
}

export function SectionRenderer(props: SectionRendererProps) {
	const {
		t,
		currencySymbol,
		handleInput,
		isFDM,
		showSpoolSelector,
		setShowSpoolSelector,
		inventorySpools,
		catalogMaterials,
		catalogPrinters,
		handlePrinterSelect,
	} = props;

	const { calcLevel, hiddenFields } = useCalculatorStore(
		useShallow((s) => ({ calcLevel: s.calcLevel, hiddenFields: s.hiddenFields })),
	);
	const store = useCalculatorStore();

	const isFieldVisible = useCallback(
		(sectionId: string, fieldId: string) => {
			const level = calcLevel;
			const sectionFields = INTERMEDIATE_FIELDS[sectionId] ?? [];
			const basicFields = BASIC_FIELDS[sectionId] ?? [];

			if (level === "basic") return basicFields.includes(fieldId);
			if (level === "intermediate") {
				return (basicFields.includes(fieldId) || sectionFields.includes(fieldId))
					&& !hiddenFields.includes(`${sectionId}.${fieldId}`);
			}
			return !hiddenFields.includes(`${sectionId}.${fieldId}`);
		},
		[calcLevel, hiddenFields],
	);

	const renderSectionHeader = useCallback(
		(Icon: LucideIcon, title: string, subtitle?: string, sectionId?: string) => (
			<SectionHeader Icon={Icon} title={title} subtitle={subtitle} sectionId={sectionId} />
		),
		[],
	);

	const visibleSections = SECTIONS.filter((s) =>
		LEVEL_SECTIONS[calcLevel].includes(s.id),
	);

	return (
		<div className="space-y-4">
			{visibleSections.map((s) => {
				switch (s.id) {
					case "material":
						return (
							<div key="material" id="section-material" data-tutorial="material" className="scroll-mt-24">
								<MaterialSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									isFDM={isFDM}
									store={store}
									isFieldVisible={isFieldVisible}
									showSpoolSelector={showSpoolSelector}
									setShowSpoolSelector={setShowSpoolSelector}
									inventorySpools={inventorySpools}
									catalogMaterials={catalogMaterials}
								/>
							</div>
						);
					case "print":
						return (
							<div key="print" id="section-print" data-tutorial="print" className="scroll-mt-24">
								<PrintSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									isFDM={isFDM}
									store={store}
									isFieldVisible={isFieldVisible}
									handlePrinterSelect={handlePrinterSelect}
									catalogPrinters={catalogPrinters}
								/>
							</div>
						);
					case "failure":
						return (
							<div key="failure" id="section-failure" className="scroll-mt-24">
								<FailureSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									isFDM={isFDM}
									store={store}
								/>
							</div>
						);
					case "hardware":
						return (
							<div key="hardware" id="section-hardware" className="scroll-mt-24">
								<HardwareSection />
							</div>
						);
					case "machine":
						return (
							<div key="machine" id="section-machine" className="scroll-mt-24">
								<MachineSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									isFDM={isFDM}
									store={store}
								/>
							</div>
						);
					case "fixedCost":
						return (
							<div key="fixedCost" id="section-fixedCost" className="scroll-mt-24">
								<FixedCostsSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									store={store}
								/>
							</div>
						);
					case "labor":
						return (
							<div key="labor" id="section-labor" className="scroll-mt-24">
								<LaborSection
									renderSectionHeader={renderSectionHeader}
									t={t}
									currencySymbol={currencySymbol}
									handleInput={handleInput}
									isFDM={isFDM}
									store={store}
								/>
							</div>
						);
					case "ops":
						return (
							<div key="ops" id="section-ops" className="scroll-mt-24">
								<OpsSection />
							</div>
						);
					case "sales":
						return (
							<div key="sales" id="section-sales" data-tutorial="sales" className="scroll-mt-24">
								<SalesSection />
							</div>
						);
					case "results":
						return (
							<div key="results" id="section-results" data-tutorial="results" className="scroll-mt-24 2xl:hidden">
								<ResultsPanel variant="mobile" />
							</div>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}
