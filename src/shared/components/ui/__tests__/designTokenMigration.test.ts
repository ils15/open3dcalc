import fs from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const componentRoot = resolve(process.cwd(), "src/shared/components");

const migratedComponents = [
  "AppShell/Sidebar.tsx",
  "Header/Header.tsx",
  "Header/LayoutSwitcher.tsx",
  "ui/InputGroup.tsx",
  "ui/Select/Select.tsx",
  "Results/ProductActionsCard.tsx",
  "Results/ExportActionsCard.tsx",
  "Results/CostBreakdownCard.tsx",
  "Results/CostSummaryCard.tsx",
  "Results/HistoryCard.tsx",
  "Results/InventoryDeductionCard.tsx",
  "Results/PriceHeroCard.tsx",
  "Results/ProfitSummaryCard.tsx",
  "Results/ResultsPanel.tsx",
  "GuideDrawer/GuideDrawer.tsx",
] as const;

const paletteClassPattern =
  /(?:^|[\s"'`])(?:bg|text|border|ring|stroke|fill)-(?:black|white|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)(?:\/\d+)?(?:[\s"'`]|$)/;
const rawColorPattern = /#[0-9a-f]{3,8}\b|\brgba?\(/i;

function readComponent(relativePath: string): string {
  return fs.readFileSync(resolve(componentRoot, relativePath), "utf8");
}

function classNameExpressions(source: string): string {
  return Array.from(
    source.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)'|`([\s\S]*?)`)/g),
  )
    .map((match) => match[1] ?? match[2] ?? match[3] ?? "")
    .join("\n");
}

describe("design token migration guards", () => {
  it.each(migratedComponents)(
    "%s keeps UI colors token-backed in className",
    (relativePath) => {
      const source = readComponent(relativePath);
      const classes = classNameExpressions(source);

      expect(classes).not.toMatch(rawColorPattern);
      expect(classes).not.toMatch(paletteClassPattern);
    },
  );

  it("keeps the data-color exceptions separate from UI token classes", () => {
    const selectSource = readComponent("ui/Select/Select.tsx");
    const spoolThumbSource = fs.readFileSync(
      resolve(process.cwd(), "src/shared/components/SpoolShelf/SpoolThumb.tsx"),
      "utf8",
    );

    expect(selectSource).toContain("backgroundColor: selected.color");
    expect(selectSource).toContain("backgroundColor: opt.color");
    expect(spoolThumbSource).toContain('const FALLBACK_HEX = "#6366f1"');
  });
});
