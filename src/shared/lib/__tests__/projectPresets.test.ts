import { beforeEach, describe, expect, it } from "vitest";

import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import {
  buildProjectPresetDraft,
  hasCalculationInProgress,
  projectPresets,
  resinWeightToVolume,
} from "@/shared/lib/projectPresets";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";

const getPreset = (id: string) => {
  const preset = projectPresets.find((item) => item.id === id);
  if (!preset) throw new Error(`Missing project preset: ${id}`);
  return preset;
};

const resetCatalog = () => {
  useCatalogStore.setState({
    printers: printers.map((printer) => ({ ...printer })),
    materials: materials.map((material) => ({ ...material })),
  });
};

const resetCalculator = () => {
  useCalculatorStore.getState().resetCalculator();
  useCalculatorStore.setState({ history: [], productName: "" });
};

describe("project presets — static data and catalog mapping", () => {
  beforeEach(() => {
    resetCatalog();
    resetCalculator();
  });

  it("exposes exactly the three requested projects", () => {
    expect(projectPresets.map(({ id }) => id)).toEqual([
      "spiral-vase",
      "reinforced-gopro-handlebar",
      "rpg-dragon-statue",
    ]);
    expect(projectPresets.every((preset) => preset.schemaVersion === 1)).toBe(true);
  });

  it.each([
    ["spiral-vase", "pla_silk", "fdm", 140, 6.8, 10],
    ["reinforced-gopro-handlebar", "petg", "fdm", 48, 2.3, 5],
    ["rpg-dragon-statue", "standard", "resin", 85, 4.5, 15],
  ] as const)(
    "%s references real catalog entries and keeps the extracted values",
    (id, materialId, technology, weight, time, failure) => {
      const preset = getPreset(id);
      expect(preset.catalogMaterialId).toBe(materialId);
      const material = materials.find((item) => item.id === materialId);
      const printer = printers.find((item) => item.id === preset.printerId);

      expect(preset.technology).toBe(technology);
      expect(material).toBeDefined();
      expect(material?.type).toBe(technology);
      expect(printer).toBeDefined();
      expect(printer?.technology).toBe(technology);
      expect(preset.printParameters.printerPowerWatts).toBe(printer?.power);
      expect(preset.printParameters.printTimeHours).toBe(time);
      expect(preset.printParameters.failureMode).toBe("percent");
      expect(preset.printParameters.failureValue).toBe(failure);
      expect(preset.printParameters.riskMultiplier).toBeUndefined();

      if (preset.technology === "fdm") {
        expect(preset.material.weightUsed).toBe(weight);
        expect("sales" in preset).toBe(false);
      } else {
        expect(preset.material.weightUsed).toBe(weight);
        expect("volumeUsedMl" in preset.material).toBe(true);
        expect(preset.material.volumeUsedMl).toBeCloseTo(77.27, 2);
      }
    },
  );

  it("uses the canonical material names and keeps demo prices outside the draft", () => {
    const vase = getPreset("spiral-vase");
    const support = getPreset("reinforced-gopro-handlebar");
    const statue = getPreset("rpg-dragon-statue");

    expect(vase.technology === "fdm" && vase.material.type).toBe("PLA Silk");
    expect(support.technology === "fdm" && support.material.type).toBe("PETG");
    expect(statue.technology === "resin" && statue.material.type).toBe(
      "Resina Standard",
    );
    expect(vase.demoSellPriceBRL).toBe(68.5);
    expect(support.demoSellPriceBRL).toBe(49);
    expect(statue.demoSellPriceBRL).toBe(115);

    const draft = buildProjectPresetDraft(useCalculatorStore.getState(), vase, {
      catalog: useCatalogStore.getState(),
      productName: "Vaso Espiral Geométrico",
      exampleLabel: "Exemplo",
    });
    expect(draft).not.toHaveProperty("demoSellPriceBRL");
    expect(draft.reset.productName).toContain("Exemplo");
  });

  it("derives canonical values from the catalog, not the static preset list", () => {
    const state = useCalculatorStore.getState();
    const catalog = useCatalogStore.getState();
    const customPrinter = catalog.printers.find(
      (item) => item.id === "bambu_p1s",
    );
    expect(customPrinter).toBeDefined();

    useCatalogStore.setState({
      printers: catalog.printers.map((item) =>
        item.id === "bambu_p1s"
          ? { ...item, value: 7777, maintenancePerHour: 0.9, custom: true }
          : item,
      ),
    });
    const draft = buildProjectPresetDraft(
      state,
      getPreset("spiral-vase"),
      {
        catalog: useCatalogStore.getState(),
        productName: "Vaso Espiral Geométrico",
        exampleLabel: "Exemplo",
      },
    );
    expect(draft.printerRef.origin).toBe("custom");
    expect(draft.printerRef.customized).toBe(true);
    expect(draft.reset.fdmMachine.machineCost).toBe(7777);
    expect(draft.printerRef.canonical.value).toBe(7777);
  });

  it("resets AMS, material and process baselines while preserving maker margin", () => {
    const state = useCalculatorStore.getState();
    useCalculatorStore.setState({
      fdmAmsEnabled: true,
      fdmAmsSlots: state.fdmAmsSlots.map((slot, index) => ({
        ...slot,
        enabled: index === 3,
        materialType: "CUSTOM",
      })),
      fdmMaterial: {
        ...state.fdmMaterial,
        type: "CUSTOM",
        weightUsed: 999,
        purgeWeight: 99,
        spoolEfficiency: 77,
      },
      fdmPrintParams: {
        ...state.fdmPrintParams,
        energyCostPerKwh: 0.42,
        failureMode: "fixed",
        failureValue: 99,
        riskMultiplier: 9,
        heatUpTimeMinutes: 99,
        heatUpPowerPercent: 999,
      },
      fdmSales: { ...state.fdmSales, profitMarginPercent: 27 },
    });

    const draft = buildProjectPresetDraft(
      useCalculatorStore.getState(),
      getPreset("spiral-vase"),
      {
        catalog: useCatalogStore.getState(),
        productName: "Vaso Espiral Geométrico",
        exampleLabel: "Exemplo",
      },
    );
    expect(draft.reset.fdmAmsEnabled).toBe(false);
    expect(draft.reset.fdmAmsSlots).toEqual(
      useCalculatorStore.getState().fdmAmsSlots.map((slot, index) => ({
        ...slot,
        enabled: index === 0,
        materialType: "PLA",
      })),
    );
    expect(draft.reset.fdmPrintParams.energyCostPerKwh).toBe(0.42);
    expect(draft.reset.fdmPrintParams.riskMultiplier).toBe(1);
    expect(draft.reset.fdmPrintParams.heatUpTimeMinutes).toBe(5);
    expect(draft.reset.fdmPrintParams.heatUpPowerPercent).toBe(150);
    expect(draft.reset.fdmMaterial.purgeWeight).toBe(0);
    expect(draft.reset.fdmMaterial.spoolEfficiency).toBe(98);
    expect(draft.preserved.fdmSales.profitMarginPercent).toBe(27);
  });

  it("resets the resin process to the canonical alcohol baseline", () => {
    const state = useCalculatorStore.getState();
    useCalculatorStore.setState({
      resinPostProcess: { ...state.resinPostProcess, washType: "water" },
    });
    const draft = buildProjectPresetDraft(
      useCalculatorStore.getState(),
      getPreset("rpg-dragon-statue"),
      {
        catalog: useCatalogStore.getState(),
        productName: "Estatueta Colecionável RPG / Dragão",
        exampleLabel: "Exemplo",
      },
    );
    expect(draft.reset.resinPostProcess.washType).toBe("alcohol");
    expect(draft.reset.resinMaterial.wasteMarginPercent).toBe(5);
    expect(draft.reset.resinPrintParams.energyCostPerKwh).toBe(
      state.resinPrintParams.energyCostPerKwh,
    );
  });

  it("detects whether applying a preset would replace existing work", () => {
    const state = useCalculatorStore.getState();
    expect(hasCalculationInProgress(state)).toBe(false);
    expect(
      hasCalculationInProgress({ ...state, productName: "Cálculo em andamento" }),
    ).toBe(true);
  });

  it("provides the canonical resin volume conversion", () => {
    expect(resinWeightToVolume(85)).toBe(77.27);
  });
});
