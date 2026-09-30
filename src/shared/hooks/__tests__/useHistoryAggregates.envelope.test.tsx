import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";

import i18n from "@/shared/i18n/i18n";
import { useHistoryStore } from "@/shared/stores/historyStore";
import type {
  CalculationResult,
  CalculationSnapshot,
  HistoryEntry,
} from "@/shared/types";
import {
  byMaterial,
  byMonth,
  byPrinter,
  byQuarter,
  useHistoryAggregates,
} from "../useHistoryAggregates";

/**
 * These tests cover the **envelope** — `useHistoryAggregates()` and nothing
 * else. The four pure aggregators are exercised directly in
 * `useHistoryAggregates.test.ts`; here the subject is the glue: does the hook
 * expose all four, does its `useMemo` observe the store it subscribes to, is it
 * actually stable, and does it hand each aggregator the right runtime value.
 *
 * Two deliberate choices, because mocking either one would void the test:
 *
 * 1. The **real** `historyStore`, not a stub. A mocked store proves the hook
 *    calls `byMonth`; it cannot prove the `useMemo` reacts to a store write,
 *    which is the bug this file exists for.
 * 2. The **real** i18n singleton, not a stubbed `t`. A stub returning its own
 *    argument would make `byPrinter`'s translator wiring pass by construction —
 *    `t(key) === key` looks identical to a correct wiring. Only the real
 *    instance can tell "translated" from "raw key" from "pt-BR".
 */

// ---------------------------------------------------------------------------
// Entry factories — timestamps are relative to "now" so the entry always lands
// in the current month/quarter without pinning the calendar.
// ---------------------------------------------------------------------------

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
      wastePercent: 10,
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
    timestamp: Date.now(),
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

/** The bucket key of the month the test is running in. */
function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** The `t` the hook itself receives, so equality checks compare like for like. */
const realT = (key: string): string => i18n.t(key);

beforeEach(async () => {
  await i18n.changeLanguage("en-US");
  useHistoryStore.setState({ entries: [] });
});

afterEach(() => {
  useHistoryStore.setState({ entries: [] });
});

describe("useHistoryAggregates — o envelope expõe as quatro agregações", () => {
  it("1. devolve exatamente as quatro chaves, cada uma alimentada pelo agregador certo", () => {
    const entries = [makeEntry()];
    useHistoryStore.setState({ entries });

    const { result } = renderHook(() => useHistoryAggregates());
    const envelope = result.current;

    // Exatamente quatro chaves — nem uma a mais, nem uma a menos.
    expect(Object.keys(envelope).sort()).toEqual([
      "material",
      "monthly",
      "printer",
      "quarterly",
    ]);

    // Cada chave tem a FORMA do seu agregador. É isto que pega um
    // `monthly: byQuarter(...)` trocado por engano: os itens teriam
    // `quarterKey`, não `monthKey`.
    expect(envelope.monthly?.[0]).toHaveProperty("monthKey");
    expect(envelope.quarterly?.[0]).toHaveProperty("quarterKey");
    expect(envelope.material?.[0]).toHaveProperty("key");
    expect(envelope.printer?.[0]).toHaveProperty("printerId");

    // E cada uma bate, valor a valor, com a função pura alimentada com os
    // MESMOS argumentos que o hook usa (entries, locale, t).
    expect(envelope.monthly).toEqual(byMonth(entries, "en-US"));
    expect(envelope.quarterly).toEqual(byQuarter(entries, "en-US"));
    expect(envelope.material).toEqual(byMaterial(entries));
    expect(envelope.printer).toEqual(byPrinter(entries, realT));
  });
});

describe("useHistoryAggregates — o useMemo observa o store", () => {
  it("2. byMonth e byQuarter refletem uma entrada nova escrita no store DEPOIS da montagem", () => {
    // Monta com UMA entrada.
    useHistoryStore.setState({ entries: [makeEntry({ id: "a" })] });

    const { result } = renderHook(() => useHistoryAggregates());

    const firstMonthly = result.current.monthly?.find(
      (b) => b.monthKey === currentMonthKey(),
    );
    expect(firstMonthly?.count).toBe(1);
    expect(firstMonthly?.revenue).toBe(100);

    const firstQuarter = result.current.quarterly?.at(-1);
    expect(firstQuarter?.count).toBe(1);
    expect(firstQuarter?.revenue).toBe(100);

    // Agora escreve NOVA entrada no store — o `addEntry` de produção.
    act(() => {
      useHistoryStore
        .getState()
        .addEntry(
          makeEntry({ id: "b", sellPrice: 50, totalCost: 20, profit: 30 }),
        );
    });

    // A SEGUNDA leitura tem de conter a entrada nova. Esta é a prova de que a
    // dependência do `useMemo` é `entries`: com `[locale, t]` (ou `[]`), o
    // memo devolveria o objeto ANTIGO e `count` continuaria 1.
    const secondMonthly = result.current.monthly?.find(
      (b) => b.monthKey === currentMonthKey(),
    );
    expect(secondMonthly?.count).toBe(2);
    expect(secondMonthly?.revenue).toBe(150);
    expect(secondMonthly?.cost).toBe(80);
    expect(secondMonthly?.profit).toBe(70);

    const secondQuarter = result.current.quarterly?.at(-1);
    expect(secondQuarter?.count).toBe(2);
    expect(secondQuarter?.revenue).toBe(150);

    // O objeto do envelope é novo, não o memo antigo reusado.
    expect(secondMonthly).not.toBe(firstMonthly);
  });
});

describe("useHistoryAggregates — estabilidade", () => {
  it("3. devolve a MESMA referência quando o store não muda (é a razão do useMemo)", () => {
    useHistoryStore.setState({ entries: [makeEntry()] });

    const { result, rerender } = renderHook(() => useHistoryAggregates());
    const first = result.current;

    rerender();
    rerender();

    // Sem mudança de estado, `useMemo` tem de devolver a mesma referência.
    // Sem o `useMemo`, cada render criaria um objeto novo e isto quebraria.
    expect(result.current).toBe(first);
    expect(result.current.monthly).toBe(first.monthly);
    expect(result.current.quarterly).toBe(first.quarterly);
    expect(result.current.material).toBe(first.material);
    expect(result.current.printer).toBe(first.printer);
  });

  it("3b. uma escrita no store QUEBRA a identidade do memo (senão o memo seria inútil)", () => {
    useHistoryStore.setState({ entries: [makeEntry({ id: "a" })] });

    const { result } = renderHook(() => useHistoryAggregates());
    const before = result.current;

    act(() => {
      useHistoryStore.getState().addEntry(makeEntry({ id: "b" }));
    });

    // O par stability/refresh é o contrato inteiro do useMemo: estável quando
    // nada muda, inválido quando muda. Só os dois juntos provam que a
    // dependência está certa.
    expect(result.current).not.toBe(before);
  });
});

describe("useHistoryAggregates — store vazio", () => {
  it("4. as quatro devolvem null com o store vazio, nunca [] e nunca 0", () => {
    useHistoryStore.setState({ entries: [] });

    const { result } = renderHook(() => useHistoryAggregates());
    const envelope = result.current;

    expect(envelope.monthly).toBeNull();
    expect(envelope.quarterly).toBeNull();
    expect(envelope.material).toBeNull();
    expect(envelope.printer).toBeNull();

    // Um `[]` passaria num `toBeFalsy()` frouxo e renderizaria um gráfico
    // vazio fingindo que o usuário não imprimiu nada.
    expect(envelope.monthly).not.toEqual([]);
    expect(envelope.quarterly).not.toEqual([]);
    expect(envelope.material).not.toEqual([]);
    expect(envelope.printer).not.toEqual([]);
  });
});

describe("useHistoryAggregates — byPrinter usa o tradutor", () => {
  it("5. o bucket `unknown` sai no inglês do i18n real — nem a key crua, nem pt-BR", () => {
    // `snapshot: null` ⇒ sem `selectedPrinterId` ⇒ bucket "unknown".
    useHistoryStore.setState({ entries: [makeEntry({ snapshot: null })] });

    const { result } = renderHook(() => useHistoryAggregates());
    const unknown = result.current.printer?.find(
      (p) => p.printerId === "unknown",
    );

    expect(unknown).toBeDefined();
    // Traduzido de verdade pela chave de en-US.
    expect(unknown?.name).toBe("Unknown printer");
    // Nem o fallback cru de um `t` stubado (`t === key`)...
    expect(unknown?.name).not.toBe("history.aggregates.printerUnknown");
    // ...nem o outro idioma, que é o que sairia se o hook ignorasse o i18n.
    expect(unknown?.name).not.toBe("Impressora desconhecida");
  });

  it("5b. trocar o idioma troca o rótulo — o `t` do hook é o vivo, não um texto fixo", async () => {
    useHistoryStore.setState({ entries: [makeEntry({ snapshot: null })] });

    const { result } = renderHook(() => useHistoryAggregates());
    expect(result.current.printer?.[0].name).toBe("Unknown printer");

    // Um literal pt-BR "hardcoded" no hook, ou um `t` congelado no mount,
    // não mudariam aqui.
    await act(async () => {
      await i18n.changeLanguage("pt-BR");
    });

    expect(result.current.printer?.[0].name).toBe("Impressora desconhecida");
    expect(result.current.printer?.[0].printerId).toBe("unknown");
  });
});
