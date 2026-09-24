import { beforeEach, describe, expect, it, vi } from "vitest";

import { calculateFDM, calculateResin } from "@/shared/lib/calculator";
import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import {
  buildProjectPresetDraft,
  createProjectPresetApplicationPatch,
  previewProjectPreset,
  projectPresets,
  type PresetDraftV1,
  validatePresetDraft,
} from "@/shared/lib/projectPresets";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useHistoryStore } from "@/shared/stores/historyStore";
import { useQuoteStore } from "@/shared/stores/quoteStore";

const resetCatalog = () => {
  useCatalogStore.setState({
    printers: printers.map((printer) => ({ ...printer })),
    materials: materials.map((material) => ({ ...material })),
  });
};

const resetCalculator = () => {
  useCalculatorStore.getState().resetCalculator();
  const state = useCalculatorStore.getState();
  useCalculatorStore.setState({
    activeTab: "resin",
    productName: "Existing project",
    selectedSpoolId: "spool-existing",
    lastDeductedInfo: { spoolId: "spool-existing", weight: 12 },
    history: [],
    fdmMaterial: {
      ...state.fdmMaterial,
      purgeWeight: 99,
      spoolEfficiency: 77,
      costPerKg: 999,
    },
    fdmPrintParams: {
      ...state.fdmPrintParams,
      printerPowerWatts: 999,
      printTimeHours: 99,
      failureMode: "fixed",
      failureValue: 99,
      riskMultiplier: 9,
      heatUpTimeMinutes: 99,
      heatUpPowerPercent: 999,
    },
    resinPrintParams: {
      ...state.resinPrintParams,
      printerPowerWatts: 999,
      printTimeHours: 99,
      failureMode: "fixed",
      failureValue: 99,
      riskMultiplier: 9,
      heatUpTimeMinutes: 99,
      heatUpPowerPercent: 999,
    },
  });
};

const build = (presetIndex = 0, state = useCalculatorStore.getState()) => {
  const preset = projectPresets[presetIndex];
  return buildProjectPresetDraft(state, preset, {
    catalog: useCatalogStore.getState(),
    productName: `${preset.id} project`,
    exampleLabel: "Example",
  });
};

describe("PresetDraftV1 project closure", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetCatalog();
    resetCalculator();
    vi.restoreAllMocks();
  });

  it.each(projectPresets.map((preset, index) => [preset.id, index] as const))(
    "creates a complete validated draft for %s",
    (_id, index) => {
      const preset = projectPresets[index];
      const state = useCalculatorStore.getState();
      const draft = build(index, state);

      expect(draft.schemaVersion).toBe(1);
      expect(draft.presetId).toBe(preset.id);
      expect(draft.technology).toBe(preset.technology);
      expect(draft.printerRef.id).toBe(preset.printerId);
      expect(draft.materialRef.id).toBe(preset.catalogMaterialId);
      expect(draft.printerRef.technology).toBe(preset.technology);
      expect(draft.materialRef.technology).toBe(preset.technology);
      expect(draft.printerRef.fingerprint).toMatch(/^fnv1a-/);
      expect(draft.materialRef.fingerprint).toMatch(/^fnv1a-/);
      expect(draft.printerRef.revision).toBeTruthy();
      expect(draft.materialRef.revision).toBeTruthy();
      expect(draft.printerRef.canonical).toMatchObject({
        id: preset.printerId,
        technology: preset.technology,
      });
      expect(draft.materialRef.canonical).toMatchObject({
        id: preset.catalogMaterialId,
        type: preset.technology,
      });

      expect(draft.reset.activeTab).toBe(preset.technology);
      expect(draft.reset.infillPercent).toBe(20);
      expect(draft.reset.selectedSpoolId).toBeNull();
      expect(draft.reset.fdmAmsEnabled).toBe(false);
      expect(draft.reset.fdmAmsSlots).toHaveLength(4);
      expect(draft.reset.productName).toContain("Example");
      expect(draft.baseline).toEqual({
        riskMultiplier: 1,
        heatUpTimeMinutes: 5,
        heatUpPowerPercent: 150,
        purgeWeight: 0,
        spoolEfficiency: 98,
        wasteMarginPercent: 5,
        infillPercent: 20,
      });

      const activePrint =
        preset.technology === "fdm"
          ? draft.reset.fdmPrintParams
          : draft.reset.resinPrintParams;
      expect(activePrint.printerPowerWatts).toBe(
        draft.printerRef.canonical.power,
      );
      expect(activePrint.printTimeHours).toBe(preset.printParameters.printTimeHours);
      expect(activePrint.failureMode).toBe(preset.printParameters.failureMode);
      expect(activePrint.failureValue).toBe(preset.printParameters.failureValue);
      expect(activePrint.riskMultiplier).toBe(1);
      expect(activePrint.heatUpTimeMinutes).toBe(5);
      expect(activePrint.heatUpPowerPercent).toBe(150);

      if (preset.technology === "fdm") {
        expect(draft.reset.fdmMaterial).toMatchObject({
          type: draft.materialRef.canonical.name,
          purgeWeight: 0,
          spoolEfficiency: 98,
        });
        expect("sales" in preset).toBe(false);
      } else {
        expect(draft.reset.resinMaterial).toMatchObject({
          type: draft.materialRef.canonical.name,
          wasteMarginPercent: 5,
          volumeUsedMl: preset.material.volumeUsedMl,
        });
        expect("sales" in preset).toBe(false);
      }
    },
  );

  it("preserves maker environment and the complete inactive technology branch", () => {
    const state = useCalculatorStore.getState();
    const draft = build(0, state);
    const inactiveBefore = {
      material: state.resinMaterial,
      printParams: state.resinPrintParams,
      postProcess: state.resinPostProcess,
      machine: state.resinMachine,
      hardware: state.resinHardware,
      labor: state.resinLabor,
      extras: state.resinExtras,
      sales: state.resinSales,
      ops: state.resinOps,
      soft: state.resinSoft,
    };

    expect(draft.preserved.selectedMarketplaceId).toBe(
      state.selectedMarketplace.id,
    );
    expect(draft.preserved.quantity).toBe(state.quantity);
    expect(draft.preserved.currency).toBe(state.currency);
    expect(draft.preserved.fixedCosts).toEqual(state.fixedCosts);
    expect(draft.preserved.fdmSales).toEqual(state.fdmSales);
    expect(draft.preserved.inactiveTechnology).toEqual({
      fdm: null,
      resin: inactiveBefore,
    });
  });

  it("round-trips through JSON and rejects unknown or partial drafts", () => {
    const draft = build();
    const roundTrip = JSON.parse(JSON.stringify(draft)) as PresetDraftV1;

    expect(roundTrip).toEqual(draft);
    expect(() => validatePresetDraft(roundTrip, useCatalogStore.getState())).not.toThrow();
    expect(() =>
      validatePresetDraft({ ...roundTrip, schemaVersion: 2 }, useCatalogStore.getState()),
    ).toThrow(/schema/i);
    expect(() => {
      const partial = { ...roundTrip } as Record<string, unknown>;
      delete partial.reset;
      validatePresetDraft(partial, useCatalogStore.getState());
    }).toThrow(/draft|incomplet/i);
    expect(roundTrip).not.toHaveProperty("results");
    expect(roundTrip).not.toHaveProperty("demoSellPriceBRL");
  });

  it("uses the customized catalog instance and records custom provenance", () => {
    const catalog = useCatalogStore.getState();
    const current = catalog.printers.find((item) => item.id === "bambu_p1s");
    expect(current).toBeDefined();
    useCatalogStore.setState({
      printers: catalog.printers.map((item) =>
        item.id === "bambu_p1s"
          ? { ...item, value: 7777, maintenancePerHour: 0.9, custom: true }
          : item,
      ),
    });

    const draft = build();
    expect(draft.printerRef.origin).toBe("custom");
    expect(draft.printerRef.customized).toBe(true);
    expect(draft.printerRef.canonical.value).toBe(7777);
    expect(draft.reset.fdmMachine.machineCost).toBe(7777);
    expect(draft.printerRef.fingerprint).not.toBe(
      buildProjectPresetDraft(
        useCalculatorStore.getState(),
        projectPresets[0],
        {
          catalog: {
            ...catalog,
            printers: catalog.printers.map((item) =>
              item.id === "bambu_p1s" ? { ...item } : item,
            ),
          } as typeof catalog,
          productName: "Example",
          exampleLabel: "Example",
        },
      ).printerRef.fingerprint,
    );
  });

  it("aborts before any calculator mutation when provenance or catalog is invalid", () => {
    const draft = build();
    const before = useCalculatorStore.getState();
    const historyLength = before.history.length;
    const catalog = useCatalogStore.getState();
    useCatalogStore.setState({
      printers: catalog.printers.filter((item) => item.id !== "bambu_p1s"),
    });

    expect(() =>
      useCalculatorStore.getState().applyProjectPresetDraft(draft),
    ).toThrow(/catalog|printer/i);
    const after = useCalculatorStore.getState();
    expect(after).toBe(before);
    expect(after.history).toHaveLength(historyLength);
    expect(after.productName).toBe(before.productName);
    expect(after.results).toBe(before.results);

    resetCatalog();
    const invalid = {
      ...draft,
      printerRef: { ...draft.printerRef, fingerprint: "tampered" },
    } as PresetDraftV1;
    const beforeShape = useCalculatorStore.getState();
    expect(() =>
      useCalculatorStore.getState().applyProjectPresetDraft(invalid),
    ).toThrow(/provenance|fingerprint|catalog/i);
    expect(useCalculatorStore.getState()).toBe(beforeShape);
  });

  it("applies in one calculator transaction and undo restores the spool", () => {
    const draft = build();
    const before = useCalculatorStore.getState();
    const addEntry = vi.spyOn(useHistoryStore.getState(), "addEntry");
    const addQuote = vi.spyOn(useQuoteStore.getState(), "addQuote");
    const deductWeight = vi.spyOn(useFilamentInventory.getState(), "deductWeight");

    before.applyProjectPresetDraft(draft);
    const applied = useCalculatorStore.getState();
    expect(applied.history).toHaveLength(before.history.length + 1);
    expect(applied.selectedSpoolId).toBeNull();
    expect(applied.lastDeductedInfo).toBeNull();
    expect(applied.productName).toContain("Example");
    expect(applied.results).not.toBe(before.results);
    expect(addEntry).not.toHaveBeenCalled();
    expect(addQuote).not.toHaveBeenCalled();
    expect(deductWeight).not.toHaveBeenCalled();

    applied.undo();
    const undone = useCalculatorStore.getState();
    expect(undone.selectedSpoolId).toBe("spool-existing");
    expect(undone.lastDeductedInfo).toBeNull();
    expect(undone.productName).toBe(before.productName);
    expect(undone.history).toHaveLength(before.history.length);
  });

  it("derives results from calculator.ts formulas for every preset", () => {
    for (const [index] of projectPresets.map((_, index) => [index] as const)) {
      const draft = build(index);
      const preview = previewProjectPreset(
        useCalculatorStore.getState(),
        draft,
        useCatalogStore.getState(),
      );
      const direct =
        draft.technology === "fdm"
          ? calculateFDM(
              draft.reset.fdmMaterial,
              draft.reset.fdmPrintParams,
              draft.reset.fdmMachine,
              draft.preserved.fdmLabor,
              draft.preserved.fdmExtras,
              draft.preserved.fdmSales,
              draft.preserved.fdmOps,
              draft.preserved.fdmSoft,
              draft.reset.fdmHardware,
              draft.reset.fdmFinishing,
            )
          : calculateResin(
              draft.reset.resinMaterial,
              draft.reset.resinPrintParams,
              draft.reset.resinMachine,
              draft.preserved.resinLabor,
              draft.preserved.resinExtras,
              draft.preserved.resinSales,
              draft.preserved.resinOps,
              draft.preserved.resinSoft,
              draft.reset.resinPostProcess,
              draft.reset.resinHardware,
            );
      expect(preview.results.sellPrice).toBe(direct.sellPrice);
      expect(preview.results.actualMargin).toBe(direct.actualMargin);
      expect(preview.results.totalCost).toBe(direct.totalCost);
      expect(preview.results).not.toHaveProperty("demoSellPriceBRL");
    }
  });

  it("does not include a persisted result or history in the application patch", () => {
    const draft = build();
    const patch = createProjectPresetApplicationPatch(
      draft,
      useCatalogStore.getState(),
    );
    expect(patch).not.toHaveProperty("results");
    expect(patch).not.toHaveProperty("history");
    expect(patch.lastDeductedInfo).toBeNull();
  });
});
