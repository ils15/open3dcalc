import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

/**
 * Mutable so a test can drive the disabled-section branch of the rail.
 * `vi.hoisted` because the mock factory is hoisted above the imports and would
 * otherwise read this binding in its temporal dead zone.
 */
const storeState = vi.hoisted(
  () =>
    ({
      calcLevel: "basic",
      activeTab: "fdm",
      enabledSections: {},
      hiddenFields: [],
    }) as Record<string, unknown>,
);

vi.mock("@/shared/stores/calculatorStore", () => ({
  useCalculatorStore: Object.assign(
    (selector?: (s: Record<string, unknown>) => unknown) =>
      selector ? selector(storeState) : storeState,
    { getState: () => storeState },
  ),
}));

vi.mock("zustand/react/shallow", () => ({
  useShallow: <T,>(selector: (state: T) => T) => selector,
}));

import { SectionNav } from "../SectionNav";
import { SectionHeader } from "../sections/SectionHeader";
import { Layers } from "lucide-react";

beforeEach(() => {
  storeState.calcLevel = "basic";
  storeState.enabledSections = {};
  storeState.activeTab = "fdm";
});

describe("numbered sections in the DOM", () => {
  it("numbers the nav items 1..N of the visible set and leaves results bare", () => {
    const { container } = render(
      <SectionNav activeSection="material" onSectionClick={() => {}} />,
    );

    const rail = Array.from(container.querySelectorAll("nav")).find((n) =>
      n.className.includes("w-[134px]"),
    )!;
    const items = Array.from(rail.querySelectorAll("button"));

    // "Rápido" = material, print, sales, results.
    const badges = items.map(
      (b) => within(b).queryByTestId("step-badge")?.textContent ?? null,
    );
    expect(badges).toEqual(["1", "2", "3", null]);

    // The last INPUT step is N of the visible set, not 10 of the full contract.
    expect(badges.filter(Boolean)).toHaveLength(3);
  });

  it("shows the numeral in the section heading too", () => {
    render(<SectionHeader Icon={Layers} title="calc.material" step={1} />);

    const badge = screen.getByTestId("step-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("1");
  });

  it("omits the heading numeral when the section is not a numbered step", () => {
    render(<SectionHeader Icon={Layers} title="calc.results" />);

    expect(screen.queryByTestId("step-badge")).not.toBeInTheDocument();
  });

  it("keeps the numeral out of the accessible name of a nav item", () => {
    render(<SectionNav activeSection="material" onSectionClick={() => {}} />);

    // The badge is aria-hidden precisely so the spoken name stays the label.
    // Were it exposed, this would read "1 Material".
    const material = screen.getAllByRole("button", {
      name: "calc.material",
    })[0];
    expect(material).toBeInTheDocument();
    expect(material).toHaveAccessibleName("calc.material");
  });

  it("keeps a disabled section's numeral, dimming it in place", () => {
    // "print" depends on SECTION_ENABLES["print"] = ["energy"]. With energy off
    // the section dims; the number must stay, because renumbering on a toggle
    // would move every later step under the user.
    storeState.calcLevel = "advanced";
    storeState.enabledSections = { energy: false, material: true };

    const { container } = render(
      <SectionNav activeSection="material" onSectionClick={() => {}} />,
    );
    const rail = Array.from(container.querySelectorAll("nav")).find((n) =>
      n.className.includes("w-[134px]"),
    )!;
    const print = Array.from(rail.querySelectorAll("button")).find((b) =>
      b.textContent.includes("calc.sectionShort.print"),
    )!;

    expect(print.className).toContain("opacity-50");
    expect(within(print).getByTestId("step-badge")).toHaveTextContent("2");
  });

  it("scrolls to the section and reports it when a numbered item is clicked", () => {
    storeState.calcLevel = "basic";
    storeState.enabledSections = {};
    const onSectionClick = vi.fn();
    render(
      <SectionNav activeSection="material" onSectionClick={onSectionClick} />,
    );

    // The desktop rail speaks the short key; the w-14 rail has no text and
    // falls back to the full label as its accessible name.
    const clicked = screen.getAllByRole("button", {
      name: "calc.sectionShort.sales",
    })[0];
    clicked.focus();
    expect(clicked).toHaveFocus();
    clicked.click();

    expect(onSectionClick).toHaveBeenCalledWith("sales");
  });

  it("keeps the tablet rail at its tested width and target size", () => {
    const { container } = render(
      <SectionNav activeSection="material" onSectionClick={() => {}} />,
    );

    const rail = Array.from(container.querySelectorAll("nav")).find((n) =>
      n.className.includes("w-14"),
    )!;
    // w-14 is pinned by TabletSectionNav.test.tsx; the numeral must fit inside
    // it rather than widen it.
    expect(rail.className).toContain("w-14");
    for (const button of Array.from(rail.querySelectorAll("button"))) {
      expect(button.className).toContain("min-h-[44px]");
    }
  });
});
