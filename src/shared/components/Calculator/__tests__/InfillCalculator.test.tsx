import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InfillCalculator } from "../InfillCalculator";

// D2: InfillCalculator had ~15 hardcoded PT strings and only one `t()` call.
// Returning raw keys lets the suite assert i18n usage instead of PT literals.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    currency: "BRL",
    symbol: "R$",
    format: (val: number) => `R$ ${val.toFixed(2)}`,
  }),
}));

describe("InfillCalculator", () => {
  it("renders the heading and subtitle via i18n keys", () => {
    render(<InfillCalculator />);
    expect(screen.getByText("infillCalculator.title")).toBeInTheDocument();
    expect(screen.getByText("infillCalculator.subtitle")).toBeInTheDocument();
  });

  it("labels every input through i18n keys", () => {
    render(<InfillCalculator />);
    for (const key of [
      "infillCalculator.dimensions",
      "infillCalculator.width",
      "infillCalculator.depth",
      "infillCalculator.height",
      "infillCalculator.wallThickness",
      "infillCalculator.topBottomLayers",
      "infillCalculator.layerHeight",
      "infillCalculator.material",
      "infillCalculator.infillPercent",
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it("labels the result cards through i18n keys", () => {
    render(<InfillCalculator />);
    expect(
      screen.getByText("infillCalculator.estimatedWeight"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("infillCalculator.materialCost"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("infillCalculator.solidVolume"),
    ).toBeInTheDocument();
  });

  it("labels the comparison table through i18n keys", () => {
    render(<InfillCalculator />);
    expect(screen.getByText("infillCalculator.comparison")).toBeInTheDocument();
    expect(screen.getByText("infillCalculator.colInfill")).toBeInTheDocument();
    expect(screen.getByText("infillCalculator.colWeight")).toBeInTheDocument();
    expect(screen.getByText("infillCalculator.colCost")).toBeInTheDocument();
    expect(
      screen.getByText("infillCalculator.colDifference"),
    ).toBeInTheDocument();
  });

  it("renders no hardcoded Portuguese literal (D2 leak guard)", () => {
    const { container } = render(<InfillCalculator />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(
      /Dimensões|Largura|Profundidade|Altura|Espessura Parede|Camadas Topo|Peso Estimado|Custo Material|Volume Sólido|Comparação de Infill|Diferença/,
    );
  });
});
