import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

import { ExportActionsCard } from "../ExportActionsCard";
import { ProductActionsCard } from "../ProductActionsCard";
import { SaveSettingsAction } from "../SaveSettingsAction";
import { useCalculatorStore } from "@/shared/stores/calculatorStore";
import { useFilamentInventory } from "@/shared/stores/filamentInventory";
import { useProductInventory } from "@/shared/stores/productInventory";
import type { CalculationResult } from "@/shared/types";

/**
 * The prototype's compact button rhythm, guarded against a touch-target
 * regression.
 *
 * `Example/EnhancedClassicLayout.tsx` gets its density from a 4px radius and
 * `py-1`/`py-2` padding. That padding is NOT portable: the app renders these
 * controls at `min-h-[44px]` for WCAG 2.5.8, and the prototype's secondary
 * buttons measure ~26-30px. Adopting the prototype's padding wholesale would
 * have silently dropped real tap targets.
 *
 * So the rhythm is split in two, and this file pins the split:
 *   - PRIMARY (a filled accent/positive action) keeps the 44px target. Only its
 *     radius and type scale change.
 *   - SECONDARY (outline, ghost, chips) may compress, but never under 32px.
 *   - ICON controls keep their declared `min-h`/`min-w` untouched.
 *
 * A failing assertion here means either the rhythm drifted back to `rounded-xl`,
 * or — the one that actually matters — a control lost its tap target.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

const mockDemo = { isActive: false, enter: vi.fn(), exit: vi.fn() };
vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(
    (selector?: (s: typeof mockDemo) => unknown) =>
      selector ? selector(mockDemo) : mockDemo,
    { getState: () => mockDemo },
  ),
}));

/** WCAG 2.5.8 target the app renders today; primary controls must keep it. */
const PRIMARY_TARGET_PX = 44;
/** Floor for a secondary control. Below this a tap target is not credible. */
const SECONDARY_FLOOR_PX = 32;

const baseResults = {
  materialCost: 10,
  energyCost: 2,
  machineCost: 3,
  hardwareCost: 1,
  consumablesCost: 1,
  laborCost: 20,
  softwareCost: 1,
  failureCost: 0,
  extrasCost: 2,
  postProcessingCost: 0,
  subtotal: 40,
  totalCost: 60,
  sellPrice: 105.88,
  profit: 30,
  marketplaceFee: 5.29,
  taxAmount: 10.59,
  costPerGram: 0.1,
  costPerUnit: 60,
  unitWeight: 85,
  estimatedPrintTime: 5,
  targetMarginPercent: 50,
  breakEvenPrice: 60,
  actualMargin: 28.33,
  carbonFootprintGrams: 100,
  profitPerHour: 6,
  totalHoursForProfit: 5,
} as CalculationResult;

beforeEach(() => {
  localStorage.clear();
  useCalculatorStore.setState({
    activeTab: "fdm",
    productName: "Vaso Teste",
    quantity: 1,
    results: { ...baseResults },
  } as Partial<ReturnType<typeof useCalculatorStore.getState>>);
  useFilamentInventory.setState({ spools: [] } as never);
  useProductInventory.setState({ products: [] } as never);
  mockDemo.isActive = false;
});

/** A filled accent/positive background marks the highlighted action. */
const isPrimary = (cls: string): boolean =>
  cls.includes("bg-[var(--accent)]") || cls.includes("bg-[var(--positive)]");

const label = (el: Element): string =>
  (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) ||
  el.getAttribute("aria-label") ||
  "(icon)";

/** Pulls the declared px floor out of a `min-h-[Npx]` utility. */
const minHeightOf = (cls: string): number | null => {
  const m = cls.match(/(?:^|\s)min-h-\[(\d+)px\](?=\s|$)/);
  return m ? Number(m[1]) : null;
};

interface Case {
  readonly name: string;
  readonly render: () => HTMLElement;
}

const cases: Case[] = [
  {
    name: "ExportActionsCard",
    render: () => render(<ExportActionsCard />).container,
  },
  {
    name: "ProductActionsCard",
    render: () =>
      render(<ProductActionsCard displaySellPrice={105.88} />).container,
  },
  {
    name: "SaveSettingsAction",
    render: () => render(<SaveSettingsAction />).container,
  },
];

describe("compact action rhythm", () => {
  describe.each(cases)("$name", ({ render: mount }) => {
    it("keeps every control at or above the 32px secondary floor", () => {
      const buttons = [...mount().querySelectorAll("button")];
      expect(buttons.length).toBeGreaterThan(0);

      const under = buttons
        .map((b) => ({ b, floor: minHeightOf(b.className) }))
        .filter(({ floor }) => floor === null || floor < SECONDARY_FLOOR_PX)
        .map(
          ({ b, floor }) => `"${label(b)}" declares min-h ${floor ?? "none"}px`,
        );

      expect(
        under,
        `${under.length} control(s) below the ${SECONDARY_FLOOR_PX}px tap-target floor`,
      ).toEqual([]);
    });

    it("keeps the 44px target on the highlighted primary action", () => {
      const primaries = [...mount().querySelectorAll("button")].filter((b) =>
        isPrimary(b.className),
      );
      expect(primaries.length).toBeGreaterThan(0);

      const weakened = primaries
        .map((b) => ({ b, floor: minHeightOf(b.className) }))
        .filter(({ floor }) => floor !== PRIMARY_TARGET_PX)
        .map(
          ({ b, floor }) =>
            `"${label(b)}" is primary but declares min-h ${floor ?? "none"}px, expected ${PRIMARY_TARGET_PX}px`,
        );

      expect(
        weakened,
        "primary actions may change radius and type scale, never their 44px target",
      ).toEqual([]);
    });

    it("uses the 4px prototype radius rather than rounded-xl", () => {
      const buttons = [...mount().querySelectorAll("button")];
      const wide = buttons
        .map((b) => ({ b, tokens: b.className.split(/\s+/) }))
        .filter(({ tokens }) =>
          tokens.some((t) =>
            ["rounded-xl", "rounded-lg", "rounded-md"].includes(t),
          ),
        )
        .map(({ b }) => `"${label(b)}"`);

      expect(wide, `still on a wide radius: ${wide.join(", ")}`).toEqual([]);
      buttons.forEach((b) => {
        expect(
          b.className.split(/\s+/),
          `"${label(b)}" must declare rounded`,
        ).toContain("rounded");
      });
    });

    it("sets the compact type scale", () => {
      const buttons = [...mount().querySelectorAll("button")];
      buttons.forEach((b) => {
        const tokens = b.className.split(/\s+/);
        expect(tokens, `"${label(b)}" must use text-xs`).toContain("text-xs");
        expect(tokens, `"${label(b)}" must use font-semibold`).toContain(
          "font-semibold",
        );
      });
    });
  });
});
