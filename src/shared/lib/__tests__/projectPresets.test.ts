import { describe, expect, it } from "vitest";

import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import {
  buildProjectPresetSnapshot,
  hasCalculationInProgress,
  projectPresets,
} from "@/shared/lib/projectPresets";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

const getPreset = (id: string) => {
  const preset = projectPresets.find((item) => item.id === id);
  if (!preset) throw new Error(`Missing project preset: ${id}`);
  return preset;
};

describe("project presets — static data and catalog mapping", () => {
  it("exposes exactly the three requested projects", () => {
    expect(projectPresets.map(({ id }) => id)).toEqual([
      "spiral-vase",
      "reinforced-gopro-handlebar",
      "rpg-dragon-statue",
    ]);
  });

  it.each([
    ["spiral-vase", "pla_silk", "fdm", 140, 6.8, 10, 110],
    [
      "reinforced-gopro-handlebar",
      "petg",
      "fdm",
      48,
      2.3,
      5,
      140,
    ],
    [
      "rpg-dragon-statue",
      "standard",
      "resin",
      85,
      4.5,
      15,
      null,
    ],
  ] as const)(
    "%s references real catalog entries and keeps the extracted values",
    (id, materialId, technology, weight, time, failure, margin) => {
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

      if (preset.technology === "fdm") {
        expect(preset.sales?.profitMarginPercent).toBe(margin);
        expect(preset.material.weightUsed).toBe(weight);
      } else {
        expect(preset.sales).toBeUndefined();
        expect(preset.material.weightUsed).toBe(weight);
        if (!("volumeUsedMl" in preset.material)) {
          throw new Error("Resin preset is missing volumeUsedMl");
        }
        expect(preset.material.volumeUsedMl).toBeCloseTo(77.27, 2);
      }
    },
  );

  it("uses PLA Silk, PETG and the closest real resin catalog entry", () => {
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
    expect(support.sales?.profitMarginRange).toEqual({ min: 140, max: 180 });
  });

  it("applies printer-derived values before the preset material so material wins conflicts", () => {
    const store = useCalculatorStore.getState();
    const preset = getPreset("spiral-vase");
    const conflictingState = {
      ...store,
      fdmAmsEnabled: true,
      fdmMaterial: {
        ...store.fdmMaterial,
        type: "PETG",
        weightUsed: 999,
        costPerKg: 999,
      },
      resinPostProcess: { ...store.resinPostProcess, washType: "water" as const },
    };

    const snapshot = buildProjectPresetSnapshot(conflictingState, preset, {
      productName: "VasoEspiral Geométrico",
      catalogMaterials: materials,
      catalogPrinters: printers,
    });

    expect(snapshot.fdmMaterial).toMatchObject(preset.material);
    expect(snapshot.fdmAmsEnabled).toBe(false);
    expect(snapshot.selectedPrinterId).toBe("bambu_p1s");
    expect(snapshot.fdmPrintParams.printerPowerWatts).toBe(350);
    expect(snapshot.fdmMachine.machineCost).toBe(5500);
  });

  it("normalizes a non-water preset back to alcohol washing", () => {
    const store = useCalculatorStore.getState();
    const preset = getPreset("rpg-dragon-statue");
    const snapshot = buildProjectPresetSnapshot(store, preset, {
      productName: "Estatueta Colecionável RPG / Dragão",
      catalogMaterials: materials,
      catalogPrinters: printers,
    });

    expect(snapshot.resinPostProcess.washType).toBe("alcohol");
    expect(snapshot.resinMaterial).toMatchObject(preset.material);
    expect(snapshot.resinPrintParams.printerPowerWatts).toBe(150);
  });

  it("detects whether applying a preset would replace existing work", () => {
    const store = useCalculatorStore.getState();
    expect(hasCalculationInProgress(store)).toBe(false);
    expect(
      hasCalculationInProgress({ ...store, productName: "Cálculo em andamento" }),
    ).toBe(true);
  });

  it("loads the printer and marketplace while clearing an unrelated spool", () => {
    const store = useCalculatorStore.getState();
    store.setSelectedSpoolId("spool-from-another-project");
    const snapshot = buildProjectPresetSnapshot(
      store,
      getPreset("spiral-vase"),
      {
        productName: "Vaso Espiral Geométrico",
        catalogMaterials: materials,
        catalogPrinters: printers,
      },
    );
    const historyLength = useCalculatorStore.getState().history.length;

    store.loadHistoryItem(snapshot);

    const loaded = useCalculatorStore.getState();
    expect(loaded.selectedPrinter.id).toBe("bambu_p1s");
    expect(loaded.selectedMarketplace.id).toBe(snapshot.selectedMarketplaceId);
    expect(loaded.selectedSpoolId).toBeNull();
    expect(loaded.history).toHaveLength(historyLength + 1);
  });
});
