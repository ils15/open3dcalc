import type { LucideIcon } from "lucide-react";
import {
	AlertTriangle,
	BarChart3,
	DollarSign,
	HardHat,
	Layers,
	Printer,
	Receipt,
	ShieldCheck,
	SlidersHorizontal,
	Wrench,
} from "lucide-react";
import type { CalcLevel } from "@/shared/stores/calculatorStore";

export interface SectionConfig {
	id: string;
	Icon: LucideIcon;
	label: string;
	shortKey: string;
}

export const SECTIONS: SectionConfig[] = [
	{
		id: "material",
		Icon: Layers,
		label: "calc.material",
		shortKey: "calc.sectionShort.material",
	},
	{
		id: "print",
		Icon: SlidersHorizontal,
		label: "calc.printParams",
		shortKey: "calc.sectionShort.print",
	},
	{
		id: "failure",
		Icon: AlertTriangle,
		label: "calc.failure.title",
		shortKey: "calc.sectionShort.failure",
	},
	{
		id: "hardware",
		Icon: Wrench,
		label: "calc.fdmHardware",
		shortKey: "calc.sectionShort.hardware",
	},
	{
		id: "machine",
		Icon: Printer,
		label: "calc.machine",
		shortKey: "calc.sectionShort.machine",
	},
	{
		id: "fixedCost",
		Icon: Receipt,
		label: "calc.fixedCost.title",
		shortKey: "calc.sectionShort.fixedCost",
	},
	{
		id: "labor",
		Icon: HardHat,
		label: "calc.labor",
		shortKey: "calc.sectionShort.labor",
	},
	{
		id: "ops",
		Icon: ShieldCheck,
		label: "calc.opsSoftware",
		shortKey: "calc.sectionShort.ops",
	},
	{
		id: "sales",
		Icon: DollarSign,
		label: "calc.sales",
		shortKey: "calc.sectionShort.sales",
	},
	{
		id: "results",
		Icon: BarChart3,
		label: "calc.results",
		shortKey: "calc.sectionShort.results",
	},
];

export const SECTION_ENABLES: Record<string, string[]> = {
	material: ["material"],
	print: ["energy"],
	failure: ["failure"],
	hardware: ["hardware", "postProcessing"],
	machine: ["machine"],
	fixedCost: [],
	labor: ["labor"],
	ops: ["software", "consumables"],
	sales: ["packaging", "shipping", "extras"],
	results: [],
};

export const LEVEL_SECTIONS: Record<CalcLevel, string[]> = {
	basic: ['material', 'print', 'sales', 'results'],
	intermediate: ['material', 'print', 'failure', 'sales', 'results'],
	advanced: ['material', 'print', 'failure', 'hardware', 'machine', 'fixedCost', 'labor', 'ops', 'sales', 'results'],
};

export const INTERMEDIATE_FIELDS: Record<string, string[]> = {
	material: ['purgeWeight', 'spoolEfficiency', 'density', 'wasteMargin'],
	print: ['selectedPrinter'],
	failure: [],
	sales: ['infillPercent', 'extrasCost', 'shippingCost', 'marketplace', 'taxPercent', 'markupPresets'],
};

export const BASIC_FIELDS: Record<string, string[]> = {
	material: ['type', 'costPerKg', 'weightUsed', 'costPerLiter', 'volumeUsedMl'],
	print: ['printTimeHours', 'printerPowerWatts', 'energyCostPerKwh'],
	failure: ['failureMode', 'failureValue', 'riskMultiplier'],
	sales: ['quantity', 'packagingCost', 'profitMarginPercent'],
};

/**
 * Shared visibility contract for the Classic and Bento surfaces.
 * Basic fields are always present; intermediate fields honor the user's
 * field-level disclosures; advanced mode exposes the complete field set.
 */
export function isFieldVisibleForLevel(
	calcLevel: CalcLevel,
	hiddenFields: readonly string[],
	sectionId: string,
	fieldId: string,
): boolean {
	const sectionFields = INTERMEDIATE_FIELDS[sectionId] ?? [];
	const basicFields = BASIC_FIELDS[sectionId] ?? [];

	if (calcLevel === "basic") return basicFields.includes(fieldId);
	if (calcLevel === "intermediate") {
		return (
			(basicFields.includes(fieldId) || sectionFields.includes(fieldId)) &&
			!hiddenFields.includes(`${sectionId}.${fieldId}`)
		);
	}
	return !hiddenFields.includes(`${sectionId}.${fieldId}`);
}

export const FIELD_LABELS: Record<string, string> = {
	purgeWeight: 'calc.purge',
	spoolEfficiency: 'calc.spoolEfficiency',
	density: 'calc.density',
	wasteMargin: 'calc.wasteMargin',
	selectedPrinter: 'calc.printer',
	infillPercent: 'calc.infillPercent',
	extrasCost: 'calc.extras',
	shippingCost: 'calc.shipping',
	marketplace: 'calc.marketplace',
	taxPercent: 'calc.taxPercent',
	markupPresets: 'calc.markupPresets',
};

export const LEVEL_LABELS: Record<CalcLevel, 'calc.quick' | 'calc.detailed' | 'calc.complete'> = {
	basic: 'calc.quick',
	intermediate: 'calc.detailed',
	advanced: 'calc.complete',
};

export const LEVEL_DESCRIPTIONS: Record<CalcLevel, 'calc.quickDesc' | 'calc.detailedDesc' | 'calc.completeDesc'> = {
	basic: 'calc.quickDesc',
	intermediate: 'calc.detailedDesc',
	advanced: 'calc.completeDesc',
};
