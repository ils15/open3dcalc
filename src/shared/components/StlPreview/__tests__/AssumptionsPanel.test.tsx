import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssumptionsPanel } from "../AssumptionsPanel";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import {
  DEFAULT_FDM_FILAMENT,
  DEFAULT_FDM_MATERIAL,
  DEFAULT_FDM_SLICER_PROFILE,
} from "@/shared/stores/calculatorStore.defaults";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";

// `t` identidade: os testes validam as CHAVES (pt-BR e en-US são espelho
// estrutural — o contrato i18n é verificado no describe dedicado abaixo).
const t = (key: string) => key;

interface MockOverrides {
  profile?: Partial<typeof DEFAULT_FDM_SLICER_PROFILE>;
  filament?: Partial<typeof DEFAULT_FDM_FILAMENT>;
  material?: Partial<Pick<typeof DEFAULT_FDM_MATERIAL, "type" | "density">>;
}

function createMockStore(overrides: MockOverrides = {}): CalculatorState {
  return {
    fdmSlicerProfile: {
      ...DEFAULT_FDM_SLICER_PROFILE,
      ...overrides.profile,
    },
    fdmFilament: { ...DEFAULT_FDM_FILAMENT, ...overrides.filament },
    fdmMaterial: {
      ...DEFAULT_FDM_MATERIAL,
      ...overrides.material,
    },
  } as unknown as CalculatorState;
}

function renderPanel(
  store = createMockStore(),
  {
    mode = "simple",
    weightFromGcode = false,
    timeFromGcode = false,
    onSwitchToCustom = vi.fn(),
  }: {
    mode?: "simple" | "advanced";
    weightFromGcode?: boolean;
    timeFromGcode?: boolean;
    onSwitchToCustom?: () => void;
  } = {},
) {
  return render(
    <AssumptionsPanel
      store={store}
      mode={mode}
      weightFromGcode={weightFromGcode}
      timeFromGcode={timeFromGcode}
      t={t}
      onSwitchToCustom={onSwitchToCustom}
    />,
  );
}

describe("AssumptionsPanel", () => {
  describe("structure + a11y", () => {
    it("renders the group role with a labelled heading", () => {
      renderPanel();

      const group = screen.getByRole("group");
      const labelledBy = group.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();
      expect(screen.getByText("stl.assumptionsTitle")).toHaveAttribute(
        "id",
        labelledBy,
      );
    });

    it("renders a tooltip explaining the panel", () => {
      renderPanel();

      expect(screen.getByText("stl.assumptionsTooltip")).toBeInTheDocument();
    });
  });

  describe("slicing profile rows (read from the store)", () => {
    it("renders the slicer profile values that fed the estimate", () => {
      renderPanel(
        createMockStore({
          profile: {
            layerHeightMm: 0.16,
            wallCount: 3,
            lineWidthMm: 0.42,
            printSpeedMmPerS: 80,
            topLayers: 5,
            bottomLayers: 4,
          },
        }),
      );

      expect(screen.getByText("calc.slicer.layerHeightMm")).toBeInTheDocument();
      expect(screen.getByText("0.16 mm")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("0.42 mm")).toBeInTheDocument();
      expect(screen.getByText("80 mm/s")).toBeInTheDocument();
      expect(screen.getByText("calc.slicer.topLayers")).toBeInTheDocument();
      expect(screen.getByText("calc.slicer.bottomLayers")).toBeInTheDocument();
    });

    it("reflects a different profile without stale values", () => {
      renderPanel(
        createMockStore({ profile: { layerHeightMm: 0.2, wallCount: 2 } }),
      );

      expect(screen.getByText("0.2 mm")).toBeInTheDocument();
    });
  });

  describe("filament rows (computed, not literals)", () => {
    it("renders the material family, density, purge and diameter", () => {
      renderPanel();

      expect(screen.getByText("PLA")).toBeInTheDocument();
      // Densidade aplicada = override da store (resolveFilamentDensity).
      expect(screen.getByText("1.24 g/cm³")).toBeInTheDocument();
      expect(screen.getByText("10%")).toBeInTheDocument();
      expect(screen.getByText("1.75 mm")).toBeInTheDocument();
    });

    it("resolves the effective MVS from the material table when there is no override", () => {
      renderPanel();

      // PLA → tabela = 15 mm³/s; origem = tabela do material.
      expect(screen.getByText("15 mm³/s")).toBeInTheDocument();
      expect(screen.getByText("stl.assumptionsMvsTable")).toBeInTheDocument();
    });

    it("resolves the effective MVS from the manual override when set", () => {
      renderPanel(
        createMockStore({ filament: { maxVolumetricSpeedMm3PerS: 24 } }),
      );

      expect(screen.getByText("24 mm³/s")).toBeInTheDocument();
      expect(
        screen.getByText("stl.assumptionsMvsOverride"),
      ).toBeInTheDocument();
    });

    it("falls back to the safe MVS ceiling for an unknown material", () => {
      renderPanel(createMockStore({ material: { type: "PVA" } }));

      // Família fora da tabela → teto seguro (10 mm³/s), nunca NaN.
      expect(screen.getByText("10 mm³/s")).toBeInTheDocument();
    });

    it("applies the store density even when it diverges from the table", () => {
      renderPanel(createMockStore({ material: { density: 1.05 } }));

      expect(screen.getByText("1.05 g/cm³")).toBeInTheDocument();
    });
  });

  describe("estimation mode + provenance", () => {
    it("labels the mode as Standard and shows the ±30% badge in simple mode", () => {
      renderPanel();

      expect(screen.getByText("stl.assumptionsMode")).toBeInTheDocument();
      expect(screen.getByText("stl.assumptionsModeSimple")).toBeInTheDocument();
      expect(screen.getByText("stl.assumptionsRoughBadge")).toBeInTheDocument();
    });

    it("hides the ±30% badge and the provenance rows are absent in simple mode", () => {
      renderPanel();

      expect(screen.queryByText("stl.assumptionsModeCustom")).toBeNull();
      expect(screen.queryByText("stl.assumptionsWeight")).toBeNull();
    });

    it("labels the mode as Custom in advanced mode without anchor badges", () => {
      renderPanel(createMockStore(), {
        mode: "advanced",
        weightFromGcode: false,
        timeFromGcode: false,
      });

      expect(screen.getByText("stl.assumptionsModeCustom")).toBeInTheDocument();
      expect(screen.queryByText("stl.assumptionsRoughBadge")).toBeNull();
      // Sem âncora: peso e tempo vindos da estimativa STL (uma badge por linha).
      expect(screen.getAllByText("stl.estimatedBadge")).toHaveLength(2);
    });

    it("shows the G-code provenance badge when the weight is anchored", () => {
      renderPanel(createMockStore(), {
        mode: "advanced",
        weightFromGcode: true,
        timeFromGcode: true,
      });

      expect(screen.getAllByText("stl.gcodeBadge").length).toBeGreaterThan(0);
    });
  });

  describe("education CTA (≤2 cliques)", () => {
    it("renders the why-mismatch explainer + CTA in simple mode", () => {
      renderPanel();

      expect(screen.getByText("stl.assumptionsWhyTitle")).toBeInTheDocument();
      expect(screen.getByText("stl.assumptionsWhyText")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "stl.assumptionsCtaCustom" }),
      ).toBeInTheDocument();
    });

    it("calls onSwitchToCustom when the CTA is clicked", () => {
      const onSwitchToCustom = vi.fn();
      renderPanel(createMockStore(), { onSwitchToCustom });

      fireEvent.click(
        screen.getByRole("button", { name: "stl.assumptionsCtaCustom" }),
      );

      expect(onSwitchToCustom).toHaveBeenCalledTimes(1);
    });

    it("hides the CTA in advanced mode (already there)", () => {
      renderPanel(createMockStore(), { mode: "advanced" });

      expect(
        screen.queryByRole("button", { name: "stl.assumptionsCtaCustom" }),
      ).toBeNull();
    });
  });

  describe("i18n (both locales mirror every key the UI emits)", () => {
    // Chaves que o componente emite direta ou indiretamente. Se uma chave
    // faltar num locale, o usuário vê a chave crua — regressão de i18n.
    const EMITTED_KEYS = [
      "stl.assumptionsTitle",
      "stl.assumptionsTooltip",
      "stl.assumptionsMode",
      "stl.assumptionsModeSimple",
      "stl.assumptionsModeCustom",
      "stl.assumptionsRoughBadge",
      "stl.assumptionsRoughTooltip",
      "stl.assumptionsSlicerGroup",
      "stl.assumptionsFilamentGroup",
      "stl.assumptionsMaterial",
      "stl.assumptionsMvs",
      "stl.assumptionsMvsTable",
      "stl.assumptionsMvsOverride",
      "stl.assumptionsWeight",
      "stl.assumptionsTime",
      "stl.assumptionsWhyTitle",
      "stl.assumptionsWhyText",
      "stl.assumptionsCtaCustom",
      "calc.filamentProfile",
      "calc.filament.purgePercent",
      "calc.filament.filamentDiameterMm",
      "calc.filament.maxVolumetricSpeedMm3PerS",
      "calc.filament.mvsPlaceholder",
      "calc.filament.errorNonNegative",
      "calc.filament.errorPositive",
      "tooltip.filamentProfile",
      "tooltip.filamentPurgePercent",
      "tooltip.filamentDiameter",
      "tooltip.filamentMvs",
    ];

    it.each([
      ["pt-BR", ptBR],
      ["en-US", enUS],
    ])("translates every emitted key in %s", (_locale, dict) => {
      for (const key of EMITTED_KEYS) {
        const parts = key.split(".");
        // Resolve caminho aninhado (stl.assumptionsTitle → stl.assumptionsTitle).
        let node: unknown = dict;
        let resolved = true;
        for (const part of parts) {
          if (typeof node !== "object" || node === null || !(part in node)) {
            resolved = false;
            break;
          }
          node = (node as Record<string, unknown>)[part];
        }
        expect({ ok: resolved, key }).toEqual({ ok: true, key });
      }
    });
  });
});
