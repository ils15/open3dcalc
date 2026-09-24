import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BentoField } from "../BentoField";

describe("BentoField", () => {
  it("renders a labelled numeric input with visible affixes and a described helper", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <BentoField
        label="Peso da peça"
        value={125.5}
        onChange={onChange}
        type="number"
        unit="g"
        prefix="R$"
        helper="Use o valor do fatiador."
      />,
    );

    const input = screen.getByRole("spinbutton", { name: "Peso da peça" });
    expect(input).toHaveValue(125.5);
    expect(input).toHaveAttribute("aria-label", "Peso da peça");
    expect(input).toHaveAttribute("aria-describedby");
    expect(screen.getByText("R$")).toBeVisible();
    expect(screen.getByText("g")).toBeVisible();
    expect(screen.getByText("Use o valor do fatiador.")).toBeVisible();

    await user.tab();
    expect(input).toHaveFocus();
  });

  it("renders a labelled select when options are supplied and forwards its value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <BentoField
        label="Tipo de filamento"
        value="PLA"
        onChange={onChange}
        options={[
          { label: "PLA", value: "PLA" },
          { label: "PETG", value: "PETG" },
        ]}
        helper="Escolha o material da peça."
      />,
    );

    const select = screen.getByRole("combobox", { name: "Tipo de filamento" });
    expect(select).toHaveValue("PLA");
    expect(select).toHaveAttribute("aria-describedby");

    await user.selectOptions(select, "PETG");
    expect(onChange).toHaveBeenCalledWith("PETG");
  });
});
