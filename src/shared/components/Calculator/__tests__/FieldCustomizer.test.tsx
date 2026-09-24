import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "@/shared/i18n/i18n";
import { FieldCustomizer } from "../FieldCustomizer";
import {
  FIELD_LABELS,
  INTERMEDIATE_FIELDS,
  SECTIONS,
  isFieldVisibleForLevel,
} from "../Calculator.constants";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";

const originalCalcLevel = useCalculatorStore.getState().calcLevel;
const originalHiddenFields = [...useCalculatorStore.getState().hiddenFields];
const originalFdmSales = useCalculatorStore.getState().fdmSales;

async function openCustomizer(): Promise<{
  user: ReturnType<typeof userEvent.setup>;
  trigger: HTMLElement;
}> {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", {
    name: i18n.t("calc.customizeFields"),
  });
  await user.click(trigger);
  return { user, trigger };
}

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
  useCalculatorStore.setState({ calcLevel: "advanced", hiddenFields: [] });
});

afterEach(async () => {
  await i18n.changeLanguage("pt-BR");
  useCalculatorStore.getState().setFdmSales(originalFdmSales);
  useCalculatorStore.setState({
    calcLevel: originalCalcLevel,
    hiddenFields: originalHiddenFields,
  });
});

describe("FieldCustomizer", () => {
  it("groups every customizable field from every section", async () => {
    render(<FieldCustomizer />);
    await openCustomizer();

    const fieldCount = Object.values(INTERMEDIATE_FIELDS).reduce(
      (total, fields) => total + fields.length,
      0,
    );
    expect(screen.getAllByRole("checkbox")).toHaveLength(fieldCount);

    for (const [sectionId, fields] of Object.entries(INTERMEDIATE_FIELDS)) {
      if (fields.length === 0) continue;
      const section = SECTIONS.find((item) => item.id === sectionId);
      expect(section).toBeDefined();
      const group = screen.getByRole("group", {
        name: i18n.t(section?.shortKey ?? ""),
      });
      expect(within(group).getAllByRole("checkbox")).toHaveLength(fields.length);
      for (const fieldId of fields) {
        expect(
          within(group).getByRole("checkbox", {
            name: i18n.t(FIELD_LABELS[fieldId] ?? fieldId),
          }),
        ).toBeInTheDocument();
      }
    }
  });

  it("opens by keyboard, focuses the first field, and Escape restores focus", async () => {
    render(<FieldCustomizer />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", {
      name: i18n.t("calc.customizeFields"),
    });

    trigger.focus();
    await user.keyboard("{Enter}");

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("checkbox")[0]).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("uses the shared visibility contract and updates hiddenFields through the public action", async () => {
    useCalculatorStore.setState({
      calcLevel: "intermediate",
      hiddenFields: ["material.density"],
    });
    render(<FieldCustomizer />);
    const { user } = await openCustomizer();

    const density = screen.getByRole("checkbox", {
      name: i18n.t("calc.density"),
    });
    expect(
      isFieldVisibleForLevel("intermediate", ["material.density"], "material", "density"),
    ).toBe(false);
    expect(density).not.toBeChecked();

    await user.click(density);

    expect(useCalculatorStore.getState().hiddenFields).toEqual([]);
    expect(density).toBeChecked();
  });

  it("does not show personalization controls in basic mode", () => {
    useCalculatorStore.setState({ calcLevel: "basic" });
    render(<FieldCustomizer />);

    expect(
      screen.queryByRole("button", { name: i18n.t("calc.customizeFields") }),
    ).not.toBeInTheDocument();
  });

  it("keeps the result contract intact while hiding a field and recalculating through a public setter", async () => {
    const before = useCalculatorStore.getState().results;
    expect(before).not.toBeNull();
    render(<FieldCustomizer />);
    const { user } = await openCustomizer();

    await user.click(
      screen.getByRole("checkbox", { name: i18n.t("calc.shipping") }),
    );

    const hiddenResult = useCalculatorStore.getState().results;
    expect(hiddenResult).not.toBeNull();
    expect(hiddenResult?.totalCost).toBe(before?.totalCost);

    useCalculatorStore.getState().setFdmSales({
      ...originalFdmSales,
      shippingCost: originalFdmSales.shippingCost + 10,
    });
    const changedResult = useCalculatorStore.getState().results;
    expect(changedResult?.totalCost).toBeGreaterThan(hiddenResult?.totalCost ?? 0);
  });

  it("keeps the accessible control and translated labels in en-US", async () => {
    await i18n.changeLanguage("en-US");
    render(<FieldCustomizer />);
    await openCustomizer();

    expect(
      screen.getByRole("button", { name: "Customize fields" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Shipping" }),
    ).toBeInTheDocument();
  });
});
