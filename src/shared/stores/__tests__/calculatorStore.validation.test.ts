import { describe, expect, it } from "vitest";

import {
  createDefaultComputeInput,
  normalizeCalculationInput,
} from "@/shared/stores/calculatorStore.validation";
import {
  resolveFdmFilament,
  resolveFdmMaterial,
  resolveFdmSlicerProfile,
  resolveLaborCosts,
  resolvePrintParameters,
  resolveResinMaterial,
} from "@/shared/stores/calculatorStore.helpers";
import {
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_MACHINE,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_FDM_PARAMS,
  DEFAULT_FDM_SLICER_PROFILE,
  DEFAULT_LABOR,
  DEFAULT_RESIN_MATERIAL,
  DEFAULT_RESIN_PARAMS,
} from "@/shared/stores/calculatorStore.defaults";

function sourceWith(field: string, value: unknown): Record<string, unknown> {
  const source = { ...createDefaultComputeInput() } as Record<string, unknown>;
  source[field] = value;
  return source;
}

describe("calculator computation boundary", () => {
  it("fills an absent legacy slice with the app default without an issue", () => {
    const source = { ...createDefaultComputeInput() } as Record<string, unknown>;
    delete source.fdmMachine;

    const normalized = normalizeCalculationInput(source);

    expect(normalized.validation).toEqual({ valid: true, issues: [] });
    expect(normalized.input.fdmMachine).toEqual(DEFAULT_FDM_MACHINE);
  });

  it.each([
    ["fdmMachine", "hoursPerMonth", Number.POSITIVE_INFINITY],
    ["resinMachine", "hoursPerMonth", Number.NEGATIVE_INFINITY],
    ["fdmHardware", "nozzleCost", Number.NaN],
    ["resinHardware", "lcdCost", Number.POSITIVE_INFINITY],
    ["resinPostProcess", "curingPowerWatts", Number.NaN],
    ["fdmMaterial", "density", Number.POSITIVE_INFINITY],
    ["resinMaterial", "costPerLiter", Number.NEGATIVE_INFINITY],
    ["fdmPrintParams", "energyCostPerKwh", Number.NaN],
    ["resinPrintParams", "energyCostPerKwh", Number.POSITIVE_INFINITY],
    ["fdmLabor", "hourlyRate", Number.NaN],
    ["resinLabor", "hourlyRate", Number.POSITIVE_INFINITY],
    ["fdmFilament", "purgePercent", Number.NaN],
    ["fdmSlicerProfile", "layerHeightMm", Number.POSITIVE_INFINITY],
    ["fdmSales", "taxPercent", Number.NaN],
    ["fdmOps", "ppeCostPerPrint", Number.NaN],
    ["fixedCosts", "monthlyCost", Number.POSITIVE_INFINITY],
  ])("reports non-finite input at %s.%s", (slice, field, value) => {
    const base = createDefaultComputeInput();
    const source = {
      ...base,
      [slice]: {
        ...(base as unknown as Record<string, Record<string, unknown>>)[slice],
        [field]: value,
      },
    };

    const normalized = normalizeCalculationInput(source);

    expect(normalized.validation.valid).toBe(false);
    expect(normalized.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `${slice}.${field}`,
          reason: "non_finite",
        }),
      ]),
    );
  });

  it("distinguishes a present domain violation from a missing value", () => {
    const source = sourceWith("fdmPrintParams", {
      ...DEFAULT_FDM_PARAMS,
      energyCostPerKwh: -1,
      riskMultiplier: -1,
      failureValue: -1,
    });

    const normalized = normalizeCalculationInput(source);

    expect(normalized.validation.valid).toBe(false);
    expect(normalized.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "fdmPrintParams.energyCostPerKwh", reason: "negative" }),
        expect.objectContaining({ path: "fdmPrintParams.riskMultiplier", reason: "negative" }),
        expect.objectContaining({ path: "fdmPrintParams.failureValue", reason: "negative" }),
      ]),
    );
  });

  it("reports zero denominators while keeping the calculator result finite", () => {
    const base = createDefaultComputeInput();
    const source = {
      ...base,
      fdmMaterial: { ...base.fdmMaterial, spoolEfficiency: 0 },
      fdmMachine: { ...base.fdmMachine, hoursPerMonth: 0 },
      fdmSales: { ...base.fdmSales, taxPercent: -1 },
    };

    const normalized = normalizeCalculationInput(source);

    expect(normalized.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "fdmMaterial.spoolEfficiency", reason: "invalid_denominator" }),
        expect.objectContaining({ path: "fdmMachine.hoursPerMonth", reason: "invalid_denominator" }),
        expect.objectContaining({ path: "fdmSales.taxPercent", reason: "negative" }),
      ]),
    );
  });

  it.each([
    [0, "invalid_denominator"],
    [1.5, "out_of_domain"],
  ])("rejects invalid quantity %s", (quantity, reason) => {
    const base = createDefaultComputeInput();
    const normalized = normalizeCalculationInput({ ...base, quantity });

    expect(normalized.validation.valid).toBe(false);
    expect(normalized.validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "quantity.quantity", reason }),
      ]),
    );
  });

  it("normalizes invalid values to finite values before calculation", () => {
    const base = createDefaultComputeInput();
    const source = {
      ...base,
      fdmPrintParams: { ...base.fdmPrintParams, energyCostPerKwh: Number.NaN },
    };

    const normalized = normalizeCalculationInput(source);
    expect(normalized.input.fdmPrintParams.energyCostPerKwh).toBe(
      DEFAULT_FDM_PARAMS.energyCostPerKwh,
    );
    expect(normalized.validation.issues[0]?.path).toBe("fdmPrintParams.energyCostPerKwh");
  });
});

describe("domain-aware resolvers", () => {
  it("rejects negative print, labor, and material domains", () => {
    expect(
      resolvePrintParameters(
        { ...DEFAULT_FDM_PARAMS, energyCostPerKwh: -1, failureValue: -1, riskMultiplier: -1 },
        DEFAULT_FDM_PARAMS,
      ),
    ).toEqual(DEFAULT_FDM_PARAMS);
    expect(
      resolveLaborCosts({ ...DEFAULT_LABOR, hourlyRate: -1 }, DEFAULT_LABOR),
    ).toEqual(DEFAULT_LABOR);
    expect(
      resolveFdmMaterial(
        { ...DEFAULT_FDM_MATERIAL, density: 0, spoolEfficiency: 0 },
        DEFAULT_FDM_MATERIAL,
      ),
    ).toEqual(DEFAULT_FDM_MATERIAL);
    expect(
      resolveResinMaterial({ ...DEFAULT_RESIN_MATERIAL, density: 0 }, DEFAULT_RESIN_MATERIAL),
    ).toEqual(DEFAULT_RESIN_MATERIAL);
  });

  it("rejects invalid filament and slicer domains", () => {
    expect(
      resolveFdmFilament({ purgePercent: -1, filamentDiameterMm: 0 }),
    ).toEqual(DEFAULT_FDM_FILAMENT);
    expect(
      resolveFdmSlicerProfile({ wallCount: -1, lineWidthMm: 0 }),
    ).toEqual(DEFAULT_FDM_SLICER_PROFILE);
  });

  it("keeps valid resolver values", () => {
    const resin = { ...DEFAULT_RESIN_PARAMS, energyCostPerKwh: 0 };
    expect(resolvePrintParameters(resin, DEFAULT_RESIN_PARAMS).energyCostPerKwh).toBe(0);
  });
});
