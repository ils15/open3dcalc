import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilamentAssumptionsFields } from "../FilamentAssumptionsFields";
import type { CalculatorState } from "@/shared/stores/calculatorStore";
import { DEFAULT_FDM_FILAMENT } from "@/shared/stores/calculatorStore.defaults";

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
  filament: Partial<typeof DEFAULT_FDM_FILAMENT> = {},
): CalculatorState {
  return {
    fdmFilament: { ...DEFAULT_FDM_FILAMENT, ...filament },
    setFdmFilament: vi.fn(),
  } as unknown as CalculatorState;
}

function renderFields(
  store = createMockStore(),
  isFieldVisible: FieldVisible = ALL_VISIBLE,
) {
  return render(
    <FilamentAssumptionsFields
      store={store}
      t={t}
      handleInput={handleInput}
      isFieldVisible={isFieldVisible}
    />,
  );
}

describe("FilamentAssumptionsFields", () => {
  describe("level gating (advanced only)", () => {
    it("renders all three fields when visible (calcLevel advanced)", () => {
      renderFields();

      // Cabeçalho do grupo + tooltip do grupo
      expect(screen.getByText("calc.filamentProfile")).toBeInTheDocument();
      expect(screen.getByText("tooltip.filamentProfile")).toBeInTheDocument();

      for (const labelKey of [
        "calc.filament.purgePercent",
        "calc.filament.filamentDiameterMm",
        "calc.filament.maxVolumetricSpeedMm3PerS",
      ]) {
        expect(screen.getByLabelText(labelKey)).toBeInTheDocument();
      }
    });

    it("renders nothing when no field is visible (basic/intermediate)", () => {
      const { container } = renderFields(createMockStore(), NONE_VISIBLE);

      expect(container.firstChild).toBeNull();
      expect(
        screen.queryByText("calc.filamentProfile"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText("calc.filament.purgePercent"),
      ).not.toBeInTheDocument();
    });

    it("renders only the fields allowed by isFieldVisible", () => {
      renderFields(
        createMockStore(),
        (_section, field) => field === "filamentDiameterMm",
      );

      expect(
        screen.getByLabelText("calc.filament.filamentDiameterMm"),
      ).toBeInTheDocument();
      expect(
        screen.queryByLabelText("calc.filament.purgePercent"),
      ).not.toBeInTheDocument();
      expect(screen.queryAllByRole("spinbutton")).toHaveLength(1);
    });
  });

  describe("tooltips (i18n)", () => {
    it("renders a tooltip per field with the translated help text", () => {
      renderFields();

      for (const tooltipKey of [
        "tooltip.filamentPurgePercent",
        "tooltip.filamentDiameter",
        "tooltip.filamentMvs",
      ]) {
        expect(screen.getByText(tooltipKey)).toBeInTheDocument();
      }
    });
  });

  describe("units", () => {
    it("shows the unit suffix for each field", () => {
      renderFields();

      expect(screen.getByText("%")).toBeInTheDocument();
      expect(screen.getByText("mm")).toBeInTheDocument();
      expect(screen.getByText("mm³/s")).toBeInTheDocument();
    });
  });

  describe("MVS is optional (table fallback)", () => {
    it("renders the MVS input empty when there is no override", () => {
      renderFields();

      const input = screen.getByLabelText(
        "calc.filament.maxVolumetricSpeedMm3PerS",
      );
      // Campo opcional sem override = sem valor (jest-dom reporta `null`
      // para number vazio — é exatamente a semântica "ausente = tabela").
      expect(input).toHaveValue(null);
    });

    it("shows the table-fallback placeholder for MVS", () => {
      renderFields();

      const input = screen.getByLabelText(
        "calc.filament.maxVolumetricSpeedMm3PerS",
      );
      expect(input).toHaveAttribute(
        "placeholder",
        "calc.filament.mvsPlaceholder",
      );
    });

    it("commits undefined (clears the override) when MVS is emptied", () => {
      const store = createMockStore({ maxVolumetricSpeedMm3PerS: 20 });
      renderFields(store);

      const input = screen.getByLabelText(
        "calc.filament.maxVolumetricSpeedMm3PerS",
      );
      fireEvent.change(input, { target: { value: "" } });

      // Ausente = tabela (D-EA4): o override some, não vira 0.
      expect(store.setFdmFilament).toHaveBeenCalledWith({
        maxVolumetricSpeedMm3PerS: undefined,
      });
    });
  });

  describe("commit of valid values", () => {
    it.each([
      [
        "purgePercent",
        "calc.filament.purgePercent",
        "15",
        { purgePercent: 15 },
      ],
      [
        "purgePercent",
        "calc.filament.purgePercent",
        "12.5",
        { purgePercent: 12.5 },
      ],
      [
        "filamentDiameterMm",
        "calc.filament.filamentDiameterMm",
        "2.85",
        { filamentDiameterMm: 2.85 },
      ],
      [
        "maxVolumetricSpeedMm3PerS",
        "calc.filament.maxVolumetricSpeedMm3PerS",
        "24",
        { maxVolumetricSpeedMm3PerS: 24 },
      ],
    ])(
      "commits valid %s to the store (partial merge)",
      (_key, labelKey, typed, expected) => {
        const store = createMockStore();
        renderFields(store);

        fireEvent.change(screen.getByLabelText(labelKey), {
          target: { value: typed },
        });

        expect(store.setFdmFilament).toHaveBeenCalledTimes(1);
        expect(store.setFdmFilament).toHaveBeenCalledWith(expected);
      },
    );
  });

  describe("validation aligned to store sanitization", () => {
    // Espelha sanitizeFdmFilament: purgePercent >= 0 (fracionário ok);
    // diâmetro e MVS estritamente > 0 (divisão por r² / teto de vazão).
    it.each([
      [
        "purgePercent",
        "calc.filament.purgePercent",
        "-5",
        "calc.filament.errorNonNegative",
      ],
      [
        "filamentDiameterMm",
        "calc.filament.filamentDiameterMm",
        "0",
        "calc.filament.errorPositive",
      ],
      [
        "filamentDiameterMm",
        "calc.filament.filamentDiameterMm",
        "-1.75",
        "calc.filament.errorPositive",
      ],
      [
        "maxVolumetricSpeedMm3PerS",
        "calc.filament.maxVolumetricSpeedMm3PerS",
        "0",
        "calc.filament.errorPositive",
      ],
      [
        "maxVolumetricSpeedMm3PerS",
        "calc.filament.maxVolumetricSpeedMm3PerS",
        "-20",
        "calc.filament.errorPositive",
      ],
    ])(
      "rejects invalid %s: error message shown, nothing committed",
      (_key, labelKey, typed, errorKey) => {
        const store = createMockStore();
        renderFields(store);

        const input = screen.getByLabelText(labelKey);
        fireEvent.change(input, { target: { value: typed } });

        // Valor fora do domínio nunca chega à store (never propagate).
        expect(store.setFdmFilament).not.toHaveBeenCalled();
        // a11y: erro exposto via aria-invalid + role=alert (WCAG AA).
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(screen.getByRole("alert")).toHaveTextContent(errorKey);
      },
    );

    it("accepts purge zero (0 disables purge, not an error)", () => {
      const store = createMockStore({ purgePercent: 10 });
      renderFields(store);

      fireEvent.change(screen.getByLabelText("calc.filament.purgePercent"), {
        target: { value: "0" },
      });

      expect(store.setFdmFilament).toHaveBeenCalledWith({ purgePercent: 0 });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("keeps the last valid value on blur after an invalid draft", () => {
      const store = createMockStore({ filamentDiameterMm: 1.75 });
      renderFields(store);

      const input = screen.getByLabelText("calc.filament.filamentDiameterMm");
      fireEvent.change(input, { target: { value: "" } });

      // Inválido (vazio): erro, sem commit.
      expect(store.setFdmFilament).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "calc.filament.errorPositive",
      );

      // Blur descarta o draft → volta ao último valor válido da store.
      fireEvent.blur(input);
      expect(input).toHaveValue(1.75);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("recovers when an invalid draft becomes valid mid-typing", () => {
      const store = createMockStore({ purgePercent: 10 });
      renderFields(store);

      const input = screen.getByLabelText("calc.filament.purgePercent");

      fireEvent.change(input, { target: { value: "-" } });
      expect(store.setFdmFilament).not.toHaveBeenCalled();
      expect(screen.getByRole("alert")).toHaveTextContent(
        "calc.filament.errorNonNegative",
      );

      fireEvent.change(input, { target: { value: "8" } });
      expect(store.setFdmFilament).toHaveBeenCalledWith({ purgePercent: 8 });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("discards the stale draft when the store value changes externally", () => {
      // Simula reset/undo/histórico: a store muda por fora enquanto o
      // usuário digitava — o draft stale não pode sobreviver.
      const store = createMockStore({ purgePercent: 10 });
      const { rerender } = renderFields(store);

      const input = screen.getByLabelText("calc.filament.purgePercent");
      fireEvent.change(input, { target: { value: "-9" } });
      expect(screen.getByRole("alert")).toBeInTheDocument();

      const updated = createMockStore({ purgePercent: 5 });
      rerender(
        <FilamentAssumptionsFields
          store={updated}
          t={t}
          handleInput={handleInput}
          isFieldVisible={ALL_VISIBLE}
        />,
      );

      expect(input).toHaveValue(5);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("a11y (WCAG AA)", () => {
    it("exposes the group role with a labelled heading", () => {
      renderFields();

      const group = screen.getByRole("group");
      const labelledBy = group.getAttribute("aria-labelledby");
      expect(labelledBy).toBeTruthy();

      const heading = screen.getByText("calc.filamentProfile");
      expect(heading.id).toBe(labelledBy);
    });

    it("associates each error with its input via aria-describedby", () => {
      renderFields();

      const input = screen.getByLabelText("calc.filament.filamentDiameterMm");
      fireEvent.change(input, { target: { value: "-1" } });

      const describedBy = input.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      const alert = screen.getByRole("alert");
      expect(alert.id).toBe(describedBy);
    });
  });
});
