import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MakerToolboxView } from "../MakerToolboxView";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";

describe("MakerToolboxView", () => {
  beforeEach(() => {
    useFilamentInventory.setState({
      spools: [
        {
          id: "spool-bambu-1",
          brand: "Bambu Lab",
          material: "PLA",
          color: "Preto",
          colorHex: "#111111",
          weightGrams: 1000,
          originalWeightGrams: 1000,
          costPerKg: 120,
          diameterMm: 1.75,
          dateAdded: Date.now(),
          notes: "",
          status: "in_stock",
          purchaseStore: "",
        },
      ],
    });
  });

  it("renders Hole Tolerance & Heat-Set Inserts, Spool Scale Checker, and Volumetric Flow Rate", () => {
    render(<MakerToolboxView />);

    expect(
      screen.getByText(/Folga de Furos, Pinos & Insertos Térmicos/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/M3/i)).toBeInTheDocument();
    expect(screen.getByText("4.0 mm")).toBeInTheDocument();
    expect(
      screen.getByText(/Balança de Carretel \(Tara por Marca → Estoque\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Calibrador de Vazão Volumétrica/i),
    ).toBeInTheDocument();
  });

  it("updates spool stock weight from Kitchen Scale Spool Checker", () => {
    render(<MakerToolboxView />);

    const spoolSelect = screen.getByLabelText(/Carretel do Meu Estoque/i);
    fireEvent.change(spoolSelect, { target: { value: "spool-bambu-1" } });

    // Default grossScaleGrams = 680, Bambu Lab tare = 210 => net = 470g
    expect(screen.getByText("470 g")).toBeInTheDocument();

    const updateBtn = screen.getByRole("button", {
      name: /Atualizar Peso no Estoque/i,
    });
    fireEvent.click(updateBtn);

    const updated = useFilamentInventory
      .getState()
      .spools.find((s) => s.id === "spool-bambu-1");
    expect(updated?.weightGrams).toBe(470);
  });
});
