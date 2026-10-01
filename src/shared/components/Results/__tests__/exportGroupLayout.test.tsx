import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ExportActionsCard } from "../ExportActionsCard";

/**
 * The export group's layout contract: two stacked primaries and a tertiary pair.
 *
 * The group used to be a flat `grid-cols-2` holding three buttons, which left
 * "Exportar Cotação" alone on row 2 with half a cell empty beside it. The
 * prototype stacks its two primaries and gives the tertiary pair its own
 * two-column grid; this file pins that nesting so the orphan cannot come back
 * as a silent regression.
 *
 * These are structural assertions, deliberately: jsdom has no layout engine, so
 * "full width" is expressed as the grid span that produces it. The pixel proof
 * that the nesting costs no height lives in the measured suite, not here.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "pt-BR", language: "pt-BR" },
  }),
}));

vi.mock("@/shared/stores/demoModeStore", () => ({
  useDemoModeStore: Object.assign(
    (selector?: (s: { isActive: boolean }) => unknown) =>
      selector ? selector({ isActive: false }) : { isActive: false },
    { getState: () => ({ isActive: false }) },
  ),
}));

const TOKEN = (el: Element, token: string): boolean =>
  (el.className || "").toString().split(/\s+/).includes(token);

/** The outer group grid that carries the tutorial hook. */
const groupGrid = (container: HTMLElement): HTMLElement => {
  const grid = container.querySelector<HTMLElement>('[data-tutorial="export"]');
  if (!grid) throw new Error("export group grid not found");
  return grid;
};

/** The nested grid holding the tertiary pair. */
const tertiaryPair = (container: HTMLElement): HTMLElement => {
  const pair = container.querySelector<HTMLElement>(
    '[data-testid="export-tertiary"]',
  );
  if (!pair) throw new Error("tertiary pair not found");
  return pair;
};

describe("export group — two primaries over a tertiary pair", () => {
  it("gives the PDF primary the full width of the group", () => {
    render(<ExportActionsCard showSaveSettings={false} />);

    const pdf = screen.getByText("calc.exportPdf").closest("button");
    expect(pdf).not.toBeNull();
    expect(
      TOKEN(pdf as Element, "col-span-2"),
      "the primary must span both columns so it is the full width of the group",
    ).toBe(true);
  });

  it("nests the CSV and quote actions in a two-column grid of their own", () => {
    const { container } = render(
      <ExportActionsCard showSaveSettings={false} />,
    );

    const pair = tertiaryPair(container);
    expect(TOKEN(pair, "grid")).toBe(true);
    expect(TOKEN(pair, "grid-cols-2")).toBe(true);

    expect(
      pair.querySelector('[data-testid="export-tertiary-pair"]'),
    ).toBeNull();
    expect(
      [...pair.querySelectorAll("button")].map((b) =>
        (b.textContent || "").trim().replace(/\s+/g, " "),
      ),
    ).toEqual(["CSV", "results.exportQuote"]);
  });

  it("keeps the pair spanning the full group width so no cell is orphaned", () => {
    const { container } = render(
      <ExportActionsCard showSaveSettings={false} />,
    );

    expect(TOKEN(tertiaryPair(container), "col-span-2")).toBe(true);
  });

  it("leaves the PDF primary out of the tertiary pair", () => {
    const { container } = render(
      <ExportActionsCard showSaveSettings={false} />,
    );

    const pair = tertiaryPair(container);
    expect(pair.textContent).not.toContain("calc.exportPdf");
  });

  it("gives the group grid exactly two direct children when there is no save action", () => {
    const { container } = render(
      <ExportActionsCard showSaveSettings={false} />,
    );

    // primary + nested pair. A third sibling would be a new cell with no partner.
    expect(groupGrid(container).children.length).toBe(2);
  });

  it("pairs the save action with the primary instead of orphaning either", () => {
    const { container } = render(<ExportActionsCard />);

    const grid = groupGrid(container);
    // save + primary on row 1, the nested pair on row 2 — so the save variant
    // keeps the two-row height it has today.
    expect(grid.children.length).toBe(3);
    const pair = tertiaryPair(container);
    expect(pair.parentElement).toBe(grid);
    expect(pair.previousElementSibling?.tagName.toLowerCase()).toBe("button");
  });

  it("still renders the save action when asked for it", () => {
    render(<ExportActionsCard />);

    expect(screen.getByText("calc.saveSettings")).toBeInTheDocument();
  });
});
