import { describe, expect, it, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AmsPurgePanel } from "../AmsPurgePanel";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

describe("AmsPurgePanel", () => {
  beforeEach(() => {
    useCalculatorStore.setState({
      fdmMaterial: {
        ...useCalculatorStore.getState().fdmMaterial,
        weightUsed: 50,
        costPerKg: 100,
      },
      quantity: 1,
    });
  });

  it("expands the multi-color simulator and applies diluted weight & batch quantity to calculatorStore", () => {
    render(<AmsPurgePanel />);

    const toggle = screen.getByRole("button", {
      name: /Simulador Multi-Cor/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    // Default: 80 changes * 0.65g = 52g purge + 12g prime tower = 64g waste
    expect(screen.getByText("64 g")).toBeInTheDocument();

    // Change batch quantity to 4
    const inputs = screen.getAllByRole("spinbutton");
    const batchInput = inputs[inputs.length - 1];
    fireEvent.change(batchInput, { target: { value: "4" } });

    // Diluted: 50g + 64g / 4 = 66g per unit
    const applyBtn = screen.getByRole("button", {
      name: /Aplicar 66g na Calculadora/i,
    });
    fireEvent.click(applyBtn);

    expect(useCalculatorStore.getState().fdmMaterial.weightUsed).toBe(66);
    expect(useCalculatorStore.getState().quantity).toBe(4);
    expect(screen.getByText(/Peso & Lote Aplicados!/i)).toBeInTheDocument();
  });
});
