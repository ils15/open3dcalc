import { describe, it, expect } from "vitest";
import {
  estimatePrintTime,
  estimatePrintTimeFromDimensions,
} from "@/shared/lib/printTimeEstimator";

const DIMS = { x: 200, y: 200, z: 20 };

describe("estimatePrintTime", () => {
  it("uses default settings when no real settings are provided", () => {
    const result = estimatePrintTime({ volumeCm3: 100, dimensions: DIMS });

    // 20mm height / 0.2mm layer height = 100 layers
    expect(result.layers).toBe(100);
    // ~962s of print+travel+layer-change time → 16 minutes
    expect(result.estimatedMinutes).toBe(16);
    expect(result.estimatedHours).toBe(0.3);
    expect(result.confidence).toBe("medium");
  });

  it("returns high confidence when real printer settings are provided", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeight: 0.2,
      speed: 60,
      infillPercent: 20,
      wallCount: 3,
      printerPowerWatts: 350,
    });

    expect(result.confidence).toBe("high");
  });

  it("returns high confidence when only some real settings are provided", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      printerPowerWatts: 350,
    });

    expect(result.confidence).toBe("high");
  });

  it("returns low confidence when geometry is invalid", () => {
    const result = estimatePrintTime({ volumeCm3: 0, dimensions: DIMS });

    expect(result.confidence).toBe("low");
  });

  it("increases estimated time when print speed is slower", () => {
    const fast = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      speed: 60,
    });
    const slow = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      speed: 30,
    });

    expect(slow.estimatedMinutes).toBeGreaterThan(fast.estimatedMinutes);
  });

  it("increases layer count and time when layer height is smaller", () => {
    const coarse = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeight: 0.2,
    });
    const fine = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      layerHeight: 0.1,
    });

    expect(fine.layers).toBe(coarse.layers * 2);
    expect(fine.estimatedMinutes).toBeGreaterThan(coarse.estimatedMinutes);
  });

  it("keeps defaults for unspecified settings", () => {
    const result = estimatePrintTime({
      volumeCm3: 100,
      dimensions: DIMS,
      speed: 120,
    });

    // Same as default-case estimate but with double speed → fewer minutes
    expect(result.confidence).toBe("high");
    expect(result.layers).toBe(100);
  });
});

describe("estimatePrintTimeFromDimensions", () => {
  it("estimates volume from bounding box and forwards settings", () => {
    const result = estimatePrintTimeFromDimensions(100, 100, 10, { speed: 30 });

    // 100*100*10*0.4/1000 = 40 cm³ → valid geometry
    expect(result.confidence).toBe("high");
    expect(result.estimatedMinutes).toBeGreaterThan(0);
  });

  it("returns medium confidence without real settings", () => {
    const result = estimatePrintTimeFromDimensions(100, 100, 10);

    expect(result.confidence).toBe("medium");
  });
});
