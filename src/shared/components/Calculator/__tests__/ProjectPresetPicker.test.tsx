import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";
import { materials } from "@/shared/lib/materials";
import { printers } from "@/shared/lib/printers";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { ProjectPresetPicker } from "../ProjectPresetPicker";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => {
      if (key.endsWith("exampleLabel")) return "Example";
      if (key.endsWith("demoLabel")) return "Cenário demonstrativo";
      if (key.endsWith("fields.reset")) return "Campos resetados";
      if (key.endsWith("fields.preserved")) return "Campos preservados";
      if (key.endsWith("fields.results")) return "Resultados recalculados";
      return options?.name ? `${key}:${options.name}` : key;
    },
  }),
}));

const resetCatalog = () => {
  useCatalogStore.setState({
    printers: printers.map((printer) => ({ ...printer })),
    materials: materials.map((material) => ({ ...material })),
  });
};

const applySelectedPreset = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "calc.projectPresets.fill" }),
  );
};

describe("ProjectPresetPicker", () => {
  beforeEach(() => {
    resetCatalog();
    useCalculatorStore.getState().resetCalculator();
    useCalculatorStore.setState({ history: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("mostra preview antes de substituir e apresenta o preço como cenário demonstrativo", () => {
    render(<ProjectPresetPicker />);

    expect(screen.getByTestId("project-preset-preview")).toBeInTheDocument();
    expect(screen.getByText("Campos resetados")).toBeInTheDocument();
    expect(screen.getByText("Campos preservados")).toBeInTheDocument();
    expect(screen.getByText("Resultados recalculados")).toBeInTheDocument();
    expect(screen.getByTestId("project-preset-demo-price")).toHaveTextContent(
      "Cenário demonstrativo",
    );
    expect(screen.getByTestId("project-preset-results-sell-price")).toHaveTextContent(
      "sellPrice",
    );
    expect(screen.getByTestId("project-preset-results-actual-margin")).toHaveTextContent(
      "actualMargin",
    );

    const before = useCalculatorStore.getState();
    applySelectedPreset();
    const after = useCalculatorStore.getState();
    expect(after.productName).toContain("Example");
    expect(after.fdmMaterial.type).toBe("PLA Silk");
    expect(after.results?.sellPrice).not.toBe(before.results?.sellPrice);
  });

  it("registra um único passo de undo e restaura o carretel", () => {
    useCalculatorStore.setState({ selectedSpoolId: "spool-before" });
    render(<ProjectPresetPicker />);
    const before = useCalculatorStore.getState();

    applySelectedPreset();
    const applied = useCalculatorStore.getState();
    expect(applied.history).toHaveLength(before.history.length + 1);
    expect(applied.selectedSpoolId).toBeNull();

    applied.undo();
    const undone = useCalculatorStore.getState();
    expect(undone.productName).toBe(before.productName);
    expect(undone.selectedSpoolId).toBe("spool-before");
    expect(undone.history).toHaveLength(before.history.length);
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

    applySelectedPreset();

    expect(confirm).toHaveBeenCalledWith(
      "calc.projectPresets.confirmOverwrite",
    );
    expect(useCalculatorStore.getState().productName).toBe("Cálculo existente");
    expect(button).toHaveFocus();

    confirm.mockReturnValue(true);
    applySelectedPreset();
    expect(useCalculatorStore.getState().productName).toContain("Example");
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
      "calc.projectPresets.applied",
    );
  });

  it("mostra feedback explícito quando o catálogo não pode ser resolvido", () => {
    useCatalogStore.setState({ printers: [] });
    render(<ProjectPresetPicker />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "calc.projectPresets.errors.missing-printer",
    );
    expect(
      screen.getByRole("button", { name: "calc.projectPresets.fill" }),
    ).toBeDisabled();
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
      "exampleLabel",
      "demoLabel",
      "previewTitle",
      "fields.reset",
      "fields.preserved",
      "fields.results",
    ] as const;
    const itemIds = [
      "spiral-vase",
      "reinforced-gopro-handlebar",
      "rpg-dragon-statue",
    ] as const;
    const errorKeys = [
      "missing-printer",
      "missing-material",
      "technology-mismatch",
      "provenance-mismatch",
      "unknown-schema",
      "incomplete-draft",
    ] as const;

    for (const locale of [ptBR, enUS]) {
      for (const key of scalarKeys) {
        const value = key
          .split(".")
          .reduce<unknown>((current, part) => (current as Record<string, unknown>)?.[part], locale.calc.projectPresets);
        expect(typeof value).toBe("string");
      }
      for (const id of itemIds) {
        expect(typeof locale.calc.projectPresets.items[id].name).toBe("string");
      }
      for (const key of errorKeys) {
        expect(typeof locale.calc.projectPresets.errors[key]).toBe("string");
      }
    }
  });

  it("provides explicit pt-BR and en-US incompatible-catalog feedback", () => {
    expect(ptBR.calc.projectPresets.errors["missing-printer"]).toMatch(/catálogo/i);
    expect(enUS.calc.projectPresets.errors["missing-printer"]).toMatch(/catalog/i);
    expect(ptBR.calc.projectPresets.demoLabel).toMatch(/cenário demonstrativo/i);
    expect(enUS.calc.projectPresets.demoLabel).toMatch(/demonstration scenario/i);
  });
});
