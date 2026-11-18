import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudioProductsView } from "./StudioProductsView";
import { useProductInventory } from "@/shared/stores/productInventory";

describe("StudioProductsView v2.0.2 — Split Inspector Markup & Channels", () => {
  beforeEach(() => {
    useProductInventory.setState({ products: [] });
    useProductInventory.getState().addProduct({
      name: "Suporte Articulado",
      weightGrams: 120,
      filamentType: "PETG",
      costPrice: 20,
      salePrice: 40,
    });
  });

  it("opens Split Inspector with inline markup editor and channel simulation", () => {
    render(<StudioProductsView />);

    // Click the product row to open StudioSplitInspector
    fireEvent.click(screen.getByText("Suporte Articulado"));

    expect(screen.getByText(/Ajuste Rápido de Markup/i)).toBeInTheDocument();
    expect(screen.getByText(/Simulação por Canal/i)).toBeInTheDocument();

    // Select +150% markup shortcut -> preview sale price = 20 * 2.5 = 50
    fireEvent.click(screen.getByRole("button", { name: "+150%" }));
    const applyBtn = screen.getByRole("button", { name: /Aplicar/i });
    fireEvent.click(applyBtn);

    const updated = useProductInventory.getState().products[0];
    expect(updated.salePrice).toBe(50);
  });
});
