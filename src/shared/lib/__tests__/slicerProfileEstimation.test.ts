import { describe, it, expect } from "vitest";

import {
  estimateMaterialVolumeCm3,
  estimateWeight,
  VOLUME_DEFAULTS,
} from "../stlParser";
import { estimatePrintTime, DEFAULT_SETTINGS } from "../printTimeEstimator";
import { DEFAULT_FDM_SLICER_PROFILE } from "@/shared/stores/calculatorStore.defaults";
import type { FdmSlicerProfile } from "@/shared/stores/calculatorStore.types";

/**
 * Fixtures de cubo (mesma geometria dos testes de casca do stlParser.test.ts):
 * volume = lado³/1000 cm³, área = 6 × lado² mm².
 */
function cube(ladoMm: number) {
  return {
    volumeCm3: ladoMm ** 3 / 1000,
    surfaceAreaMm2: 6 * ladoMm ** 2,
    dimensions: { x: ladoMm, y: ladoMm, z: ladoMm },
  };
}

/** Opções de volume que a store passa ao estimador a partir do perfil. */
function profileToVolumeOptions(profile: FdmSlicerProfile) {
  return {
    wallCount: profile.wallCount,
    lineWidthMm: profile.lineWidthMm,
    topLayers: profile.topLayers,
    bottomLayers: profile.bottomLayers,
    layerHeightMm: profile.layerHeightMm,
  };
}

describe("estimadores × fdmSlicerProfile — backward compat (D-EA1)", () => {
  it("perfil default produz saída idêntica a não passar perfil (cubo 10 mm)", () => {
    const mesh = cube(10);
    const withProfile = estimateMaterialVolumeCm3(mesh.volumeCm3, {
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      ...profileToVolumeOptions(DEFAULT_FDM_SLICER_PROFILE),
    });
    const legacy = estimateMaterialVolumeCm3(mesh.volumeCm3, {
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
    });
    // Byte-identical — o perfil default tem que ser os VOLUME_DEFAULTS.
    expect(withProfile).toBe(legacy);
    // ... e tem que bater com o caminho sem options nenhuma (só o infill).
    expect(withProfile).toBe(
      estimateMaterialVolumeCm3(mesh.volumeCm3, {
        surfaceAreaMm2: mesh.surfaceAreaMm2,
        ...VOLUME_DEFAULTS,
      }),
    );
  });

  it("perfil default produz peso idêntico ao legado (cubo 100 mm)", () => {
    const mesh = cube(100);
    const weightWithProfile = estimateWeight(mesh.volumeCm3, {
      densityGcm3: 1.24,
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      purgePercent: 10,
      ...profileToVolumeOptions(DEFAULT_FDM_SLICER_PROFILE),
    });
    const weightLegacy = estimateWeight(mesh.volumeCm3, {
      densityGcm3: 1.24,
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      purgePercent: 10,
    });
    expect(weightWithProfile).toBe(weightLegacy);
  });

  it("perfil default produz tempo idêntico ao legado (cubo 100 mm)", () => {
    const mesh = cube(100);
    const materialVolumeCm3 = estimateMaterialVolumeCm3(mesh.volumeCm3, {
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
    });

    const timeWithProfile = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3,
      dimensions: mesh.dimensions,
      layerHeightMm: DEFAULT_FDM_SLICER_PROFILE.layerHeightMm,
      printSpeedMmPerS: DEFAULT_FDM_SLICER_PROFILE.printSpeedMmPerS,
      material: "pla",
    });
    const timeLegacy = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3,
      dimensions: mesh.dimensions,
      material: "pla",
    });

    expect(timeWithProfile.estimatedMinutes).toBe(timeLegacy.estimatedMinutes);
    expect(timeWithProfile.estimatedHours).toBe(timeLegacy.estimatedHours);
    expect(DEFAULT_FDM_SLICER_PROFILE.layerHeightMm).toBe(
      DEFAULT_SETTINGS.layerHeightMm,
    );
  });
});

describe("estimadores × fdmSlicerProfile — perfil real muda a estimativa (D-EA1)", () => {
  const thickFastProfile: FdmSlicerProfile = {
    wallCount: 4,
    lineWidthMm: 0.42,
    topLayers: 4,
    bottomLayers: 4,
    layerHeightMm: 0.16,
    printSpeedMmPerS: 100,
  };

  it("4 paredes + camada 0,16 mm muda o volume estimado nos dois cubos", () => {
    for (const ladoMm of [10, 100]) {
      const mesh = cube(ladoMm);

      const def = estimateMaterialVolumeCm3(mesh.volumeCm3, {
        infillPercent: 20,
        surfaceAreaMm2: mesh.surfaceAreaMm2,
        ...profileToVolumeOptions(DEFAULT_FDM_SLICER_PROFILE),
      });
      const custom = estimateMaterialVolumeCm3(mesh.volumeCm3, {
        infillPercent: 20,
        surfaceAreaMm2: mesh.surfaceAreaMm2,
        ...profileToVolumeOptions(thickFastProfile),
      });

      expect(custom).not.toBe(def);
      // Mais parede → mais casca → mais plástico (viés seguro p/ cima).
      expect(custom).toBeGreaterThan(def);
      // A casca nunca supera o próprio volume da peça (saturação).
      expect(custom).toBeLessThanOrEqual(mesh.volumeCm3);
      expect(Number.isFinite(custom)).toBe(true);
    }
  });

  it("4 paredes + camada 0,16 mm muda o peso estimado", () => {
    const mesh = cube(100);
    const def = estimateWeight(mesh.volumeCm3, {
      densityGcm3: 1.24,
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      purgePercent: 10,
      ...profileToVolumeOptions(DEFAULT_FDM_SLICER_PROFILE),
    });
    const custom = estimateWeight(mesh.volumeCm3, {
      densityGcm3: 1.24,
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      purgePercent: 10,
      ...profileToVolumeOptions(thickFastProfile),
    });

    expect(custom).not.toBe(def);
    expect(custom).toBeGreaterThan(def);
  });

  it("100 mm/s encurta o tempo estimado vs 60 mm/s default", () => {
    const mesh = cube(100);
    const materialVolumeCm3 = estimateMaterialVolumeCm3(mesh.volumeCm3, {
      infillPercent: 20,
      surfaceAreaMm2: mesh.surfaceAreaMm2,
      ...profileToVolumeOptions(thickFastProfile),
    });

    const def = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3,
      dimensions: mesh.dimensions,
      layerHeightMm: DEFAULT_FDM_SLICER_PROFILE.layerHeightMm,
      printSpeedMmPerS: DEFAULT_FDM_SLICER_PROFILE.printSpeedMmPerS,
    });
    const fast = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3,
      dimensions: mesh.dimensions,
      layerHeightMm: thickFastProfile.layerHeightMm,
      printSpeedMmPerS: thickFastProfile.printSpeedMmPerS,
    });

    expect(fast.estimatedMinutes).not.toBe(def.estimatedMinutes);
    expect(fast.estimatedMinutes).toBeLessThan(def.estimatedMinutes);
  });

  it("camada mais fina aumenta a contagem de camadas", () => {
    const mesh = cube(10);
    const thick = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3: mesh.volumeCm3 * 0.4,
      dimensions: mesh.dimensions,
      layerHeightMm: 0.2,
      printSpeedMmPerS: 60,
    });
    const thin = estimatePrintTime({
      volumeCm3: mesh.volumeCm3,
      materialVolumeCm3: mesh.volumeCm3 * 0.4,
      dimensions: mesh.dimensions,
      layerHeightMm: 0.08,
      printSpeedMmPerS: 60,
    });
    expect(thin.layers).toBeGreaterThan(thick.layers);
  });
});
