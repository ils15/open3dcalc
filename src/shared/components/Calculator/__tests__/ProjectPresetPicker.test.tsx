import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { ProjectPresetPicker } from "../ProjectPresetPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      options?.name ? `${key}:${options.name}` : key,
  }),
}));

const selectPreset = (id: string) => {
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: id },
  });
};

const applySelectedPreset = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "calc.projectPresets.fill" }),
  );
};

describe("ProjectPresetPicker", () => {
  beforeEach(() => {
    useCalculatorStore.getState().resetCalculator();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aplica o preset e atualiza o resultado em uma ação", () => {
    render(<ProjectPresetPicker />);
    const before = useCalculatorStore.getState();

    selectPreset("spiral-vase");
    applySelectedPreset();

    const after = useCalculatorStore.getState();
    expect(after.productName).toBe("calc.projectPresets.items.spiral-vase.name");
    expect(after.fdmMaterial.type).toBe("PLA Silk");
    expect(after.results).not.toBe(before.results);
    expect(after.results?.estimatedPrintTime).not.toBe(
      before.results?.estimatedPrintTime,
    );
  });

  it("registra um único passo de undo para o preenchimento atômico", () => {
    render(<ProjectPresetPicker />);
    const before = useCalculatorStore.getState();
    const historyLength = before.history.length;

    selectPreset("rpg-dragon-statue");
    applySelectedPreset();

    const applied = useCalculatorStore.getState();
    expect(applied.history).toHaveLength(historyLength + 1);
    applied.undo();

    const undone = useCalculatorStore.getState();
    expect(undone.productName).toBe(before.productName);
    expect(undone.fdmMaterial.type).toBe(before.fdmMaterial.type);
    expect(undone.history).toHaveLength(historyLength);
  });

  it("confirma antes de substituir um cálculo em andamento", () => {
    const store = useCalculatorStore.getState();
    store.setProductName("Cálculo existente");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ProjectPresetPicker />);
    const button = screen.getByRole("button", {
      name: "calc.projectPresets.fill",
    });
    button.focus();

    selectPreset("spiral-vase");
    applySelectedPreset();

    expect(confirm).toHaveBeenCalledWith(
      "calc.projectPresets.confirmOverwrite",
    );
    expect(useCalculatorStore.getState().productName).toBe("Cálculo existente");
    expect(button).toHaveFocus();

    confirm.mockReturnValue(true);
    applySelectedPreset();
    expect(useCalculatorStore.getState().productName).toBe(
      "calc.projectPresets.items.spiral-vase.name",
    );
  });

  it("mantém o foco no botão e anuncia a aplicação", () => {
    render(<ProjectPresetPicker />);
    const button = screen.getByRole("button", {
      name: "calc.projectPresets.fill",
    });
    button.focus();

    applySelectedPreset();

    expect(button).toHaveFocus();
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("status")).toHaveTextContent(
      "calc.projectPresets.applied:calc.projectPresets.items.spiral-vase.name",
    );
  });
});

describe("project preset locale parity", () => {
  it("mantém as mesmas chaves de projeto em pt-BR e en-US", () => {
    const scalarKeys = [
      "label",
      "selectLabel",
      "fill",
      "confirmOverwrite",
      "applied",
      "cancelled",
    ] as const;
    const itemIds = [
      "spiral-vase",
      "reinforced-gopro-handlebar",
      "rpg-dragon-statue",
    ] as const;

    for (const locale of [ptBR, enUS]) {
      for (const key of scalarKeys) {
        expect(typeof locale.calc.projectPresets[key]).toBe("string");
      }
      for (const id of itemIds) {
        expect(typeof locale.calc.projectPresets.items[id].name).toBe("string");
      }
    }
  });
});
