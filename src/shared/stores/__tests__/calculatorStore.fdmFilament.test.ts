import { describe, it, expect, beforeEach, vi } from "vitest";

import { useCalculatorStore } from "../calculatorStore";
import { DEFAULT_FDM_FILAMENT } from "../calculatorStore.defaults";
import { resolveFdmFilament } from "../calculatorStore.helpers";
import { restoreAutoSnapshot } from "../storeBridge";
import type { FdmFilamentParams } from "@/shared/types";
import { DEFAULT_FILAMENT_DIAMETER_MM } from "@/shared/lib/filamentDefaults";
import { buildSnapshot } from "./calculatorStore.test-utils";

// ── Hoisted mocks (executed by vitest BEFORE imports) ──────────────
const { mockAddEntry, mockDeductWeight } = vi.hoisted(() => ({
  mockAddEntry: vi.fn(),
  mockDeductWeight: vi.fn(),
}));

vi.mock("@/shared/stores/historyStore", () => ({
  useHistoryStore: {
    getState: () => ({ addEntry: mockAddEntry }),
    setState: () => {},
    subscribe: () => () => {},
    destroy: () => {},
  },
}));

vi.mock("@/shared/stores/filamentInventory", () => ({
  useFilamentInventory: {
    getState: () => ({ deductWeight: mockDeductWeight }),
    setState: () => {},
    subscribe: () => () => {},
    destroy: () => {},
  },
}));

// restoreAutoSnapshot resolves printer/marketplace from the catalog — give it
// real-ish entries so the restored selection is well-formed.
vi.mock("@/shared/stores/catalogStore", () => ({
  useCatalogStore: {
    getState: () => ({
      printers: [{ id: "p1", name: "Mock Printer" }],
      marketplaces: [{ id: "m1", name: "Mock Marketplace" }],
    }),
  },
}));

const SETTINGS_KEY = "open3dcalc_settings_v2";

const DEFAULT_FILAMENT: FdmFilamentParams = { ...DEFAULT_FDM_FILAMENT };

describe("CalculatorStore — fdmFilament slice (D-EA2, GA-2)", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    localStorage.clear();
    useCalculatorStore.setState(
      {
        ...useCalculatorStore.getState(),
        fdmFilament: { ...DEFAULT_FILAMENT },
      },
      true,
    );
    mockAddEntry.mockClear();
    mockDeductWeight.mockClear();
  });

  // ── Defaults (behavior-preserving: literais hardcoded anteriores) ──

  it("inicia com os defaults (purge 10, diâmetro 1.75)", () => {
    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 10,
      filamentDiameterMm: 1.75,
    });
  });

  it("defaults são byte-identical aos literais pré-D-EA2 (drift guard)", () => {
    // O purgePercent: 10 era hardcoded em StlPreview (único consumidor); o
    // estimador defaultava 0. Manter 10 no slice = saída inalterada.
    expect(DEFAULT_FDM_FILAMENT.purgePercent).toBe(10);
    // O diâmetro vinha do literal 1.75 (gcodeTotals/printTimeEstimator).
    expect(DEFAULT_FDM_FILAMENT.filamentDiameterMm).toBe(1.75);
    expect(DEFAULT_FDM_FILAMENT.filamentDiameterMm).toBe(
      DEFAULT_FILAMENT_DIAMETER_MM,
    );
  });

  // ── Setter (merge parcial) ──────────────────────────────────────

  it("setFdmFilament faz merge parcial — só o campo passado muda", () => {
    useCalculatorStore.getState().setFdmFilament({ purgePercent: 5 });
    const after = useCalculatorStore.getState().fdmFilament;
    expect(after.purgePercent).toBe(5);
    expect(after.filamentDiameterMm).toBe(DEFAULT_FILAMENT.filamentDiameterMm);
  });

  it("setFdmFilament substitui ambos os campos", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: 0,
      filamentDiameterMm: 1.85,
    });
    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 0,
      filamentDiameterMm: 1.85,
    });
  });

  it("setter com objeto vazio é no-op", () => {
    useCalculatorStore.getState().setFdmFilament({});
    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  // ── NaN / invalid guards — entrada inválida nunca chega ao estimador ──

  it("NaN em qualquer campo → fallback ao default (nunca propaga)", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: NaN,
      filamentDiameterMm: NaN,
    });
    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  it("Infinity é tratado como inválido", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: Infinity,
      filamentDiameterMm: -Infinity,
    });
    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  it("NaN em um campo não corrompe o outro válido", () => {
    useCalculatorStore.getState().setFdmFilament({ purgePercent: 12 });
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: 12,
      filamentDiameterMm: NaN,
    });
    const f = useCalculatorStore.getState().fdmFilament;
    expect(f.purgePercent).toBe(12);
    expect(f.filamentDiameterMm).toBe(DEFAULT_FILAMENT.filamentDiameterMm);
  });

  it("purge negativo é inválido; purge 0 é válido (sem purge)", () => {
    useCalculatorStore.getState().setFdmFilament({ purgePercent: -5 });
    expect(useCalculatorStore.getState().fdmFilament.purgePercent).toBe(
      DEFAULT_FILAMENT.purgePercent,
    );

    useCalculatorStore.getState().setFdmFilament({ purgePercent: 0 });
    expect(useCalculatorStore.getState().fdmFilament.purgePercent).toBe(0);
  });

  it("diâmetro <= 0 é inválido (divisão por zero no estimador)", () => {
    useCalculatorStore.getState().setFdmFilament({ filamentDiameterMm: 0 });
    expect(useCalculatorStore.getState().fdmFilament.filamentDiameterMm).toBe(
      DEFAULT_FILAMENT.filamentDiameterMm,
    );

    useCalculatorStore.getState().setFdmFilament({ filamentDiameterMm: -1.75 });
    expect(useCalculatorStore.getState().fdmFilament.filamentDiameterMm).toBe(
      DEFAULT_FILAMENT.filamentDiameterMm,
    );
  });

  // ── Resolve (pure function — migration-safe por construção) ─────

  it("resolveFdmFilament: ausente/parcial/corrompido → perfil completo válido", () => {
    expect(resolveFdmFilament(undefined)).toEqual(DEFAULT_FILAMENT);
    expect(resolveFdmFilament(null)).toEqual(DEFAULT_FILAMENT);
    expect(resolveFdmFilament({})).toEqual(DEFAULT_FILAMENT);
    expect(resolveFdmFilament({ purgePercent: 7 })).toEqual({
      purgePercent: 7,
      filamentDiameterMm: 1.75,
    });
    // Input deliberadamente inválido (blob corrompido) — o cast documenta que
    // o sanitizer tem que rejeitar em runtime, não confiar nos tipos.
    const corrupt = {
      purgePercent: "muita",
      filamentDiameterMm: null,
    } as unknown as Partial<FdmFilamentParams>;
    expect(resolveFdmFilament(corrupt)).toEqual(DEFAULT_FILAMENT);
  });

  // ── Persistência (autosave debounced) ───────────────────────────

  it("persiste o slice no localStorage após o debounce", () => {
    vi.useFakeTimers();
    try {
      useCalculatorStore.getState().setFdmFilament({ purgePercent: 15 });
      vi.advanceTimersByTime(900);

      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      expect(saved.fdmFilament).toEqual({
        purgePercent: 15,
        filamentDiameterMm: 1.75,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Migração: estado antigo sem o campo ─────────────────────────

  it("localStorage sem fdmFilament → default-on-missing, resto preservado", async () => {
    vi.resetModules();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ infillPercent: 35, quantity: 7 }),
    );

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    const state = freshStore.getState();

    expect(state.fdmFilament).toEqual(DEFAULT_FILAMENT);
    expect(state.infillPercent).toBe(35);
    expect(state.quantity).toBe(7);
  });

  it("localStorage com slice parcial/corrompido → campos válidos vencem", async () => {
    vi.resetModules();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        fdmFilament: {
          purgePercent: 8,
          filamentDiameterMm: "grosso",
        },
      }),
    );

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    expect(freshStore.getState().fdmFilament).toEqual({
      purgePercent: 8,
      filamentDiameterMm: 1.75,
    });
  });

  it("localStorage com blob JSON inválido → fallback graceful", async () => {
    vi.resetModules();
    localStorage.setItem(SETTINGS_KEY, "{not json");

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    expect(freshStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  // ── Histórico (loadHistoryItem) ─────────────────────────────────

  it("snapshot antigo sem fdmFilament → mantém o valor atual", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: 25,
      filamentDiameterMm: 1.85,
    });
    const snap = buildSnapshot(); // sem fdmFilament = snapshot pré-D-EA2

    useCalculatorStore.getState().loadHistoryItem(snap);

    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 25,
      filamentDiameterMm: 1.85,
    });
  });

  it("snapshot com fdmFilament válido é restaurado", () => {
    const snap = buildSnapshot({
      fdmFilament: { purgePercent: 3, filamentDiameterMm: 1.6 },
    });

    useCalculatorStore.getState().loadHistoryItem(snap);

    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 3,
      filamentDiameterMm: 1.6,
    });
  });

  it("snapshot com fdmFilament corrompido → fallback graceful", () => {
    const snap = buildSnapshot({
      fdmFilament: { purgePercent: NaN, filamentDiameterMm: 0 },
    });

    useCalculatorStore.getState().loadHistoryItem(snap);

    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  it("snapshot parcial: campos válidos vencem, inválidos caem no default", () => {
    const snap = buildSnapshot({
      fdmFilament: { purgePercent: 18, filamentDiameterMm: Infinity },
    });

    useCalculatorStore.getState().loadHistoryItem(snap);

    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 18,
      filamentDiameterMm: 1.75,
    });
  });

  // ── restoreAutoSnapshot (storeBridge — boot do app) ─────────────

  it("restoreAutoSnapshot: blob sem fdmFilament mantém o atual", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: 25,
      filamentDiameterMm: 1.85,
    });
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        selectedPrinterId: "p1",
        selectedMarketplaceId: "m1",
        // sem fdmFilament = blob pré-D-EA2
      }),
    );

    expect(restoreAutoSnapshot()).toBe(true);
    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 25,
      filamentDiameterMm: 1.85,
    });
  });

  it("restoreAutoSnapshot: blob com fdmFilament válido é aplicado", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        selectedPrinterId: "p1",
        selectedMarketplaceId: "m1",
        fdmFilament: { purgePercent: 5, filamentDiameterMm: 1.6 },
      }),
    );

    expect(restoreAutoSnapshot()).toBe(true);
    expect(useCalculatorStore.getState().fdmFilament).toEqual({
      purgePercent: 5,
      filamentDiameterMm: 1.6,
    });
  });

  it("restoreAutoSnapshot: blob corrompido → fallback graceful", () => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        selectedPrinterId: "p1",
        selectedMarketplaceId: "m1",
        fdmFilament: { purgePercent: "muita", filamentDiameterMm: -3 },
      }),
    );

    expect(restoreAutoSnapshot()).toBe(true);
    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });

  // ── Reset ───────────────────────────────────────────────────────

  it("resetCalculator restaura os defaults do slice", () => {
    useCalculatorStore.getState().setFdmFilament({
      purgePercent: 99,
      filamentDiameterMm: 2.85,
    });

    useCalculatorStore.getState().resetCalculator();

    expect(useCalculatorStore.getState().fdmFilament).toEqual(DEFAULT_FILAMENT);
  });
});
