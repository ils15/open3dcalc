import { describe, it, expect, beforeEach } from "vitest";
import { useModelComparison, MAX_COMPARISON_ENTRIES } from "../modelComparison";

// Fase 2 — model comparison store (derived metadata only, no PII).

function entry(fileName: string, weight = 10) {
  return {
    fileName,
    dimensions: { x: 10, y: 10, z: 10 },
    volumeCm3: 1,
    weight,
    printTimeHours: 1,
    triangleCount: 100,
  };
}

beforeEach(() => {
  useModelComparison.getState().clear();
});

describe("modelComparison store (Fase 2)", () => {
  it("adds entries and replaces same-file same-weight entries", () => {
    const { add } = useModelComparison.getState();
    add(entry("a.stl", 10));
    add(entry("a.stl", 10));
    expect(useModelComparison.getState().entries).toHaveLength(1);
    add(entry("b.stl", 20));
    expect(useModelComparison.getState().entries).toHaveLength(2);
  });

  it("caps entries at the maximum, keeping the most recent", () => {
    const { add } = useModelComparison.getState();
    for (let i = 0; i < MAX_COMPARISON_ENTRIES + 2; i++) {
      add(entry(`m${i}.stl`, i));
    }
    const entries = useModelComparison.getState().entries;
    expect(entries).toHaveLength(MAX_COMPARISON_ENTRIES);
    expect(entries[entries.length - 1].fileName).toBe(
      `m${MAX_COMPARISON_ENTRIES + 1}.stl`,
    );
  });

  it("removes by id and clears all", () => {
    const { add } = useModelComparison.getState();
    add(entry("a.stl"));
    const id = useModelComparison.getState().entries[0].id;
    useModelComparison.getState().remove(id);
    expect(useModelComparison.getState().entries).toHaveLength(0);
    add(entry("b.stl"));
    useModelComparison.getState().clear();
    expect(useModelComparison.getState().entries).toHaveLength(0);
  });
});
