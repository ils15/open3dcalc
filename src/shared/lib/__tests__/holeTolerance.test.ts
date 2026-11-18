import { describe, it, expect } from "vitest";
import {
  computeRecommendedHoleDiameter,
  computeVolumetricFlow,
  HEAT_SET_INSERTS,
} from "../holeTolerance";

describe("holeTolerance & Maker Toolbox helpers", () => {
  it("computes CAD hole diameters for clearance, snug, and press-fit across materials", () => {
    const plaLoose = computeRecommendedHoleDiameter(4, "PLA", "clearance_loose");
    expect(plaLoose.cadHoleMm).toBe(4.35);

    const tpuPress = computeRecommendedHoleDiameter(5, "TPU", "press_fit");
    expect(tpuPress.cadHoleMm).toBe(4.9);

    expect(HEAT_SET_INSERTS.find((i) => i.thread === "M3")?.holeDiameterMm).toBe(
      4.0,
    );
  });

  it("computes volumetric flow rate and hotend tier accurately", () => {
    // 0.20mm * 0.42mm * 200mm/s = 16.8 mm³/s -> all_metal
    const res = computeVolumetricFlow(0.2, 0.42, 200);
    expect(res.flowMm3PerSec).toBe(16.8);
    expect(res.tier).toBe("all_metal");

    // 0.24mm * 0.45mm * 300mm/s = 32.4 mm³/s -> ultra_high_flow
    const fast = computeVolumetricFlow(0.24, 0.45, 300);
    expect(fast.flowMm3PerSec).toBe(32.4);
    expect(fast.tier).toBe("ultra_high_flow");
  });
});
