import { describe, it, expect, beforeEach, vi } from "vitest";

import { useCalculatorStore } from "../calculatorStore";
import { DEFAULT_FDM_SLICER_PROFILE } from "../calculatorStore.defaults";
import type { FdmSlicerProfile } from "../calculatorStore.types";
import { VOLUME_DEFAULTS } from "@/shared/lib/stlParser";
import { DEFAULT_SETTINGS } from "@/shared/lib/printTimeEstimator";
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

vi.mock("@/shared/stores/catalogStore", () => ({
  useCatalogStore: {
    getState: () => ({ printers: [] }),
  },
}));

const SETTINGS_KEY = "open3dcalc_settings_v2";

const DEFAULT_PROFILE: FdmSlicerProfile = { ...DEFAULT_FDM_SLICER_PROFILE };

describe("CalculatorStore — fdmSlicerProfile slice (D-EA1)", () => {
  beforeEach(() => {
    vi.clearAllTimers();
    localStorage.clear();
    useCalculatorStore.setState(
      {
        ...useCalculatorStore.getState(),
        fdmSlicerProfile: { ...DEFAULT_PROFILE },
      },
      true,
    );
    mockAddEntry.mockClear();
    mockDeductWeight.mockClear();
  });

  // ── Defaults (single source of truth = estimadores) ────────────

  it("inicia com os defaults dos estimadores (GA-1)", () => {
    const profile = useCalculatorStore.getState().fdmSlicerProfile;
    expect(profile).toEqual({
      wallCount: 2,
      lineWidthMm: 0.42,
      topLayers: 4,
      bottomLayers: 4,
      layerHeightMm: 0.2,
      printSpeedMmPerS: 60,
    });
  });

  it("defaults têm os mesmos valores de VOLUME_DEFAULTS/DEFAULT_SETTINGS (drift guard)", () => {
    const profile = useCalculatorStore.getState().fdmSlicerProfile;
    expect(profile.wallCount).toBe(VOLUME_DEFAULTS.wallCount);
    expect(profile.lineWidthMm).toBe(VOLUME_DEFAULTS.lineWidthMm);
    expect(profile.topLayers).toBe(VOLUME_DEFAULTS.topLayers);
    expect(profile.bottomLayers).toBe(VOLUME_DEFAULTS.bottomLayers);
    expect(profile.layerHeightMm).toBe(VOLUME_DEFAULTS.layerHeightMm);
    // A velocidade vem do estimador de tempo, não do de volume.
    expect(profile.printSpeedMmPerS).toBe(DEFAULT_SETTINGS.printSpeedMmPerS);
  });

  // ── Setter (merge parcial) ──────────────────────────────────────

  it("setFdmSlicerProfile faz merge parcial — só o campo passado muda", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({ wallCount: 4 });
    const after = useCalculatorStore.getState().fdmSlicerProfile;
    expect(after.wallCount).toBe(4);
    expect(after.lineWidthMm).toBe(DEFAULT_PROFILE.lineWidthMm);
    expect(after.layerHeightMm).toBe(DEFAULT_PROFILE.layerHeightMm);
    expect(after.printSpeedMmPerS).toBe(DEFAULT_PROFILE.printSpeedMmPerS);
  });

  it("setFdmSlicerProfile substitui vários campos", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({
      wallCount: 3,
      layerHeightMm: 0.16,
      printSpeedMmPerS: 100,
    });
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual({
      ...DEFAULT_PROFILE,
      wallCount: 3,
      layerHeightMm: 0.16,
      printSpeedMmPerS: 100,
    });
  });

  // ── NaN / invalid guards — entrada inválida nunca chega ao estimador ──

  it("NaN em qualquer campo → fallback ao default (nunca propaga)", () => {
    // Spec D-EA1: valor ausente/NaN/inválido → fallback ao default. A entrada
    // inválida nunca chega ao estimador — o campo volta ao valor seguro.
    useCalculatorStore.getState().setFdmSlicerProfile({
      wallCount: NaN,
      lineWidthMm: NaN,
      topLayers: NaN,
      bottomLayers: NaN,
      layerHeightMm: NaN,
      printSpeedMmPerS: NaN,
    });
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
    expect(
      Number.isFinite(
        useCalculatorStore.getState().fdmSlicerProfile.printSpeedMmPerS,
      ),
    ).toBe(true);
  });

  it("NaN em um campo não corrompe os outros válidos", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({ wallCount: 5 });
    useCalculatorStore.getState().setFdmSlicerProfile({
      wallCount: 5,
      layerHeightMm: NaN,
    });
    const profile = useCalculatorStore.getState().fdmSlicerProfile;
    expect(profile.wallCount).toBe(5);
    expect(profile.layerHeightMm).toBe(DEFAULT_PROFILE.layerHeightMm);
  });

  it("Infinity é tratado como inválido", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({
      layerHeightMm: Infinity,
      printSpeedMmPerS: -Infinity,
    });
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
  });

  it("camados de contagem negativos ou fracionários são inválidos", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({
      wallCount: -1,
      topLayers: -2,
      bottomLayers: -1,
    });
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
  });

  it("lineWidth/layerHeight/speed <= 0 são inválidos (divisão por zero no estimador)", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({
      lineWidthMm: 0,
      layerHeightMm: 0,
      printSpeedMmPerS: 0,
    });
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
  });

  it("0 paredes é válido (vase mode); 0 camadas topo/base é válido", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({
      wallCount: 0,
      topLayers: 0,
      bottomLayers: 0,
    });
    const profile = useCalculatorStore.getState().fdmSlicerProfile;
    expect(profile.wallCount).toBe(0);
    expect(profile.topLayers).toBe(0);
    expect(profile.bottomLayers).toBe(0);
  });

  it("setter com objeto vazio é no-op", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({});
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
  });

  // ── Persistência (autosave debounced) ───────────────────────────

  it("persiste o perfil no localStorage após o debounce", () => {
    vi.useFakeTimers();
    try {
      useCalculatorStore.getState().setFdmSlicerProfile({ wallCount: 4 });
      vi.advanceTimersByTime(900);

      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
      expect(saved.fdmSlicerProfile).toEqual({
        ...DEFAULT_PROFILE,
        wallCount: 4,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  // ── Migração: estado antigo sem o campo ─────────────────────────

  it("localStorage sem fdmSlicerProfile → default-on-missing, resto preservado", async () => {
    vi.resetModules();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ infillPercent: 35, quantity: 7 }),
    );

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    const state = freshStore.getState();

    expect(state.fdmSlicerProfile).toEqual(DEFAULT_PROFILE);
    expect(state.infillPercent).toBe(35);
    expect(state.quantity).toBe(7);
  });

  it("localStorage com perfil parcial/corrompido → campos válidos vencem, resto default", async () => {
    vi.resetModules();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        fdmSlicerProfile: {
          wallCount: 4,
          lineWidthMm: "grosso",
          layerHeightMm: null,
        },
      }),
    );

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    expect(freshStore.getState().fdmSlicerProfile).toEqual({
      ...DEFAULT_PROFILE,
      wallCount: 4,
    });
  });

  it("localStorage com perfil salvo restaura integralmente", async () => {
    vi.resetModules();
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        fdmSlicerProfile: {
          wallCount: 4,
          lineWidthMm: 0.5,
          topLayers: 5,
          bottomLayers: 3,
          layerHeightMm: 0.16,
          printSpeedMmPerS: 100,
        },
      }),
    );

    const { useCalculatorStore: freshStore } =
      await import("../calculatorStore");
    expect(freshStore.getState().fdmSlicerProfile).toEqual({
      wallCount: 4,
      lineWidthMm: 0.5,
      topLayers: 5,
      bottomLayers: 3,
      layerHeightMm: 0.16,
      printSpeedMmPerS: 100,
    });
  });

  // ── resetCalculator ─────────────────────────────────────────────

  it("resetCalculator volta o perfil aos defaults", () => {
    useCalculatorStore
      .getState()
      .setFdmSlicerProfile({ wallCount: 6, layerHeightMm: 0.3 });
    useCalculatorStore.getState().resetCalculator();
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual(
      DEFAULT_PROFILE,
    );
  });

  // ── Histórico (snapshot) ────────────────────────────────────────

  it("loadHistoryItem de snapshot antigo (sem perfil) mantém o perfil atual", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({ wallCount: 5 });
    useCalculatorStore.getState().loadHistoryItem(buildSnapshot());
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual({
      ...DEFAULT_PROFILE,
      wallCount: 5,
    });
  });

  it("loadHistoryItem restaura o perfil do snapshot", () => {
    useCalculatorStore.getState().loadHistoryItem(
      buildSnapshot({
        fdmSlicerProfile: {
          wallCount: 3,
          lineWidthMm: 0.5,
          topLayers: 2,
          bottomLayers: 2,
          layerHeightMm: 0.12,
          printSpeedMmPerS: 80,
        },
      }),
    );
    expect(useCalculatorStore.getState().fdmSlicerProfile).toEqual({
      wallCount: 3,
      lineWidthMm: 0.5,
      topLayers: 2,
      bottomLayers: 2,
      layerHeightMm: 0.12,
      printSpeedMmPerS: 80,
    });
  });

  it("addToHistory serializa o perfil no snapshot", () => {
    useCalculatorStore.getState().setFdmSlicerProfile({ wallCount: 4 });
    useCalculatorStore.getState().addToHistory();

    const entry = mockAddEntry.mock.calls[0]?.[0];
    expect(entry?.snapshot?.fdmSlicerProfile).toEqual({
      ...DEFAULT_PROFILE,
      wallCount: 4,
    });
  });
});
