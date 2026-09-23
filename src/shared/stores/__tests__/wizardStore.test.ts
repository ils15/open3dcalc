import { describe, it, expect, beforeEach } from "vitest";

import {
  useCalculatorStore,
  initialState,
} from "./calculatorStore.test-utils";
import { useLayoutStore } from "../layoutStore";
import {
  useWizardStore,
  WIZARD_TOTAL_STEPS,
  type WizardDraft,
} from "../wizardStore";
import { printers } from "@/shared/lib/printers";

/**
 * W4 — guided wizard store (unit).
 *
 * The wizard is a *collection surface* over the real calculator store: it holds
 * a transient draft (never persisted — see SPEC-01 gate) and commits it through
 * the existing public actions, so `result.totalCost` always comes from the real
 * calculation layer. These tests lock that contract.
 */

const VALID_DRAFT: WizardDraft = {
  productName: "Suporte para Fones",
  materialType: "PETG",
  weightGrams: 120,
  costPerKg: 130,
  quantity: 2,
  printerId: printers[0].id,
  printTimeHours: 4,
  energyCostPerKwh: 0.9,
  setupTimeMinutes: 15,
  postProcessingMinutes: 10,
  hourlyRate: 30,
  packagingCost: 5,
  profitMarginPercent: 40,
};

// NOTE: partial setState only (no `replace`). A `replace: true` here would drop
// `draft` and every action, leaving a 4-field shell — the store is a singleton
// whose actions are part of its state object.
function resetWizard(): void {
  useWizardStore.setState({
    step: 1,
    direction: "forward",
    errors: {},
    seeded: false,
  });
}

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState(initialState, true);
  useLayoutStore.setState({ layoutMode: "classic" });
  resetWizard();
});

describe("wizardStore — initial state", () => {
  it("starts on step 1 moving forward, unseeded", () => {
    const s = useWizardStore.getState();
    expect(s.step).toBe(1);
    expect(s.direction).toBe("forward");
    expect(s.seeded).toBe(false);
    expect(s.errors).toEqual({});
  });

  it("exposes a 4-step total", () => {
    expect(WIZARD_TOTAL_STEPS).toBe(4);
  });
});

describe("wizardStore — start (seeding)", () => {
  it("seeds the draft from the real calculator store", () => {
    useCalculatorStore.setState({
      productName: "Peça existente",
      quantity: 3,
      fdmMaterial: {
        ...useCalculatorStore.getState().fdmMaterial,
        type: "ABS",
        weightUsed: 77,
        costPerKg: 99,
      },
    });

    useWizardStore.getState().start();
    const draft = useWizardStore.getState().draft;

    expect(useWizardStore.getState().seeded).toBe(true);
    expect(draft.productName).toBe("Peça existente");
    expect(draft.quantity).toBe(3);
    expect(draft.materialType).toBe("ABS");
    expect(draft.weightGrams).toBe(77);
    expect(draft.costPerKg).toBe(99);
    expect(draft.printerId).toBe(
      useCalculatorStore.getState().selectedPrinter.id,
    );
    expect(draft.printTimeHours).toBe(
      useCalculatorStore.getState().fdmPrintParams.printTimeHours,
    );
    expect(draft.hourlyRate).toBe(
      useCalculatorStore.getState().fdmLabor.hourlyRate,
    );
    expect(draft.profitMarginPercent).toBe(
      useCalculatorStore.getState().fdmSales.profitMarginPercent,
    );
  });

  it("is idempotent — a second start keeps in-progress edits", () => {
    useWizardStore.getState().start();
    useWizardStore.getState().setField("weightGrams", 200);
    useCalculatorStore.setState({ quantity: 9 });

    useWizardStore.getState().start();

    expect(useWizardStore.getState().draft.weightGrams).toBe(200);
    expect(useWizardStore.getState().draft.quantity).not.toBe(9);
  });
});

describe("wizardStore — setField", () => {
  it("writes the draft and clears the field's error", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT },
      errors: { weightGrams: "positive" },
    });

    useWizardStore.getState().setField("weightGrams", 150);

    expect(useWizardStore.getState().draft.weightGrams).toBe(150);
    expect(useWizardStore.getState().errors.weightGrams).toBeUndefined();
  });
});

describe("wizardStore — validateStep", () => {
  it("accepts a valid step 1", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    expect(useWizardStore.getState().validateStep(1)).toBe(true);
    expect(useWizardStore.getState().errors).toEqual({});
  });

  it("rejects a non-positive weight on step 1", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, weightGrams: 0 },
    });
    expect(useWizardStore.getState().validateStep(1)).toBe(false);
    expect(useWizardStore.getState().errors.weightGrams).toBe("positive");
  });

  it("rejects a quantity below 1 on step 1", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, quantity: 0 },
    });
    expect(useWizardStore.getState().validateStep(1)).toBe(false);
    expect(useWizardStore.getState().errors.quantity).toBe("minQuantity");
  });

  it("rejects an empty material type on step 1", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, materialType: "" },
    });
    expect(useWizardStore.getState().validateStep(1)).toBe(false);
    expect(useWizardStore.getState().errors.materialType).toBe("required");
  });

  it("rejects non-positive print time on step 2", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, printTimeHours: 0 },
    });
    expect(useWizardStore.getState().validateStep(2)).toBe(false);
    expect(useWizardStore.getState().errors.printTimeHours).toBe("positive");
  });

  it("rejects an unknown printer on step 2", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, printerId: "no_such_printer" },
    });
    expect(useWizardStore.getState().validateStep(2)).toBe(false);
    expect(useWizardStore.getState().errors.printerId).toBe("required");
  });

  it("rejects a negative hourly rate on step 3", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, hourlyRate: -5 },
    });
    expect(useWizardStore.getState().validateStep(3)).toBe(false);
    expect(useWizardStore.getState().errors.hourlyRate).toBe("positive");
  });

  it("rejects a negative margin on step 3", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, profitMarginPercent: -1 },
    });
    expect(useWizardStore.getState().validateStep(3)).toBe(false);
    expect(useWizardStore.getState().errors.profitMarginPercent).toBe(
      "positive",
    );
  });

  it("step 4 (result) is always valid", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    expect(useWizardStore.getState().validateStep(4)).toBe(true);
  });
});

describe("wizardStore — next", () => {
  it("advances and commits the draft into the real calculator store", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });

    expect(useWizardStore.getState().next()).toBe(true);

    expect(useWizardStore.getState().step).toBe(2);
    expect(useWizardStore.getState().direction).toBe("forward");
    const calc = useCalculatorStore.getState();
    expect(calc.productName).toBe(VALID_DRAFT.productName);
    expect(calc.quantity).toBe(2);
    expect(calc.fdmMaterial.weightUsed).toBe(120);
    expect(calc.fdmMaterial.type).toBe("PETG");
    expect(calc.fdmMaterial.costPerKg).toBe(130);
    expect(calc.activeTab).toBe("fdm");
  });

  it("derives machine cost and power from the selected printer catalog entry", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    useWizardStore.getState().next();

    const calc = useCalculatorStore.getState();
    expect(calc.selectedPrinter.id).toBe(VALID_DRAFT.printerId);
    expect(calc.fdmPrintParams.printerPowerWatts).toBe(printers[0].power);
    expect(calc.fdmMachine.machineCost).toBe(printers[0].value);
  });

  it("blocks on an invalid step and keeps the calculator untouched", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, weightGrams: 0 },
    });
    const before = useCalculatorStore.getState().fdmMaterial.weightUsed;

    expect(useWizardStore.getState().next()).toBe(false);
    expect(useWizardStore.getState().step).toBe(1);
    expect(useCalculatorStore.getState().fdmMaterial.weightUsed).toBe(before);
  });

  it("does not advance past the last step", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT }, step: 4 });
    expect(useWizardStore.getState().next()).toBe(false);
    expect(useWizardStore.getState().step).toBe(4);
  });

  it("arriving at step 4 yields a real calculated result", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    useWizardStore.getState().next(); // 1 -> 2
    useWizardStore.getState().next(); // 2 -> 3
    useWizardStore.getState().next(); // 3 -> 4

    const results = useCalculatorStore.getState().results;
    expect(results).not.toBeNull();
    expect(results!.totalCost).toBeGreaterThan(0);
    expect(results!.sellPrice).toBeGreaterThanOrEqual(results!.totalCost);
  });
});

describe("wizardStore — prev", () => {
  it("decrements the step and marks the direction backward", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT }, step: 3 });

    useWizardStore.getState().prev();

    expect(useWizardStore.getState().step).toBe(2);
    expect(useWizardStore.getState().direction).toBe("backward");
  });

  it("clamps at step 1", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT }, step: 1 });
    useWizardStore.getState().prev();
    expect(useWizardStore.getState().step).toBe(1);
  });
});

describe("wizardStore — goTo", () => {
  it("allows jumping backward freely", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT }, step: 3 });
    useWizardStore.getState().goTo(1);
    expect(useWizardStore.getState().step).toBe(1);
  });

  it("allows jumping forward when every skipped step is valid", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    useWizardStore.getState().goTo(4);
    expect(useWizardStore.getState().step).toBe(4);
  });

  it("blocks a forward jump over an invalid step, landing on it with its error", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT, printTimeHours: 0 },
    });
    useWizardStore.getState().goTo(4);
    expect(useWizardStore.getState().step).toBe(2);
    expect(useWizardStore.getState().errors.printTimeHours).toBe("positive");
  });
});

describe("wizardStore — commit", () => {
  it("writes labor and sales through the existing public actions", () => {
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });
    useWizardStore.getState().commit();

    const calc = useCalculatorStore.getState();
    expect(calc.fdmLabor.setupTimeMinutes).toBe(15);
    expect(calc.fdmLabor.postProcessingTimeMinutes).toBe(10);
    expect(calc.fdmLabor.hourlyRate).toBe(30);
    expect(calc.fdmSales.packagingCost).toBe(5);
    expect(calc.fdmSales.profitMarginPercent).toBe(40);
  });
});

describe("wizardStore — finish / exit / reset", () => {
  it("finish commits and graduates the user to the classic layout", () => {
    useLayoutStore.setState({ layoutMode: "guided" });
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT }, step: 4 });

    useWizardStore.getState().finish();

    expect(useCalculatorStore.getState().productName).toBe(
      VALID_DRAFT.productName,
    );
    expect(useLayoutStore.getState().layoutMode).toBe("classic");
  });

  it("exit returns to the classic layout without touching the draft", () => {
    useLayoutStore.setState({ layoutMode: "guided" });
    useWizardStore.setState({ seeded: true, draft: { ...VALID_DRAFT } });

    useWizardStore.getState().exit();

    expect(useLayoutStore.getState().layoutMode).toBe("classic");
    expect(useWizardStore.getState().draft.weightGrams).toBe(120);
  });

  it("reset restores step 1 and forgets the seed", () => {
    useWizardStore.setState({
      seeded: true,
      draft: { ...VALID_DRAFT },
      step: 3,
      errors: { weightGrams: "positive" },
    });

    useWizardStore.getState().reset();

    const s = useWizardStore.getState();
    expect(s.step).toBe(1);
    expect(s.direction).toBe("forward");
    expect(s.seeded).toBe(false);
    expect(s.errors).toEqual({});
  });
});
