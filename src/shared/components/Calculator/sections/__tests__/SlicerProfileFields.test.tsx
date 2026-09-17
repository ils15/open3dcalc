import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlicerProfileFields } from "../SlicerProfileFields";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import { DEFAULT_FDM_SLICER_PROFILE } from "@/shared/stores/calculatorStore.defaults";

// O componente delega o parse final ao `handleInput` do Calculator; o teste
// precisa da semântica real (parse → setter) — um mock mudo nunca commitaria.
const handleInput = (value: string, setter: (v: number) => void) => {
  setter(value === "" ? 0 : parseFloat(value) || 0);
};

// `t` identidade: os testes validam as chaves i18n (pt-BR e en-US são
// espelho estrutural — ver i18n/locales).
const t = (key: string) => key;

type FieldVisible = (sectionId: string, fieldId: string) => boolean;

const ALL_VISIBLE: FieldVisible = () => true;
const NONE_VISIBLE: FieldVisible = () => false;

function createMockStore(
  profile: Partial<typeof DEFAULT_FDM_SLICER_PROFILE> = {},
): CalculatorState {
  return {
    fdmSlicerProfile: { ...DEFAULT_FDM_SLICER_PROFILE, ...profile },
    setFdmSlicerProfile: vi.fn(),
  } as unknown as CalculatorState;
}

function renderFields(
  store = createMockStore(),
  isFieldVisible: FieldVisible = ALL_VISIBLE,
) {
  return render(
    <SlicerProfileFields
      store={store}
      t={t}
      handleInput={handleInput}
      isFieldVisible={isFieldVisible}
    />,
  );
}

describe("SlicerProfileFields", () => {
  describe("level gating (advanced only)", () => {
    it("renders all six fields when visible (calcLevel advanced)", () => {
      renderFields();

      // Cabeçalho do grupo + tooltip do grupo
      expect(screen.getByText("calc.slicerProfile")).toBeInTheDocument();
      expect(screen.getByText("tooltip.slicerProfile")).toBeInTheDocument();

      for (const labelKey of [
        "calc.slicer.wallCount",
        "calc.slicer.lineWidthMm",
        "calc.slicer.topLayers",
        "calc.slicer.bottomLayers",
        "calc.slicer.layerHeightMm",
        "calc.slicer.printSpeedMmPerS",
      ]) {
        expect(screen.getByLabelText(labelKey)).toBeInTheDocument();
      }
    });

    it("renders nothing when no field is visible (basic/intermediate)", () => {
      const { container } = renderFields(createMockStore(), NONE_VISIBLE);

      expect(container.firstChild).toBeNull();
      expect(screen.queryByText("calc.slicerProfile")).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("calc.slicer.wallCount"),
      ).not.toBeInTheDocument();
    });

    it("renders only the fields allowed by isFieldVisible", () => {
      renderFields(
        createMockStore(),
        (_section, field) => field === "layerHeightMm",
      );

      expect(
        screen.getByLabelText("calc.slicer.layerHeightMm"),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText("calc.slicer.wallCount"),
      ).not.toBeInTheDocument();
      expect(screen.queryAllByRole("spinbutton")).toHaveLength(1);
    });
  });

  describe("tooltips (i18n)", () => {
    it("renders a tooltip per field with the translated help text", () => {
      renderFields();

      for (const tooltipKey of [
        "tooltip.slicerWallCount",
        "tooltip.slicerLineWidth",
        "tooltip.slicerTopLayers",
        "tooltip.slicerBottomLayers",
        "tooltip.slicerLayerHeight",
        "tooltip.slicerPrintSpeed",
      ]) {
        expect(screen.getByText(tooltipKey)).toBeInTheDocument();
      }
    });
  });

  describe("units", () => {
    it("shows the unit suffix for continuous fields", () => {
      renderFields();

      expect(screen.getByText("mm/s")).toBeInTheDocument();
    });
  });

  describe("commit of valid values", () => {
    it.each([
      ["wallCount", "calc.slicer.wallCount", "4", { wallCount: 4 }],
      ["lineWidthMm", "calc.slicer.lineWidthMm", "0.6", { lineWidthMm: 0.6 }],
      ["topLayers", "calc.slicer.topLayers", "6", { topLayers: 6 }],
      ["bottomLayers", "calc.slicer.bottomLayers", "3", { bottomLayers: 3 }],
      [
        "layerHeightMm",
        "calc.slicer.layerHeightMm",
        "0.16",
        { layerHeightMm: 0.16 },
      ],
      [
        "printSpeedMmPerS",
        "calc.slicer.printSpeedMmPerS",
        "100",
        { printSpeedMmPerS: 100 },
      ],
    ])(
      "commits valid %s to the store (partial merge)",
      (_key, labelKey, typed, expected) => {
        const store = createMockStore();
        renderFields(store);

        fireEvent.change(screen.getByLabelText(labelKey), {
          target: { value: typed },
        });

        expect(store.setFdmSlicerProfile).toHaveBeenCalledTimes(1);
        expect(store.setFdmSlicerProfile).toHaveBeenCalledWith(expected);
      },
    );
  });

  describe("validation aligned to store sanitization", () => {
    // Espelha sanitizeFdmSlicerProfile: positivos > 0; contagens >= 0 inteiras.
    it.each([
      [
        "lineWidthMm",
        "calc.slicer.lineWidthMm",
        "-0.5",
        "calc.slicer.errorPositive",
      ],
      [
        "lineWidthMm",
        "calc.slicer.lineWidthMm",
        "0",
        "calc.slicer.errorPositive",
      ],
      [
        "layerHeightMm",
        "calc.slicer.layerHeightMm",
        "-0.2",
        "calc.slicer.errorPositive",
      ],
      [
        "printSpeedMmPerS",
        "calc.slicer.printSpeedMmPerS",
        "-30",
        "calc.slicer.errorPositive",
      ],
      ["wallCount", "calc.slicer.wallCount", "-1", "calc.slicer.errorCount"],
      ["topLayers", "calc.slicer.topLayers", "2.5", "calc.slicer.errorCount"],
      [
        "bottomLayers",
        "calc.slicer.bottomLayers",
        "-4",
        "calc.slicer.errorCount",
      ],
    ])(
      "rejects invalid %s: error message shown, nothing committed",
      (_key, labelKey, typed, errorKey) => {
        const store = createMockStore();
        renderFields(store);

        const input = screen.getByLabelText(labelKey);
        fireEvent.change(input, { target: { value: typed } });

        // Valor fora do domínio nunca chega à store (never propagate).
        expect(store.setFdmSlicerProfile).not.toHaveBeenCalled();
        // a11y: erro exposto via aria-invalid + role=alert (WCAG AA).
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(errorKey);
      },
    );

    it("keeps the last valid value on blur after an invalid draft", () => {
      const store = createMockStore({ wallCount: 3 });
      renderFields(store);

      const input = screen.getByLabelText("calc.slicer.wallCount");
      fireEvent.change(input, { target: { value: "" } });

      // Inválido (vazio): erro, sem commit.
      expect(store.setFdmSlicerProfile).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "calc.slicer.errorCount",
      );

      // Blur descarta o draft → volta ao último valor válido da store.
      fireEvent.blur(input);
      expect(input).toHaveValue(3);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("recovers when an invalid draft becomes valid mid-typing", () => {
      const store = createMockStore({ layerHeightMm: 0.2 });
      renderFields(store);

      const input = screen.getByLabelText("calc.slicer.layerHeightMm");

      fireEvent.change(input, { target: { value: "0" } });
      expect(store.setFdmSlicerProfile).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "calc.slicer.errorPositive",
      );

      fireEvent.change(input, { target: { value: "0.16" } });
      expect(store.setFdmSlicerProfile).toHaveBeenCalledWith({
        layerHeightMm: 0.16,
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("discards the stale draft when the store value changes externally", () => {
      // Simula reset/undo/histórico: a store muda por fora enquanto o
      // usuário digitava — o draft stale não pode sobreviver.
      const store = createMockStore({ wallCount: 2 });
      const { rerender } = renderFields(store);

      const input = screen.getByLabelText("calc.slicer.wallCount");
      fireEvent.change(input, { target: { value: "-9" } });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      const updated = createMockStore({ wallCount: 6 });
      rerender(
        <SlicerProfileFields
          store={updated}
          t={t}
          handleInput={handleInput}
          isFieldVisible={ALL_VISIBLE}
        />,
      );

      expect(input).toHaveValue(6);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("a11y (WCAG AA)", () => {
    it("exposes the group role with a labelled heading", () => {
      renderFields();

      const group = screen.getByRole("group");
      const labelledBy = group.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();

      const heading = screen.getByText("calc.slicerProfile");
      expect(heading.id).toBe(labelledBy);
    });

    it("associates each error with its input via aria-describedby", () => {
      renderFields();

      const input = screen.getByLabelText("calc.slicer.printSpeedMmPerS");
      fireEvent.change(input, { target: { value: "-10" } });

      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const alert = screen.getByRole("alert");
      expect(alert.id).toBe(describedBy);
    });
  });
});
