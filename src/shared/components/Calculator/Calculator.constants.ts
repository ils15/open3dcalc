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
  basic: ["material", "print", "sales", "results"],
  intermediate: ["material", "print", "failure", "sales", "results"],
  advanced: [
    "material",
    "print",
    "failure",
    "hardware",
    "machine",
    "fixedCost",
    "labor",
    "ops",
    "sales",
    "results",
  ],
};

/**
 * Sections that are OUTPUT, not input steps.
 *
 * `results` renders the ResultsPanel: at 2xl it lives in the right rail and is
 * `2xl:hidden` inside the form column, and below 2xl it is an output panel the
 * SectionRenderer sort promotes to the top. It is never a step the user fills
 * in, so it is never numbered. Numbering it would also push every real step up
 * by one and make the count disagree with the rail.
 */
export const OUTPUT_SECTION_IDS: readonly string[] = ["results"];

/**
 * 1-based step number per input section, numbered over the VISIBLE set.
 *
 * Numbering follows what the level actually shows, so at "Rápido" the sections
 * are 1, 2, 3 rather than 1, 4, 7 of the full ten. The number is the section's
 * position in the visible list, which SECTION_ENABLES never changes: disabling
 * a section dims it in place and renumbers nothing.
 *
 * SectionNav and SectionRenderer both read this, so the rail and the headings
 * cannot disagree about what step a section is.
 */
export function sectionStepNumbers(calcLevel: CalcLevel): Map<string, number> {
  const steps = new Map<string, number>();
  let step = 0;
  for (const section of SECTIONS) {
    if (!LEVEL_SECTIONS[calcLevel].includes(section.id)) continue;
    if (OUTPUT_SECTION_IDS.includes(section.id)) continue;
    step += 1;
    steps.set(section.id, step);
  }
  return steps;
}

export const INTERMEDIATE_FIELDS: Record<string, string[]> = {
  material: ["purgeWeight", "spoolEfficiency", "density", "wasteMargin"],
  print: ["selectedPrinter"],
  failure: [],
  sales: [
    "infillPercent",
    "extrasCost",
    "shippingCost",
    "marketplace",
    "taxPercent",
    "markupPresets",
  ],
};

export const BASIC_FIELDS: Record<string, string[]> = {
  material: ["type", "costPerKg", "weightUsed", "costPerLiter", "volumeUsedMl"],
  print: ["printTimeHours", "printerPowerWatts", "energyCostPerKwh"],
  failure: ["failureMode", "failureValue", "riskMultiplier"],
  sales: ["quantity", "packagingCost", "profitMarginPercent"],
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
  purgeWeight: "calc.purge",
  spoolEfficiency: "calc.spoolEfficiency",
  density: "calc.density",
  wasteMargin: "calc.wasteMargin",
  selectedPrinter: "calc.printer",
  infillPercent: "calc.infillPercent",
  extrasCost: "calc.extras",
  shippingCost: "calc.shipping",
  marketplace: "calc.marketplace",
  taxPercent: "calc.taxPercent",
  markupPresets: "calc.markupPresets",
};

export const LEVEL_LABELS: Record<
  CalcLevel,
  "calc.quick" | "calc.detailed" | "calc.complete"
> = {
  basic: "calc.quick",
  intermediate: "calc.detailed",
  advanced: "calc.complete",
};

export const LEVEL_DESCRIPTIONS: Record<
  CalcLevel,
  "calc.quickDesc" | "calc.detailedDesc" | "calc.completeDesc"
> = {
  basic: "calc.quickDesc",
  intermediate: "calc.detailedDesc",
  advanced: "calc.completeDesc",
};
