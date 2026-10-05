import { describe, expect, it } from "vitest";
import { printers } from "@/shared/lib/printers";

const verifiedTechnology = {
  creality_k1c: "fdm",
  anycubic_mega_x: "fdm",
  anycubic_vyper: "fdm",
  prusa_xl_2: "fdm",
  prusa_xl_5: "fdm",
  prusa_sl1s: "resin",
  flashforge_adventurer_4: "fdm",
  flashforge_finder_3: "fdm",
  ultimaker_fact_4: "fdm",
  ultimaker_method_x: "fdm",
  ultimaker_method_xl: "fdm",
  artillery_sw_x4_plus: "fdm",
  qidi_i_fast: "fdm",
  sovol_sv01: "fdm",
  ankermake_m5: "fdm",
  ankermake_m5c: "fdm",
  snapmaker_j1: "fdm",
  snapmaker_artisan: "fdm",
  voron_v0: "fdm",
  peopoly_forge: "resin",
} as const;

const unresolvedIds = [
  "creality_cr6_se",
  "anycubic_chiron",
  "voron_switchwire",
  "elegoo_orangestorm_g2",
  "flashforge_guider_3",
  "flashforge_guider_3s",
  "artillery_sidewinder_x4",
  "artillery_hornet",
  "qidi_i3",
  "ankermake_v6",
  "raise3d_rf1000",
  "peopoly_lantech",
];

describe("officially verified built-in printer technology", () => {
  it("assigns only the 20 Bifrost-verified technology values", () => {
    expect(Object.keys(verifiedTechnology)).toHaveLength(20);
    for (const [id, technology] of Object.entries(verifiedTechnology)) {
      expect(printers.find((printer) => printer.id === id)?.technology).toBe(
        technology,
      );
    }
  });

  it("keeps all 12 ambiguous or unresolved profiles explicitly unknown", () => {
    expect(unresolvedIds).toHaveLength(12);
    for (const id of unresolvedIds) {
      expect(
        printers.find((printer) => printer.id === id)?.technology,
      ).toBeUndefined();
    }
    // The separate generic `custom` seed sentinel has never declared a technology.
    expect(
      printers.find((printer) => printer.id === "custom")?.technology,
    ).toBeUndefined();
  });
});
