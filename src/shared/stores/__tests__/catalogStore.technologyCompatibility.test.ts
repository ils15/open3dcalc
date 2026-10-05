import { beforeEach, describe, expect, it } from "vitest";
import { useCatalogStore } from "@/shared/stores/catalogStore";

const STORAGE_KEY = "open3dcalc_catalog_v1";

describe("catalogStore printer technology compatibility", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("does not enrich saved printer arrays with newly verified seed fields", () => {
    const savedPrinter = {
      id: "creality_k1c",
      name: "Saved K1C",
      brand: "Creality",
      power: 350,
      value: 4200,
      usefulLife: 3500,
      maintenancePerHour: 0.35,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        printers: [savedPrinter],
        materials: [],
        marketplaces: [],
      }),
    );

    useCatalogStore.getState().load();

    const state = useCatalogStore.getState();
    expect(state.printers).toHaveLength(1);
    expect(state.printers[0].id).toBe("creality_k1c");
    expect(state.printers[0].technology).toBeUndefined();
  });
});
