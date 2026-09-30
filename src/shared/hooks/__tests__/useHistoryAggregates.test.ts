import { describe, it, expect, afterEach, vi } from "vitest";

import {
  byMonth,
  byQuarter,
  byMaterial,
  byPrinter,
} from "../useHistoryAggregates";
import type {
  CalculationResult,
  CalculationSnapshot,
  HistoryEntry,
} from "@/shared/types";

/** Identity translator — mirrors how the hook's own tests stub `t`. */
const t = (key: string): string => key;

/** A complete, plausible result. Callers override only the fields under test. */
function makeResult(
  overrides: Partial<CalculationResult> = {},
): CalculationResult {
  return {
    materialCost: 10,
    energyCost: 2,
    machineCost: 3,
    hardwareCost: 1,
    consumablesCost: 1,
    laborCost: 20,
    softwareCost: 1,
    failureCost: 4,
    extrasCost: 2,
    postProcessingCost: 5,
    subtotal: 49,
    totalCost: 60,
    sellPrice: 105.88,
    profit: 30,
    marketplaceFee: 5.29,
    taxAmount: 10.59,
    costPerGram: 0.71,
    costPerUnit: 60,
    unitWeight: 85,
    estimatedPrintTime: 7,
    targetMarginPercent: 30,
    breakEvenPrice: 70,
    actualMargin: 28.3,
    carbonFootprintGrams: 120,
    ...overrides,
  };
}

/**
 * `snapshot` is built through a cast on purpose: the aggregate only reads
 * `fdmMaterial.type`, `resinMaterial.type` and `selectedPrinterId`, and a
 * hand-rolled partial keeps each test's intent on one line.
 */
function makeSnapshot(
  overrides: Partial<CalculationSnapshot> = {},
): CalculationSnapshot {
  return {
    id: "snap-1",
    timestamp: 0,
    type: "fdm",
    summary: "",
    fdmMaterial: {
      type: "PLA",
      weightUsed: 85,
      purgeWeight: 8,
      costPerKg: 90,
      density: 1.24,
      spoolEfficiency: 98,
    },
    fdmPrintParams: {
      printTimeHours: 7,
    } as CalculationSnapshot["fdmPrintParams"],
    resinMaterial: {
      type: "Standard",
      volumeUsedMl: 10,
      costPerLiter: 180,
      density: 1.1,
      wasteMarginPercent: 10,
    },
    resinPrintParams: {
      printTimeHours: 7,
    } as CalculationSnapshot["resinPrintParams"],
    selectedPrinterId: "bambu_a1_mini",
    productName: "Bracket",
    quantity: 1,
    ...overrides,
  } as CalculationSnapshot;
}

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "e1",
    timestamp: new Date(2026, 1, 10, 12, 0, 0).getTime(),
    type: "fdm",
    name: "Bracket",
    summary: "",
    totalCost: 60,
    sellPrice: 100,
    profit: 40,
    result: makeResult(),
    snapshot: makeSnapshot(),
    ...overrides,
  };
}

/** Pins "now" so the N-month window is deterministic regardless of run date. */
function freezeNow(year: number, monthIndex: number, day = 15): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(year, monthIndex, day, 12, 0, 0).getTime());
}

afterEach(() => {
  vi.useRealTimers();
});

describe("useHistoryAggregates — a regra do null", () => {
  it("1. byMonth([]) devolve null, não [] e não 0", () => {
    const result = byMonth([], "pt-BR");
    expect(result).toBeNull();
    expect(result).not.toEqual([]);
    expect(result).not.toEqual(0);
  });

  it("2. byQuarter, byMaterial e byPrinter também devolvem null com []", () => {
    expect(byQuarter([], "pt-BR")).toBeNull();
    expect(byMaterial([])).toBeNull();
    expect(byPrinter([], t)).toBeNull();
  });
});

describe("useHistoryAggregates — byMonth", () => {
  it("3. uma entrada em Fevereiro/2026 produz 1 bucket com count 1 e as somas corretas", () => {
    freezeNow(2026, 1); // Fevereiro/2026

    const result = byMonth([makeEntry()], "pt-BR", 1);

    expect(result).not.toBeNull();
    expect(result).toHaveLength(1);
    const bucket = result![0];
    expect(bucket.monthKey).toBe("2026-02");
    expect(bucket.year).toBe(2026);
    expect(bucket.monthIndex).toBe(1);
    expect(bucket.count).toBe(1);
    expect(bucket.revenue).toBe(100);
    expect(bucket.cost).toBe(60);
    expect(bucket.profit).toBe(40);
    expect(bucket.isCurrentMonth).toBe(true);
  });

  it("4. months: 3 preenche a janela: 3 buckets, 2 deles com count 0", () => {
    freezeNow(2026, 1); // Fevereiro/2026

    const result = byMonth(
      [
        makeEntry({ id: "a", timestamp: new Date(2026, 1, 3).getTime() }),
        makeEntry({ id: "b", timestamp: new Date(2026, 1, 20).getTime() }),
      ],
      "pt-BR",
      3,
    );

    // A janela é preenchida: buraco no eixo X é bug de render, não honestidade.
    expect(result).toHaveLength(3);
    expect(result!.map((b) => b.monthKey)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    // Buckets vazios DENTRO de uma série não-vazia: count 0, somas zero.
    for (const empty of result!.slice(0, 2)) {
      expect(empty.count).toBe(0);
      expect(empty.revenue).toBe(0);
      expect(empty.cost).toBe(0);
      expect(empty.profit).toBe(0);
    }
    const filled = result![2];
    expect(filled.count).toBe(2);
    expect(filled.revenue).toBe(200);
    expect(filled.profit).toBe(80);
    expect(result![0].isCurrentMonth).toBe(false);
  });

  it("5. months: 12 atravessa a virada de ano (índice negativo em new Date(y, m - i, 1))", () => {
    freezeNow(2026, 0); // Janeiro/2026

    const result = byMonth(
      [
        makeEntry({ id: "jan", timestamp: new Date(2026, 0, 10).getTime() }),
        makeEntry({ id: "dec", timestamp: new Date(2025, 11, 20).getTime() }),
      ],
      "pt-BR",
      12,
    );

    expect(result).toHaveLength(12);
    // A primeira janela só existe se `now.getMonth() - i` rollou para o ano anterior.
    expect(result![0].monthKey).toBe("2025-02");
    expect(result![0].year).toBe(2025);
    expect(result![11].monthKey).toBe("2026-01");
    // Ordenado do mais antigo para o mais recente.
    expect(result!.map((b) => b.monthKey)).toEqual(
      [...result!.map((b) => b.monthKey)].sort(),
    );

    const dec = result!.find((b) => b.monthKey === "2025-12");
    const jan = result!.find((b) => b.monthKey === "2026-01");
    expect(dec?.count).toBe(1);
    expect(jan?.count).toBe(1);
    expect(result!.filter((b) => b.count === 0)).toHaveLength(10);
    expect(result![0].isCurrentMonth).toBe(false);
    expect(jan!.isCurrentMonth).toBe(true);
  });

  it("7. quantity 10 com sellPrice 12: revenue 12, não 120 (a armadilha, pelo lado do não-multiplicar)", () => {
    freezeNow(2026, 1);

    const result = byMonth(
      [
        makeEntry({
          totalCost: 7,
          sellPrice: 12,
          profit: 5,
          snapshot: makeSnapshot({ quantity: 10 }),
        }),
      ],
      "pt-BR",
      1,
    );

    // O app grava valor POR UNIDADE (calculatorStore.compute.ts divide quando qty>1).
    expect(result![0].revenue).toBe(12);
    expect(result![0].revenue).not.toBe(120);
    expect(result![0].cost).toBe(7);
    expect(result![0].profit).toBe(5);
  });

  it("6. byMonth inclui entrada com snapshot null (não depende de snapshot)", () => {
    freezeNow(2026, 1);

    const result = byMonth([makeEntry({ snapshot: null })], "pt-BR", 1);

    expect(result).toHaveLength(1);
    expect(result![0].count).toBe(1);
    expect(result![0].revenue).toBe(100);
  });

  it("12. label segue o locale (fev em pt-BR, Feb em en-US) — não há array de meses", () => {
    freezeNow(2026, 1);

    const pt = byMonth([makeEntry()], "pt-BR", 1);
    const en = byMonth([makeEntry()], "en-US", 1);

    // Um array de meses hardcoded devolveria a mesma string nos dois locales.
    expect(pt![0].label).toMatch(/^fev/i);
    expect(en![0].label).toBe("Feb");
    expect(pt![0].label).not.toBe(en![0].label);
  });

  it("13. bucketing é civil LOCAL: toISOString() deslocaria o bucket de uma noite de fronteira", () => {
    freezeNow(2026, 1); // Fevereiro/2026 — janela de 3 meses: Dez, Jan, Fev.

    // 23:30 do último dia de Janeiro local. Num offset negativo, o mesmo
    // instante em UTC é 1º de Fevereiro — `toISOString().slice(0, 7)`
    // devolveria "2026-02" e jogaria o job no mês errado.
    const lateNight = new Date(2026, 0, 31, 23, 30, 0);
    const earlyMorning = new Date(2026, 0, 1, 0, 30, 0);

    const late = byMonth(
      [makeEntry({ timestamp: lateNight.getTime() })],
      "pt-BR",
      3,
    );
    const early = byMonth(
      [makeEntry({ timestamp: earlyMorning.getTime() })],
      "pt-BR",
      3,
    );

    //AMBOS são Janeiro local, independentemente do fuso da máquina.
    expect(late!.find((b) => b.monthKey === "2026-01")?.count).toBe(1);
    expect(late!.find((b) => b.monthKey === "2026-02")?.count).toBe(0);
    expect(early!.find((b) => b.monthKey === "2026-01")?.count).toBe(1);
    // Num offset positivo o mesmo instante cai em Dezembro em UTC.
    expect(early!.find((b) => b.monthKey === "2025-12")?.count).toBe(0);
  });
});

describe("useHistoryAggregates — byQuarter", () => {
  it("devolve null sem entradas e monta trimestres civis com QoQ real", () => {
    freezeNow(2026, 0); // Janeiro/2026 → T1

    const result = byQuarter(
      [
        makeEntry({
          id: "q1a",
          timestamp: new Date(2026, 0, 10).getTime(),
          sellPrice: 100,
        }),
        makeEntry({
          id: "q4z",
          timestamp: new Date(2025, 11, 20).getTime(),
          sellPrice: 50,
        }),
      ],
      "pt-BR",
      8,
    );

    expect(result).toHaveLength(8);
    expect(result![7].quarterKey).toBe("2026-Q1");
    expect(result![7].quarter).toBe(1);
    expect(result![7].label).toBe("Q1'26");
    expect(result![7].isCurrentQuarter).toBe(true);
    expect(result![7].revenue).toBe(100);

    // Janeiro/2026 é o primeiro bucket visível com 8 trimestres de janela.
    expect(result![0].quarterKey).toBe("2024-Q2");

    // QoQ: a receita dobrou de 50 para 100.
    expect(result![6].quarterKey).toBe("2025-Q4");
    expect(result![6].revenue).toBe(50);
    expect(result![7].qoqPercent).toBe(100);

    // Trimestre vazio dentro da série aparece com count 0, não some do eixo X.
    expect(result![5].quarterKey).toBe("2025-Q3");
    expect(result![5].count).toBe(0);
    expect(result![5].revenue).toBe(0);
    // Quarter anterior sem receita → null, nunca 0 nem Infinity.
    expect(result![6].qoqPercent).toBeNull();
    // Primeiro bucket da janela não tem anterior → null.
    expect(result![0].qoqPercent).toBeNull();
  });
});

describe("useHistoryAggregates — byMaterial", () => {
  it("6. snapshot null: entrada DESCARTADA, sem TypeError, e uma entrada só null devolve null", () => {
    const onlyNull = byMaterial([makeEntry({ snapshot: null })]);
    expect(onlyNull).toBeNull();

    const mixed = byMaterial([
      makeEntry({ id: "with", snapshot: makeSnapshot() }),
      makeEntry({ id: "without", snapshot: null }),
    ]);

    // Se a entrada sem snapshot tivesse entrado, count seria 2.
    expect(mixed).toHaveLength(1);
    expect(mixed![0].count).toBe(1);
  });

  it("8. quantity 10 com unitWeight 60: totalGrams 60, não 600, e cai no bucket medium", () => {
    const result = byMaterial([
      makeEntry({
        result: makeResult({ unitWeight: 60 }),
        snapshot: makeSnapshot({ quantity: 10 }),
      }),
    ]);

    expect(result).toHaveLength(1);
    const row = result![0];
    expect(row.cells[1].totalGrams).toBe(60);
    expect(row.cells[1].totalGrams).not.toBe(600);
    expect(row.cells[1].bracketId).toBe("medium");
    // As 4 células sempre presentes, na ordem das faixas.
    expect(row.cells.map((c) => c.bracketId)).toEqual([
      "light",
      "medium",
      "heavy",
      "bulk",
    ]);
    expect(row.count).toBe(1);
  });

  it("14. as faixas são semiabertas [min, max): 50 é medium, 150 é heavy, 300 é bulk", () => {
    // Um job que pesa exatamente o limite pertence à faixa ACIMA, não à de
    // baixo. É o contrato de `MaterialEfficiencyHeatmap.tsx:102` e um `find`
    // com `<=` em vez de `<` jogaria cada job no bucket anterior.
    const cases: ReadonlyArray<readonly [number, string]> = [
      [49, "light"],
      [50, "medium"],
      [149, "medium"],
      [150, "heavy"],
      [299, "heavy"],
      [300, "bulk"],
    ];

    for (const [weight, expected] of cases) {
      const row = byMaterial([
        makeEntry({ result: makeResult({ unitWeight: weight }) }),
      ])!;
      const filled = row[0].cells.filter((c) => c.count > 0);
      expect(
        filled.map((c) => c.bracketId),
        `unitWeight ${weight} deve cair em ${expected}`,
      ).toEqual([expected]);
      // E o grid continua com as 4 células.
      expect(row[0].cells).toHaveLength(4);
    }
  });

  it("normaliza o nome de exibição do demo em key e casa com o catálogo", () => {
    const result = byMaterial([
      makeEntry({
        snapshot: makeSnapshot({
          fdmMaterial: {
            type: "PLA Silk",
            weightUsed: 85,
            purgeWeight: 8,
            costPerKg: 90,
            density: 1.24,
            spoolEfficiency: 98,
          },
        }),
      }),
      makeEntry({
        id: "e2",
        snapshot: makeSnapshot({
          fdmMaterial: {
            type: "TPU 95A",
            weightUsed: 85,
            purgeWeight: 8,
            costPerKg: 90,
            density: 1.24,
            spoolEfficiency: 98,
          },
        }),
      }),
    ]);

    const silk = result!.find((r) => r.key === "pla_silk");
    const tpu = result!.find((r) => r.key === "tpu_95a");
    expect(silk?.label).toBe("PLA Silk");
    expect(silk?.process).toBe("fdm");
    expect(tpu?.label).toBe("TPU 95A");
  });

  it("material fora do catálogo: key preservada e process vem de entry.type", () => {
    const result = byMaterial([
      makeEntry({
        type: "resin",
        snapshot: makeSnapshot({
          type: "resin",
          resinMaterial: {
            type: "Water Washable",
            volumeUsedMl: 10,
            costPerLiter: 220,
            density: 1.1,
            wasteMarginPercent: 10,
          },
        }),
      }),
    ]);

    // "Water Washable" -> water_washable, que existe no catálogo de resina.
    expect(result![0].key).toBe("water_washable");
    expect(result![0].process).toBe("resin");

    const unknown = byMaterial([
      makeEntry({
        snapshot: makeSnapshot({
          fdmMaterial: {
            type: "Filamento X",
            weightUsed: 85,
            purgeWeight: 8,
            costPerKg: 90,
            density: 1.24,
            spoolEfficiency: 98,
          },
        }),
      }),
    ]);
    expect(unknown![0].key).toBe("filamento_x");
    // Nunca getMaterial com default cego: o fallback é a própria key.
    expect(unknown![0].label).toBe("filamento_x");
  });

  it("unitWeight 0: count conta, totalGrams 0 e as razões saem 0 — nunca NaN/Infinity", () => {
    const result = byMaterial([
      makeEntry({ result: makeResult({ unitWeight: 0 }) }),
    ]);

    const light = result![0].cells[0];
    expect(light.count).toBe(1);
    expect(light.totalGrams).toBe(0);
    expect(light.profitPerGram).toBe(0);
    expect(light.pricePerGram).toBe(0);
    // roiPercent = profit/cost*100 = 40/60*100. As razões por grama são 0
    // porque o peso é 0 — nunca NaN nem Infinity.
    expect(light.roiPercent).toBeCloseTo((40 / 60) * 100, 6);
    expect(Number.isFinite(light.profitPerGram)).toBe(true);
    expect(Number.isFinite(light.pricePerGram)).toBe(true);
    expect(Number.isNaN(light.profitPerGram)).toBe(false);
    expect(result![0].bestCell?.bracketId).toBe("light");
  });
});

describe("useHistoryAggregates — byPrinter", () => {
  it("9. snapshot null vai para printerId unknown, não some", () => {
    const result = byPrinter([makeEntry({ snapshot: null })], t);

    expect(result).toHaveLength(1);
    expect(result![0].printerId).toBe("unknown");
    expect(result![0].count).toBe(1);
    expect(result![0].revenue).toBe(100);
  });

  it('10. id conhecido vira "A1 Mini"; id inexistente PRESERVA o id e não colapsa em A1 Mini', () => {
    const result = byPrinter(
      [
        makeEntry({
          id: "known",
          snapshot: makeSnapshot({ selectedPrinterId: "bambu_a1_mini" }),
        }),
        makeEntry({
          id: "ghost",
          snapshot: makeSnapshot({ selectedPrinterId: "id_inexistente" }),
        }),
      ],
      t,
    );

    const known = result!.find((p) => p.printerId === "bambu_a1_mini");
    const ghost = result!.find((p) => p.printerId === "id_inexistente");

    expect(known?.name).toBe("A1 Mini");
    expect(known?.brand).toBe("Bambu Lab");
    // getPrinter() faria ?? printers[0] e devolveria "A1 Mini" para este id.
    expect(ghost).toBeDefined();
    expect(ghost?.name).toBe("id_inexistente");
    expect(ghost?.name).not.toBe("A1 Mini");
    expect(ghost?.count).toBe(1);
  });

  it("11. entrada antiga sem profitPerHour/totalHoursForProfit usa o fallback; estimatedPrintTime 0 dá 0", () => {
    const legacy = makeEntry({
      result: makeResult({
        profitPerHour: undefined,
        totalHoursForProfit: undefined,
        estimatedPrintTime: 5,
      }),
    });
    const result = byPrinter([legacy], t);

    // Σprofit/Σhours = 40/5 = 8 > 0, apesar de o campo não existir na entrada.
    expect(result![0].hours).toBe(5);
    expect(result![0].profitPerHour).toBeGreaterThan(0);
    expect(result![0].profitPerHour).toBe(8);

    const zeroHours = byPrinter(
      [
        makeEntry({
          result: makeResult({
            profitPerHour: undefined,
            totalHoursForProfit: undefined,
            estimatedPrintTime: 0,
          }),
        }),
      ],
      t,
    );
    // 0, nunca Infinity nem NaN.
    expect(zeroHours![0].hours).toBe(0);
    expect(zeroHours![0].profitPerHour).toBe(0);
    expect(Number.isFinite(zeroHours![0].profitPerHour)).toBe(true);

    // Horas NEGATIVAS: historyStore.ts:219 aceita payload importado
    // arbitrário, então um valor inválido pode chegar aqui. O guard `<= 0`
    // precisa segurar o sinal, não só o zero — senão as somas de horas ficam
    // negativas e todo profitPerHour do grupo sai com sinal invertido.
    const negative = byPrinter(
      [
        makeEntry({
          result: makeResult({
            profitPerHour: undefined,
            totalHoursForProfit: undefined,
            estimatedPrintTime: -4,
          }),
        }),
      ],
      t,
    );
    expect(negative![0].hours).toBe(0);
    expect(negative![0].profitPerHour).toBe(0);
    expect(Number.isFinite(negative![0].profitPerHour)).toBe(true);
  });

  it("ordena por profitPerHour decrescente e respeita o limite", () => {
    const result = byPrinter(
      [
        makeEntry({
          id: "slow",
          snapshot: makeSnapshot({ selectedPrinterId: "slow" }),
          result: makeResult({
            profitPerHour: undefined,
            totalHoursForProfit: 10,
          }),
        }),
        makeEntry({
          id: "fast",
          snapshot: makeSnapshot({ selectedPrinterId: "fast" }),
          result: makeResult({
            profitPerHour: undefined,
            totalHoursForProfit: 1,
          }),
        }),
      ],
      t,
    );

    expect(result!.map((p) => p.printerId)).toEqual(["fast", "slow"]);
    expect(
      byPrinter(
        [
          makeEntry({
            id: "a",
            snapshot: makeSnapshot({ selectedPrinterId: "a" }),
          }),
          makeEntry({
            id: "b",
            snapshot: makeSnapshot({ selectedPrinterId: "b" }),
          }),
        ],
        t,
        1,
      ),
    ).toHaveLength(1);
  });
});
