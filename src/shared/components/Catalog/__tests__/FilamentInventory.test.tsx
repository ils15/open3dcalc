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
  "inventory.newSpool": "Novo Rolo",
  "inventory.editSpool": "Editar Rolo",
  "inventory.saveSpool": "Salvar Rolo",
  "inventory.saveChanges": "Salvar Alterações",
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

describe("FilamentInventory CRUD, filters and palette", () => {
  const SEARCH_PLACEHOLDER = "Buscar cor, marca, material...";
  const overlay = (): HTMLElement =>
    document.querySelector(".fixed.inset-0.z-50") as HTMLElement;

  it("opens the add form with save disabled until the required fields are filled", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));

    const save = screen.getByRole("button", { name: "Salvar Rolo" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Cor"), "Verde");
    await user.type(screen.getByLabelText("Marca"), "eSun");
    await user.type(screen.getByLabelText("Peso (g)"), "750");

    expect(save).toBeEnabled();
  });

  it("saves a new spool with every form field and closes the form", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));
    await user.type(screen.getByLabelText("Cor"), "Verde");
    await user.type(screen.getByLabelText("Marca"), "eSun");
    await user.type(screen.getByLabelText("Peso (g)"), "750");
    await user.type(screen.getByLabelText("Custo/kg"), "120");
    await user.clear(screen.getByLabelText("Diametro"));
    await user.type(screen.getByLabelText("Diametro"), "2.85");
    await user.type(screen.getByLabelText("Notas"), "Lote de teste");
    await user.click(screen.getByRole("button", { name: "Salvar Rolo" }));

    const spools = useFilamentInventory.getState().spools;
    expect(spools).toHaveLength(1);
    expect(spools[0]).toMatchObject({
      brand: "eSun",
      color: "Verde",
      weightGrams: 750,
      originalWeightGrams: 750,
      costPerKg: 120,
      diameterMm: 2.85,
      notes: "Lote de teste",
      // Sem hex informado → resolveHex mapeia "Verde" → #22c55e.
      colorHex: "#22c55e",
    });
    expect(
      screen.queryByRole("button", { name: "Salvar Rolo" }),
    ).not.toBeInTheDocument();
  });

  it("resolves an unknown color name to the default indigo hex", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));
    await user.type(screen.getByLabelText("Cor"), "Berry");
    await user.type(screen.getByLabelText("Marca"), "eSun");
    await user.type(screen.getByLabelText("Peso (g)"), "500");
    await user.click(screen.getByRole("button", { name: "Salvar Rolo" }));

    expect(useFilamentInventory.getState().spools[0].colorHex).toBe("#6366f1");
  });

  it("commits a custom hex picked in the color input", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));
    const picker = document.querySelector('input[type="color"]') as HTMLElement;
    fireEvent.change(picker, { target: { value: "#aabbcc" } });

    await user.type(screen.getByLabelText("Cor"), "Berry");
    await user.type(screen.getByLabelText("Marca"), "eSun");
    await user.type(screen.getByLabelText("Peso (g)"), "500");
    await user.click(screen.getByRole("button", { name: "Salvar Rolo" }));

    expect(useFilamentInventory.getState().spools[0].colorHex).toBe("#aabbcc");
  });

  it("updates form selects (material, store and status) via combobox", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));

    await user.click(screen.getByRole("combobox", { name: "Material" }));
    await user.click(screen.getByRole("option", { name: "PETG" }));

    await user.click(screen.getByRole("combobox", { name: "Loja" }));
    await user.click(screen.getByRole("option", { name: "Amazon" }));

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(screen.getByRole("option", { name: "A caminho" }));

    await user.type(screen.getByLabelText("Cor"), "Verde");
    await user.type(screen.getByLabelText("Marca"), "eSun");
    await user.type(screen.getByLabelText("Peso (g)"), "500");
    await user.click(screen.getByRole("button", { name: "Salvar Rolo" }));

    expect(useFilamentInventory.getState().spools[0]).toMatchObject({
      material: "PETG",
      purchaseStore: "Amazon",
      status: "on_the_way",
    });
  });

  it("opens the edit form prefilled and saves via updateSpool", async () => {
    const user = userEvent.setup();
    const id = addSpool({
      brand: "Bambu Lab",
      color: "Azul Velvet",
      weightGrams: 900,
    });
    render(<FilamentInventory />);

    await user.click(screen.getByText("Editar"));

    expect(
      screen.getByRole("button", { name: "Salvar Alterações" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Marca")).toHaveValue("Bambu Lab");
    expect(screen.getByLabelText("Cor")).toHaveValue("Azul Velvet");

    await user.clear(screen.getByLabelText("Peso (g)"));
    await user.type(screen.getByLabelText("Peso (g)"), "500");
    await user.click(screen.getByRole("button", { name: "Salvar Alterações" }));

    const stored = useFilamentInventory.getState().spools[0];
    expect(stored.id).toBe(id);
    expect(stored.weightGrams).toBe(500);
    // O peso original vem do spool existente, não do campo.
    expect(stored.originalWeightGrams).toBe(1000);
  });

  it("removes a spool via the trash button", async () => {
    const user = userEvent.setup();
    addSpool({ brand: "Bambu Lab" });
    render(<FilamentInventory />);

    await user.click(screen.getByLabelText("Remover rolo"));

    expect(useFilamentInventory.getState().spools).toHaveLength(0);
    expect(
      screen.getByText(/Nenhum rolo cadastrado\. Clique em/),
    ).toBeInTheDocument();
  });

  it("closes the add form via backdrop and header X, keeping content clicks open", async () => {
    const user = userEvent.setup();
    render(<FilamentInventory />);

    await user.click(screen.getByText("Novo Rolo"));
    const formOverlay = overlay();
    expect(formOverlay).toBeInTheDocument();

    // Clique no corpo do modal não fecha (stopPropagation).
    fireEvent.click(formOverlay.querySelector(".surface") as HTMLElement);
    expect(
      screen.getByRole("button", { name: "Salvar Rolo" }),
    ).toBeInTheDocument();

    // Botão X fecha.
    await user.click(
      formOverlay.querySelector('button[class*="w-8 h-8"]') as HTMLElement,
    );
    expect(
      screen.queryByRole("button", { name: "Salvar Rolo" }),
    ).not.toBeInTheDocument();

    // Backdrop fecha.
    await user.click(screen.getByText("Novo Rolo"));
    fireEvent.click(overlay());
    expect(
      screen.queryByRole("button", { name: "Salvar Rolo" }),
    ).not.toBeInTheDocument();
  });

  it("filters spools by search text and clears the filter", async () => {
    const user = userEvent.setup();
    addSpool({ brand: "Bambu Lab", color: "Azul Velvet" });
    addSpool({ brand: "eSun", color: "Verde" });
    render(<FilamentInventory />);

    const search = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
    await user.type(search, "esun");

    expect(screen.getByText(/eSun/)).toBeInTheDocument();
    expect(screen.queryByText(/Bambu Lab/)).not.toBeInTheDocument();

    // Botão de limpar (X) reseta a busca.
    await user.click(search.parentElement!.querySelector("button")!);
    expect(screen.getByText(/Bambu Lab/)).toBeInTheDocument();
  });

  it("shows the empty state when no spool matches the filters", async () => {
    const user = userEvent.setup();
    addSpool({ brand: "Bambu Lab" });
    render(<FilamentInventory />);

    await user.type(
      screen.getByPlaceholderText(SEARCH_PLACEHOLDER),
      "inexistente",
    );

    expect(
      screen.getByText("Nenhum rolo encontrado com esses filtros."),
    ).toBeInTheDocument();
  });

  it("filters by material chip, including the Outro (non-main) bucket", async () => {
    const user = userEvent.setup();
    addSpool({ brand: "MarcaA", material: "PLA" });
    addSpool({ brand: "MarcaB", material: "Nylon" });
    render(<FilamentInventory />);

    await user.click(screen.getByRole("button", { name: "PLA" }));
    expect(screen.getByText(/MarcaA/)).toBeInTheDocument();
    expect(screen.queryByText(/MarcaB/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Outro" }));
    expect(screen.getByText(/MarcaB/)).toBeInTheDocument();
    expect(screen.queryByText(/MarcaA/)).not.toBeInTheDocument();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    addSpool({ brand: "MarcaA", status: "in_stock" });
    addSpool({ brand: "MarcaB", status: "empty", weightGrams: 0 });
    render(<FilamentInventory />);

    await user.click(screen.getByRole("button", { name: "Vazio" }));

    expect(screen.getByText(/MarcaB/)).toBeInTheDocument();
    expect(screen.queryByText(/MarcaA/)).not.toBeInTheDocument();
  });

  it("opens the palette empty and with swatches, closing via backdrop and X", async () => {
    const user = userEvent.setup();

    // Paleta vazia.
    render(<FilamentInventory />);
    await user.click(screen.getByText("Paleta de Cores"));
    expect(screen.getByText("Nenhum rolo cadastrado.")).toBeInTheDocument();
    fireEvent.click(overlay());
    expect(
      screen.queryByText("Nenhum rolo cadastrado."),
    ).not.toBeInTheDocument();
  });

  it("renders palette swatches and closes via the X button", async () => {
    const user = userEvent.setup();
    addSpool({ color: "Verde", colorHex: "" });
    render(<FilamentInventory />);

    await user.click(screen.getByText("Paleta de Cores"));
    const paletteOverlay = overlay();
    expect(paletteOverlay).toBeInTheDocument();

    // Clique no corpo não fecha (stopPropagation).
    fireEvent.click(paletteOverlay.querySelector(".surface") as HTMLElement);
    expect(paletteOverlay).toBeInTheDocument();

    await user.click(
      paletteOverlay.querySelector('button[class*="w-8 h-8"]') as HTMLElement,
    );
    expect(overlay()).not.toBeInTheDocument();
  });
});
