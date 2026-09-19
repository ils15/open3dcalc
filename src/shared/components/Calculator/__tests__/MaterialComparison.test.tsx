import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MaterialComparison } from "../MaterialComparison";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useCatalogStore } from "@/shared/stores/catalogStore";
import { INVALID_MATERIAL_NAME } from "@/shared/lib/compareMaterials";
import type { Material } from "@/shared/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && typeof opts.rate === "number") return `${key}:${opts.rate}`;
      return key;
    },
    i18n: { language: "pt-BR", resolvedLanguage: "pt-BR" },
  }),
}));

vi.mock("@/shared/hooks/useCurrency", () => ({
  useCurrency: () => ({
    currency: "BRL",
    symbol: "R$",
    format: (v: number) => `R$ ${v.toFixed(2)}`,
  }),
}));

/** Catálogo de teste: 3 FDM válidos + 1 quebrado (sem densidade/preço). */
const CATALOG_MATERIALS: Material[] = [
  { id: "pla", name: "PLA", density: 1.24, avgPrice: 90, type: "fdm" },
  { id: "petg", name: "PETG", density: 1.27, avgPrice: 110, type: "fdm" },
  { id: "abs", name: "ABS", density: 1.04, avgPrice: 100, type: "fdm" },
  { id: "broken", name: "Broken", density: 0, avgPrice: 0, type: "fdm" },
  {
    id: "resin-1",
    name: "Resina Standard",
    density: 1.1,
    avgPrice: 180,
    type: "resin",
  },
];

/**
 * volume = 50 cm³ → PLA 62 g (R$ 5,58) · PETG 63,5 g (R$ 6,99) · ABS 52 g
 * (R$ 5,20, o mais barato). "Broken" cai no final como inválido.
 */
function seed(overrides: Record<string, unknown> = {}) {
  useCalculatorStore.setState({
    activeTab: "fdm",
    quantity: 1,
    fdmMaterial: {
      type: "PLA",
      weightUsed: 62,
      purgeWeight: 0,
      costPerKg: 90,
      density: 1.24,
      spoolEfficiency: 100,
    },
    fdmPrintParams: {
      printTimeHours: 1,
      printerPowerWatts: 100,
      energyCostPerKwh: 1,
      failureMode: "none",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 0,
    },
    resinMaterial: {
      type: "standard",
      volumeUsedMl: 50,
      costPerLiter: 180,
      density: 1.1,
      wasteMarginPercent: 0,
    },
    resinPrintParams: {
      printTimeHours: 1,
      printerPowerWatts: 100,
      energyCostPerKwh: 1,
      failureMode: "none",
      failureValue: 0,
      riskMultiplier: 1,
      heatUpTimeMinutes: 0,
      heatUpPowerPercent: 0,
    },
    ...overrides,
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useCatalogStore.setState({ materials: CATALOG_MATERIALS });
}

function openTable() {
  const toggle = screen.getByTestId("material-comparison-toggle");
  return userEvent.click(toggle);
}

function rowNames(): string[] {
  return screen
    .getAllByTestId("material-comparison-row")
    .map((row) => within(row).getAllByRole("cell")[1].textContent ?? "");
}

function rowCosts(): string[] {
  return screen
    .getAllByTestId("material-comparison-row")
    .map((row) => within(row).getAllByRole("cell")[4].textContent ?? "");
}

describe("MaterialComparison", () => {
  beforeEach(() => {
    seed();
  });

  it("starts collapsed and expands on toggle click", async () => {
    render(<MaterialComparison />);
    expect(
      screen.queryByTestId("material-comparison-row"),
    ).not.toBeInTheDocument();
    await openTable();
    expect(screen.getAllByTestId("material-comparison-row")).toHaveLength(4);
  });

  it("renders only FDM materials, sorted by part cost ascending", async () => {
    render(<MaterialComparison />);
    await openTable();
    // 3 FDM válidos + 1 FDM inválido; a resina fica de fora.
    expect(rowNames()).toEqual(["ABS", "PLA", "PETG", INVALID_MATERIAL_NAME]);
    expect(rowCosts()[0]).toBe("R$ 5.20");
  });

  it("toggles sort direction when the cost header is clicked", async () => {
    render(<MaterialComparison />);
    await openTable();
    const user = userEvent.setup();
    expect(rowNames()).toEqual(["ABS", "PLA", "PETG", INVALID_MATERIAL_NAME]);
    await user.click(screen.getByTestId("material-comparison-sort"));
    expect(rowNames()).toEqual(["PETG", "PLA", "ABS", INVALID_MATERIAL_NAME]);
    await user.click(screen.getByTestId("material-comparison-sort"));
    expect(rowNames()).toEqual(["ABS", "PLA", "PETG", INVALID_MATERIAL_NAME]);
  });

  it("marks the current material row and only it", async () => {
    render(<MaterialComparison />);
    await openTable();
    const rows = screen.getAllByTestId("material-comparison-row");
    const current = rows.filter((r) => r.dataset.current === "true");
    const others = rows.filter((r) => r.dataset.current === "false");
    expect(current).toHaveLength(1);
    expect(within(current[0]).getAllByRole("cell")[1].textContent).toBe("PLA");
    expect(others).toHaveLength(3);
  });

  it("renders the invalid marker on broken rows", async () => {
    render(<MaterialComparison />);
    await openTable();
    const rows = screen.getAllByTestId("material-comparison-row");
    const broken = rows[3];
    expect(within(broken).getAllByRole("cell")[1].textContent).toBe(
      INVALID_MATERIAL_NAME,
    );
    expect(within(broken).getAllByRole("cell")[4].textContent).toBe(
      INVALID_MATERIAL_NAME,
    );
  });

  it("shows the empty state when the part has no volume/weight", async () => {
    seed({
      fdmMaterial: {
        type: "PLA",
        weightUsed: 0,
        purgeWeight: 0,
        costPerKg: 90,
        density: 1.24,
        spoolEfficiency: 100,
      },
    });
    render(<MaterialComparison />);
    await openTable();
    expect(screen.getByTestId("material-comparison-empty")).toHaveTextContent(
      "comparison.empty",
    );
    expect(
      screen.queryByTestId("material-comparison-row"),
    ).not.toBeInTheDocument();
  });

  it("shows the resin-not-comparable note in resin mode", async () => {
    seed({ activeTab: "resin" });
    render(<MaterialComparison />);
    await openTable();
    expect(screen.getByText("comparison.resinNotComparable")).toBeVisible();
  });

  it("omits the failure-rate note when no global percent rate is set", async () => {
    render(<MaterialComparison />);
    await openTable();
    expect(
      screen.queryByTestId("material-comparison-failure-note"),
    ).not.toBeInTheDocument();
  });

  it("shows the failure-rate note when a global percent rate is set", async () => {
    seed({
      fdmPrintParams: {
        printTimeHours: 1,
        printerPowerWatts: 100,
        energyCostPerKwh: 1,
        failureMode: "percent",
        failureValue: 10,
        riskMultiplier: 1,
        heatUpTimeMinutes: 0,
        heatUpPowerPercent: 0,
      },
    });
    render(<MaterialComparison />);
    await openTable();
    expect(
      screen.getByTestId("material-comparison-failure-note"),
    ).toHaveTextContent("comparison.failureRateNote:10");
  });
});
