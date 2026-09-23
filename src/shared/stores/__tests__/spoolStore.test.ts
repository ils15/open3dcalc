import { describe, it, expect, beforeEach, vi } from "vitest";
import manifestFixture from "../../../../docs/privacy/SPEC-01-manifest-fixture.json";
import {
  useSpoolStore,
  filterSpools,
  sortSpools,
  SPOOLS_KEY,
  SPOOL_MATERIALS,
  type FilamentSpool,
  type SpoolStatus,
  type SpoolFilters,
} from "../spoolStore";

function makeSpool(
  overrides: Partial<FilamentSpool> = {},
): Omit<FilamentSpool, "id" | "dateAdded"> {
  return {
    brand: "TestBrand",
    material: "PLA",
    color: "Red",
    colorHex: "#ff0000",
    weightGrams: 1000,
    originalWeightGrams: 1000,
    costPerKg: 120,
    diameterMm: 1.75,
    notes: "",
    status: "in_stock" as SpoolStatus,
    purchaseStore: "Amazon",
    ...overrides,
  };
}

const sampleSpools = (): FilamentSpool[] => [
  {
    id: "a",
    brand: "Bambu Lab",
    material: "PLA",
    color: "Azul Velvet",
    colorHex: "#3b82f6",
    weightGrams: 200,
    originalWeightGrams: 1000,
    costPerKg: 130,
    diameterMm: 1.75,
    dateAdded: 300,
    notes: "carretel novo",
    status: "in_stock",
    purchaseStore: "Bambu Store",
  },
  {
    id: "b",
    brand: "eSun",
    material: "PETG",
    color: "Preto",
    colorHex: "#374151",
    weightGrams: 950,
    originalWeightGrams: 1000,
    costPerKg: 110,
    diameterMm: 1.75,
    dateAdded: 100,
    notes: "",
    status: "on_the_way",
    purchaseStore: "Shopee",
  },
  {
    id: "c",
    brand: "Polymaker",
    material: "pla",
    color: "Branco",
    colorHex: "#e2e8f0",
    weightGrams: 0,
    originalWeightGrams: 1000,
    costPerKg: 0,
    diameterMm: 1.75,
    dateAdded: 200,
    notes: "vazio, guardar",
    status: "empty",
    purchaseStore: "",
  },
];

describe("useSpoolStore (integration)", () => {
  beforeEach(() => {
    localStorage.clear();
    useSpoolStore.setState({ spools: [] });
  });

  // ── manifest gate (SPEC-01) ─────────────────────────────────
  describe("persistência gated (SPEC-01)", () => {
    it("a chave reutilizada do Phase 6 está registrada no manifesto", () => {
      const entry = (
        manifestFixture.keys as Array<{
          key: string;
          class: string;
          pii: boolean;
        }>
      ).find(
        (e) => e.key === SPOOLS_KEY,
      );

      expect(entry).toBeDefined();
      // Inventário é dado de usuário (user_content), nunca ui_preference.
      expect(entry?.class).toBe("user_content");
      expect(entry?.pii).toBe(false);
    });

    it("addSpool() persiste na chave registrada", () => {
      useSpoolStore.getState().addSpool(makeSpool({ brand: "eSun" }));

      const raw = JSON.parse(localStorage.getItem(SPOOLS_KEY) || "[]");
      expect(raw).toHaveLength(1);
      expect(raw[0].brand).toBe("eSun");
    });

    it("sobrevive a um reload: módulo fresco recarrega do storage", () => {
      useSpoolStore.getState().addSpool(makeSpool({ brand: "Prusament" }));

      vi.resetModules();
      return import("../spoolStore").then(({ useSpoolStore: fresh }) => {
        expect(fresh.getState().spools).toHaveLength(1);
        expect(fresh.getState().spools[0].brand).toBe("Prusament");
      });
    });

    it("payload legado sem tareGrams carrega como undefined (fallback de marca)", () => {
      localStorage.setItem(
        SPOOLS_KEY,
        JSON.stringify([
          {
            id: "legacy_1",
            brand: "Bambu Lab",
            material: "PLA",
            color: "",
            colorHex: "",
            weightGrams: 900,
            originalWeightGrams: 1000,
            costPerKg: 120,
            diameterMm: 1.75,
            dateAdded: 1,
            notes: "",
            status: "in_stock",
            purchaseStore: "",
          },
        ]),
      );

      vi.resetModules();
      return import("../spoolStore").then(({ useSpoolStore: fresh }) => {
        const { spools } = fresh.getState();
        expect(spools).toHaveLength(1);
        expect(spools[0].tareGrams).toBeUndefined();
      });
    });

    it("blob corrompido degrada para lista vazia sem lançar", () => {
      localStorage.setItem(SPOOLS_KEY, "{not json");

      vi.resetModules();
      return import("../spoolStore").then(({ useSpoolStore: fresh }) => {
        expect(fresh.getState().spools).toEqual([]);
      });
    });
  });

  // ── CRUD ─────────────────────────────────────────────────────
  it("addSpool() → aparece na lista com id e dateAdded", () => {
    useSpoolStore.getState().addSpool(makeSpool({ brand: "eSun", weightGrams: 800 }));

    const { spools } = useSpoolStore.getState();
    expect(spools).toHaveLength(1);
    expect(spools[0].brand).toBe("eSun");
    expect(spools[0].weightGrams).toBe(800);
    expect(spools[0].id).toBeTruthy();
    expect(spools[0].dateAdded).toBeGreaterThan(0);
  });

  it("removeSpool() remove só o alvo e persiste", () => {
    useSpoolStore.getState().addSpool(makeSpool({ brand: "eSun" }));
    useSpoolStore.getState().addSpool(makeSpool({ brand: "Prusament" }));
    const id = useSpoolStore.getState().spools[0].id;

    useSpoolStore.getState().removeSpool(id);

    expect(useSpoolStore.getState().spools).toHaveLength(1);
    expect(useSpoolStore.getState().spools[0].brand).toBe("Prusament");
    expect(
      JSON.parse(localStorage.getItem(SPOOLS_KEY) || "[]"),
    ).toHaveLength(1);
  });

  it("updateSpool() faz merge parcial e persiste", () => {
    useSpoolStore.getState().addSpool(makeSpool({ brand: "eSun" }));
    const id = useSpoolStore.getState().spools[0].id;

    useSpoolStore.getState().updateSpool(id, { weightGrams: 500, notes: "metade" });

    const spool = useSpoolStore.getState().spools[0];
    expect(spool.weightGrams).toBe(500);
    expect(spool.notes).toBe("metade");
    expect(spool.brand).toBe("eSun"); // merge, não replace
  });

  it("updateSpool() limpa tareGrams de volta para undefined", () => {
    useSpoolStore.getState().addSpool(makeSpool({ brand: "Bambu Lab" }));
    const id = useSpoolStore.getState().spools[0].id;

    useSpoolStore.getState().updateSpool(id, { tareGrams: 208 });
    expect(useSpoolStore.getState().spools[0].tareGrams).toBe(208);

    useSpoolStore.getState().updateSpool(id, { tareGrams: undefined });
    expect(useSpoolStore.getState().spools[0].tareGrams).toBeUndefined();
  });

  it("deductWeight() desconta e trava em zero (nunca negativo)", () => {
    useSpoolStore.getState().addSpool(makeSpool({ weightGrams: 100 }));
    const id = useSpoolStore.getState().spools[0].id;

    useSpoolStore.getState().deductWeight(id, 40);
    expect(useSpoolStore.getState().spools[0].weightGrams).toBe(60);

    useSpoolStore.getState().deductWeight(id, 9999);
    expect(useSpoolStore.getState().spools[0].weightGrams).toBe(0);
  });

  // ── selectors ────────────────────────────────────────────────
  it("getTotalWeight() soma os gramas restantes", () => {
    useSpoolStore.getState().addSpool(makeSpool({ weightGrams: 300 }));
    useSpoolStore.getState().addSpool(makeSpool({ weightGrams: 250 }));

    expect(useSpoolStore.getState().getTotalWeight()).toBe(550);
  });

  it("getSpoolsByMaterial() é case-insensitive", () => {
    useSpoolStore.getState().addSpool(makeSpool({ material: "PETG" }));
    useSpoolStore.getState().addSpool(makeSpool({ material: "petg" }));
    useSpoolStore.getState().addSpool(makeSpool({ material: "PLA" }));

    expect(useSpoolStore.getState().getSpoolsByMaterial("Petg")).toHaveLength(2);
  });

  it("getLowStockSpools() retorna carretéis abaixo do limiar", () => {
    useSpoolStore.getState().addSpool(makeSpool({ weightGrams: 50 }));
    useSpoolStore.getState().addSpool(makeSpool({ weightGrams: 500 }));

    expect(useSpoolStore.getState().getLowStockSpools(100)).toHaveLength(1);
  });
});

// ── filterSpools / sortSpools (pure) ───────────────────────────
describe("filterSpools", () => {
  const spools = sampleSpools();
  const noFilters: SpoolFilters = { search: "", material: "Todos", status: "all" };

  it("sem filtros devolve todos", () => {
    expect(filterSpools(spools, noFilters)).toHaveLength(3);
  });

  it("busca corresponde a cor, marca, material e nota (sem case)", () => {
    expect(
      filterSpools(spools, { ...noFilters, search: "velvet" }),
    ).toHaveLength(1);
    expect(
      filterSpools(spools, { ...noFilters, search: "ESUN" }),
    ).toHaveLength(1);
    expect(
      filterSpools(spools, { ...noFilters, search: "petg" }),
    ).toHaveLength(1);
    expect(
      filterSpools(spools, { ...noFilters, search: "guardar" }),
    ).toHaveLength(1);
  });

  it("filtra por material (case-insensitive)", () => {
    expect(
      filterSpools(spools, { ...noFilters, material: "PLA" }),
    ).toHaveLength(2); // "PLA" e "pla"
  });

  it("filtra por status", () => {
    expect(
      filterSpools(spools, { ...noFilters, status: "on_the_way" }),
    ).toHaveLength(1);
    expect(
      filterSpools(spools, { ...noFilters, status: "empty" }),
    ).toHaveLength(1);
  });

  it("combina search + material + status", () => {
    const filtered = filterSpools(spools, {
      search: "bambu",
      material: "Todos",
      status: "in_stock",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("a");
  });

  it("não muta o array original", () => {
    const before = [...spools];
    filterSpools(spools, { ...noFilters, material: "PLA" });
    expect(spools).toEqual(before);
  });
});

describe("sortSpools", () => {
  const spools = sampleSpools();

  it("por nome (asc) usa ordem alfabética da cor", () => {
    const sorted = sortSpools(spools, "name", "asc");
    expect(sorted.map((s) => s.color)).toEqual([
      "Azul Velvet",
      "Branco",
      "Preto",
    ]);
  });

  it("por nome (desc) inverte", () => {
    const sorted = sortSpools(spools, "name", "desc");
    expect(sorted.map((s) => s.color)).toEqual([
      "Preto",
      "Branco",
      "Azul Velvet",
    ]);
  });

  it("por restante ordena pela porcentagem restante", () => {
    const sorted = sortSpools(spools, "remaining", "asc");
    // a=20%, b=95%, c=0%
    expect(sorted.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("por peso ordena por weightGrams", () => {
    const sorted = sortSpools(spools, "weight", "desc");
    expect(sorted.map((s) => s.weightGrams)).toEqual([950, 200, 0]);
  });

  it("por data ordena por dateAdded", () => {
    const sorted = sortSpools(spools, "dateAdded", "asc");
    expect(sorted.map((s) => s.dateAdded)).toEqual([100, 200, 300]);
  });

  it("desempate estável por id quando os valores empatam", () => {
    const tie = [
      { ...spools[0], id: "z", color: "Igual", weightGrams: 10 },
      { ...spools[1], id: "y", color: "Igual", weightGrams: 10 },
    ];
    const sorted = sortSpools(tie, "name", "asc");
    expect(sorted.map((s) => s.id)).toEqual(["y", "z"]);
  });

  it("não muta o array original", () => {
    const before = [...spools];
    sortSpools(spools, "weight", "asc");
    expect(spools).toEqual(before);
  });
});

describe("useSpoolStore.getVisibleSpools", () => {
  beforeEach(() => {
    localStorage.clear();
    useSpoolStore.setState({
      spools: sampleSpools(),
    });
  });

  it("compõe filtro + ordenação", () => {
    const visible = useSpoolStore.getState().getVisibleSpools(
      { search: "", material: "Todos", status: "all" },
      "remaining",
      "desc",
    );
    expect(visible.map((s) => s.id)).toEqual(["b", "a", "c"]);
  });

  it("respeita o filtro de material antes de ordenar", () => {
    const visible = useSpoolStore.getState().getVisibleSpools(
      { search: "", material: "PLA", status: "all" },
      "name",
      "asc",
    );
    expect(visible.map((s) => s.id)).toEqual(["a", "c"]);
  });
});

describe("SPOOL_MATERIALS", () => {
  it("contém os materiais do Phase 6 para compatibilidade de filtros", () => {
    expect(SPOOL_MATERIALS).toContain("PLA");
    expect(SPOOL_MATERIALS).toContain("PETG");
    expect(SPOOL_MATERIALS).toContain("Outro");
  });
});
