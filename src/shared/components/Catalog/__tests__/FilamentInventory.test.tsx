import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilamentInventory } from "../FilamentInventory";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

// Interpolation mock — mesmo padrão de OnboardingModal/ChangelogPage: tabela
// mínima inlined para que valores interpolados (tara auto, gramas necessárias)
// apareçam renderizados e possam ser assertidos.
const TRANSLATIONS: Record<string, string> = {
  "inventory.remaining": "Restante",
  "inventory.netRemaining": "Líquido restante",
  "inventory.netRemainingHint": "Peso atual menos a tara do carretel.",
  "inventory.tare": "Tara do carretel",
  "inventory.tareAuto": "Auto: {{tare}} g",
  "inventory.tareSourceNote": "Tara por marca de catálogo.",
  "inventory.coverageOk": "Cobre a peça",
  "inventory.coverageFail": "Não cobre a peça",
  "inventory.coverageNeeded": "Necessário: {{grams}} g",
  "inventory.coverageMargin": "Margem: {{margin}} g",
};

vi.mock("react-i18next", () => ({
  // useCurrency desestrutura i18n de useTranslation — precisa existir no mock.
  useTranslation: () => ({
    i18n: { language: "pt-BR" },
    t: (key: string, options?: Record<string, string | number>) => {
      let value = TRANSLATIONS[key] ?? key;
      if (options) {
        for (const [name, replacement] of Object.entries(options)) {
          value = value.replace(`{{${name}}}`, String(replacement));
        }
      }
      return value;
    },
  }),
}));

const addSpool = (overrides: Record<string, unknown> = {}): string => {
  useFilamentInventory.getState().addSpool({
    brand: "Bambu Lab",
    material: "PLA",
    color: "Azul Velvet",
    colorHex: "#1e40af",
    weightGrams: 1000,
    originalWeightGrams: 1000,
    costPerKg: 120,
    diameterMm: 1.75,
    notes: "",
    status: "in_stock",
    purchaseStore: "",
    ...overrides,
  } as never);
  const spools = useFilamentInventory.getState().spools;
  return spools[spools.length - 1].id;
};

/**
 * Define uma peça FDM ativa determinística: com spoolEfficiency 100% e sem
 * purge, `results.unitWeight` === weightUsed, e a necessidade da peça inteira
 * é unitWeight × quantity.
 */
const setFdmPart = (weightUsed: number, quantity = 2): void => {
  const api = useCalculatorStore.getState();
  api.setActiveTab("fdm");
  api.setFdmMaterial({
    type: "PLA",
    weightUsed,
    purgeWeight: 0,
    costPerKg: 125,
    density: 1.24,
    spoolEfficiency: 100,
  });
  api.setQuantity(quantity);
};

beforeEach(() => {
  localStorage.clear();
  useFilamentInventory.setState({ spools: [] });
  vi.restoreAllMocks();
});

describe("FilamentInventory remaining UI (Wave C / C1)", () => {
  it("renders net remaining grams and meters per spool", () => {
    // Bambu Lab → tara automática 210 g; 1000 g brutos − 210 = 790 g líquidos.
    const id = addSpool({ brand: "Bambu Lab", weightGrams: 1000 });
    render(<FilamentInventory />);

    const net = screen.getByTestId(`net-remaining-${id}`);
    expect(net).toHaveTextContent("790g");
    expect(net).toHaveTextContent(/m$/);
    // O bloco bruto permanece visível e intacto.
    expect(screen.getByText("1000g")).toBeInTheDocument();
  });

  it("respects a manual tare override stored on the spool", () => {
    const id = addSpool({
      brand: "Bambu Lab",
      weightGrams: 1000,
      tareGrams: 340,
    });
    render(<FilamentInventory />);

    expect(screen.getByTestId(`net-remaining-${id}`)).toHaveTextContent("660g");
  });

  it("prefills the tare placeholder from the brand table", () => {
    const id = addSpool({ brand: "Prusament" });
    render(<FilamentInventory />);

    expect(screen.getByTestId(`tare-input-${id}`)).toHaveAttribute(
      "placeholder",
      "Auto: 194 g",
    );
  });

  it("commits a typed tare on blur via updateSpool", async () => {
    const user = userEvent.setup();
    const id = addSpool({ brand: "Bambu Lab", weightGrams: 1000 });
    render(<FilamentInventory />);

    const input = screen.getByTestId(`tare-input-${id}`);
    await user.clear(input);
    await user.type(input, "250");
    fireEvent.blur(input);

    const stored = useFilamentInventory.getState().spools[0];
    expect(stored.tareGrams).toBe(250);
    // O líquido reage ao override recém-commitado: 1000 − 250 = 750 g.
    expect(screen.getByTestId(`net-remaining-${id}`)).toHaveTextContent("750g");
  });

  it("clearing the tare on blur removes the override", async () => {
    const user = userEvent.setup();
    const id = addSpool({
      brand: "Bambu Lab",
      weightGrams: 1000,
      tareGrams: 300,
    });
    render(<FilamentInventory />);

    const input = screen.getByTestId(`tare-input-${id}`);
    await user.clear(input);
    fireEvent.blur(input);

    expect(useFilamentInventory.getState().spools[0].tareGrams).toBeUndefined();
    // Sem override, volta a usar a tara da marca: 1000 − 210 = 790 g.
    expect(screen.getByTestId(`net-remaining-${id}`)).toHaveTextContent("790g");
  });

  it("shows an emerald or red coverage badge for the active part", () => {
    setFdmPart(200, 2); // necessidade = 200 g × 2 = 400 g
    const ok = addSpool({ brand: "Bambu Lab", weightGrams: 1000 }); // 790 g líquidos
    const notOk = addSpool({ brand: "Bambu Lab", weightGrams: 500 }); // 290 g líquidos
    render(<FilamentInventory />);

    expect(screen.getByTestId(`coverage-badge-${ok}`)).toHaveClass(
      "badge-emerald",
    );
    expect(screen.getByTestId(`coverage-badge-${ok}`)).toHaveTextContent(
      "Cobre a peça",
    );
    expect(screen.getByTestId(`coverage-badge-${notOk}`)).toHaveClass(
      "badge-red",
    );
    expect(screen.getByTestId(`coverage-badge-${notOk}`)).toHaveTextContent(
      "Não cobre a peça",
    );
    // Cada carretel mostra a necessidade da peça ativa (badge × 2).
    expect(screen.getAllByText("Necessário: 400 g")).toHaveLength(2);
  });

  it("hides the coverage badge when there is no active part", () => {
    setFdmPart(0, 2); // sem peça ativa → unitWeight 0
    const id = addSpool({ brand: "Bambu Lab", weightGrams: 1000 });
    render(<FilamentInventory />);

    expect(
      screen.queryByTestId(`coverage-badge-${id}`),
    ).not.toBeInTheDocument();
    // O líquido continua sendo exibido — só o badge de cobertura some.
    expect(screen.getByTestId(`net-remaining-${id}`)).toHaveTextContent("790g");
  });
});
