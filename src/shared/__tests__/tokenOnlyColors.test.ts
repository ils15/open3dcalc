import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * VIS-005 REGRESSION GUARD — the token-only colour rule, with an EXPLICIT FLOOR.
 *
 * THE OWNER RULE
 * Colours come from `var(--color-*)` (see the alias layer in styles/tokens.css).
 * A raw Tailwind palette step or a hardcoded hex in the Studio/shared layer is
 * debt: it cannot flip with the theme, which is exactly the class of defect this
 * whole branch exists to fix ("modo escuro ta misturando com modo claro").
 *
 * WHY THIS IS A FLOOR AND NOT A ZERO ASSERTION
 * The epic is NOT finished — 848 occurrences remain across 62 files. A guard
 * that asserted zero would be red on arrival and would block every pull request
 * until someone finished an epic that is explicitly out of scope here. So this
 * file pins the CURRENT inventory per file and fails on any DEVIATION from it:
 *
 *   - a file's count going UP        -> new debt, the guard's whole purpose
 *   - a NEW file appearing with debt -> new debt, also caught
 *   - a file's count going DOWN      -> progress, allowed silently; refresh the
 *                                       table in the same PR so this header
 *                                       never overstates what is left
 *
 * The precedent is `accentBackgroundContrast.test.ts`, which likewise holds a
 * per-site identity list rather than a single count, because "a number about
 * the real population fails as sites are fixed".
 *
 * WHAT WAS MIGRATED IN THIS CHANGE (bounded — see the PR description)
 *   - CatalogTab: 5 buttons that paired the TOKEN fill `var(--accent-fill)`
 *     with a hardcoded `text-white`, including the two fee-form "save" buttons
 *     the audit flagged. Visually identical (`--color-accent-fill-fg` is #ffffff
 *     in BOTH themes) and it restores the invariant tokens.css documents: that
 *     ink must be a non-flipping token, not a literal.
 *   - ErrorBoundary: fully migrated (all 8 sites -> 0). It renders on BOTH
 *     targets on crash, so it is the worst place for an unthemed palette.
 *     `--color-danger` is the spelling the rest of the alias layer already
 *     uses. `--color-critical` would be equally valid: both are emitted at
 *     runtime and both alias `var(--critical)`, so they resolve to the same
 *     colour (#b91c1c light / #fda4af dark, measured in a live page).
 *     An earlier version of this header claimed `--color-critical` lived only
 *     in `@theme inline` and therefore "resolved to nothing". That was FALSE —
 *     `@theme` does emit its custom properties — and it is retracted here and
 *     in ErrorBoundary.tsx. The genuinely unresolvable names in this codebase
 *     are a different, small, pre-existing set: `--color-bg-tertiary`,
 *     `--color-surface`, `--color-surface-hover`, `--surface-elevated`. None is
 *     used here, and none is fixed in this change.
 *   - PrivacyScreen: migrated its amber, red, emerald and white utility literals
 *     to the existing semantic warning/danger/success/accent-fill tokens.
 *   - Studio dark-mode surfaces: migrated the eight Studio views, inline Infill
 *     panel, and four overlays/modals to semantic surface, text, status and
 *     accent tokens. Removed the static dark palette from both themes and
 *     replaced the failing small `text-slate-500` copy with AA-safe text tokens.
 *
 * WHAT IS STILL DEFERRED, AND WHY (the honest debt list)
 *   - CatalogTab's remaining 124 — a rewrite of mixed sites in a SHARED
 *     component would put the Electron target, which currently looks correct,
 *     at risk. Bounded batches only.
 *   - slicerOptimizer.ts (18) — DEAD MODULE: none of its four exported symbols
 *     (`SlicerOptimizationProfile`, `SLICER_OPTIMIZATION_PROFILES`,
 *     `SlicerOptimizationAnalysis`, `analyzeSlicerParameters`) has an importer
 *     anywhere in src. Migrating unrendered code is churn, not progress, so it
 *     is floored and reported instead — the same dead-on-arrival disposition
 *     as the desktop theme-persistence override removed in PR #275.
 *
 * SCOPE
 * `src/shared/**`, `src/platform/web/components/studio/**`, `src/utils/**`
 * Paths are repository-root-relative.
 * excluding `__tests__`. The desktop platform tree is deliberately NOT guarded
 * here: it renders the token-driven shell and is covered by the platform tests.
 * ------------------------------------------------------------------ */

// The FLOOR table is keyed by REPOSITORY-root-relative paths, so the measured
// inventory must be produced from the same root or every key mismatches.
const repoRoot = resolve(__dirname, "../../..");

/**
 * A hardcoded colour in the Studio/shared layer, in ANY of the shapes one can
 * take. The first version of this guard only recognised three of them, and a
 * reviewer running 26 cases through it found 19 real hardcoded colours that
 * passed silently — a guard that cannot see the defect is worse than no guard,
 * because it reports green.
 *
 * `FAMILIES` is wrapped in its own non-capturing group on purpose. Interpolated
 * bare it becomes a top-level alternation and the bare family words match
 * inside ordinary identifiers — "stoRED" matched `red`, which inflated an
 * earlier measurement of this very table by roughly 3x. Every branch below is
 * pinned by the self-check so neither mistake can recur silently.
 */
const FAMILIES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PREFIX =
  "bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|shadow|placeholder";

const DEBT_RULES: ReadonlyArray<readonly [string, RegExp]> = [
  // 1. palette utilities, single- OR multi-digit step (`bg-red-5` counts)
  ["palette", new RegExp(`\\b(?:${PREFIX})-(${FAMILIES})-\\d{1,3}\\b`, "gi")],
  // 2. raw white/black ink on any colour-capable prefix (`ring-white`,
  //    `fill-white`, `stroke-black`, `divide-white`, `from-black`, `shadow-black`)
  ["rawink", new RegExp(`\\b(?:${PREFIX})-(?:white|black)\\b`, "gi")],
  // 3. arbitrary-value hex, case-insensitive: `bg-[#0C111E]`
  ["hexbracket", /\[#[0-9a-f]{3,8}\]/gi],
  // 4. hex inside a quoted string: `const INDIGO = '#6366f1'`
  ["hexstring", /["'`]\s*#[0-9a-f]{3,8}\s*["'`]/gi],
  // 5. hex as an HTML/SVG attribute: `<rect fill="#ff0000" />`
  [
    "hexattr",
    /\b(?:fill|stroke|stop-color|color|bgcolor)\s*=\s*["']#[0-9a-f]{3,8}["']/gi,
  ],
  // 6. colour function inside an arbitrary value: `bg-[rgba(0,0,0,.5)]`,
  //    `bg-[hsl(...)]`, `bg-[oklch(...)]`
  [
    "fnbracket",
    /\[\s*(?:rgba?|hsla?|oklch|oklab|hwb|lab|lch|color)\([^)\]]*\d[^)\]]*\)\s*\]/gi,
  ],
  // 7. bare colour function call with numeric literals
  ["fncall", /(?<![\w-])(?:rgba?|hsla?|oklch|oklab|hwb)\(\s*[\d.]/gi],
  // 8. hex inside a comma list (gradient stops / colour tuples): `0%,#0b1120,100%`.
  //    This branch was dropped once and silently lost 15 real literals in
  //    BentoSurface plus all of BentoHeader; the self-check pins it.
  ["hexlist", /,\s*#[0-9a-f]{3,8}\b/gi],
];

const DEBT = new RegExp(
  DEBT_RULES.map(([, re]) => `(${re.source})`).join("|"),
  "gi",
);

/** Comments are stripped: this rule is about rendered colour, not prose. */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const GUARDED_DIRS = [
  "src/shared",
  "src/platform/web/components/studio",
  "src/utils",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // `__tests__` is excluded: these guards legitimately quote palette names in
    // their own fixtures, and a guard must not fail for naming what it forbids.
    if (["node_modules", "dist", "__tests__"].includes(entry)) continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Measured occurrences per guarded file that currently contains debt. */
function measuredDebt(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const rel of GUARDED_DIRS) {
    for (const file of walk(resolve(repoRoot, rel))) {
      const hits = stripComments(readFileSync(file, "utf-8")).match(DEBT);
      if (hits && hits.length) {
        counts.set(file.replace(`${repoRoot}/`, ""), hits.length);
      }
    }
  }
  return counts;
}

const measured = measuredDebt();

/**
 * THE FLOOR — the audited inventory after the Studio migration, 2026-10-08,
 * 62 files / 848 occurrences.
 *
 * Regenerate after an intentional migration:
 *   node -e '...' (see the PR description) or re-derive with the same regex.
 */
const FLOOR: Readonly<Record<string, number>> = {
  "src/platform/web/components/studio/StudioCalculatorView.tsx": 3,
  "src/platform/web/components/studio/StudioQuotesView.tsx": 3,
  "src/platform/web/components/studio/StudioSpoolView.tsx": 27,
  "src/platform/web/components/studio/StudioProductsView.tsx": 2,
  "src/shared/components/Catalog/CatalogTab.tsx": 124,
  "src/platform/web/components/studio/StudioCustomerView.tsx": 1,
  "src/platform/web/components/studio/StudioQuoteModal.tsx": 1,
  "src/platform/web/components/studio/StudioSubHeader.tsx": 62,
  "src/shared/components/Catalog/FilamentInventory.tsx": 61,
  "src/shared/components/Dashboard/Dashboard.tsx": 60,
  "src/platform/web/components/studio/StudioCockpitDock.tsx": 46,
  "src/shared/components/AIAssistant/AIAssistantPanels.tsx": 49,
  "src/platform/web/components/studio/StudioSidebar.tsx": 48,
  "src/shared/components/AIAssistant/AIAssistantModal.tsx": 48,
  "src/platform/web/components/studio/StudioMiniDashOverlay.tsx": 1,
  "src/platform/web/components/studio/StudioHeader.tsx": 7,
  "src/platform/web/components/studio/StudioCopilotModal.tsx": 1,
  "src/shared/components/SpoolShelf/SpoolCard.tsx": 28,
  "src/shared/components/Results/CostDistributionBars.tsx": 26,
  "src/shared/components/Calculator/QuoteSection.tsx": 22,
  "src/platform/web/components/studio/StudioShortcutsModal.tsx": 1,
  "src/shared/components/Calculator/surfaces/BentoSurface.tsx": 20,
  "src/utils/slicerOptimizer.ts": 18,
  "src/shared/components/AppShell/QuickStatusPill.tsx": 16,
  "src/shared/components/StlPreview/StlPreview.tsx": 15,
  "src/shared/lib/QuoteDoc.tsx": 13,
  "src/shared/components/Calculator/HistoryTab/HistoryTab.tsx": 12,
  "src/shared/components/SpoolShelf/SpoolShelf.tsx": 12,
  "src/shared/lib/ExecutiveReportDoc.tsx": 11,
  "src/shared/components/SpoolShelf/SpoolForm.tsx": 10,
  "src/shared/lib/ReportDoc.tsx": 9,
  "src/shared/components/Catalog/CustomerTab.tsx": 8,
  "src/shared/components/Calculator/sections/MaterialSection.tsx": 7,
  "src/platform/web/components/studio/studioData.ts": 6,
  "src/shared/components/Catalog/ProductInventory.tsx": 6,
  "src/shared/components/StlPreview/MeshWarning.tsx": 6,
  "src/shared/lib/demoDataset.ts": 6,
  "src/shared/stores/spoolStore.ts": 6,
  "src/shared/components/GcodePreview/GcodePreviewPanel.tsx": 4,
  "src/shared/components/ui/ToggleCard.tsx": 4,
  "src/shared/stores/calculatorStore.defaults.ts": 4,
  "src/shared/components/ui/ComparisonModal.tsx": 3,
  "src/shared/components/ui/Tutorial.tsx": 3,
  "src/shared/components/BetaBadge/BetaBadge.tsx": 2,
  "src/shared/components/Calculator/TechToggle.tsx": 2,
  "src/shared/components/SpoolShelf/SpoolThumb.tsx": 2,
  "src/shared/components/StlPreview/EstimationModeSection.tsx": 2,
  "src/shared/components/ui/DataSyncModal.tsx": 2,
  "src/shared/components/ui/OnboardingModal.tsx": 2,
  "src/shared/components/ui/PrivacyPolicy.tsx": 2,
  "src/shared/components/ui/Toast.tsx": 2,
  "src/shared/stores/colorPalette.ts": 2,
  "src/shared/components/AppShell/KeyboardShortcutsDialog.tsx": 1,
  "src/shared/components/AppShell/ManageVisibilityButton.tsx": 1,
  "src/shared/components/Calculator/surfaces/bento/BentoHeader.tsx": 1,
  "src/shared/components/Catalog/PrinterTagEditor.tsx": 1,
  "src/shared/components/Privacy/LegacyResidueDisclosure.tsx": 1,
  "src/shared/components/ui/ConfirmDialog.tsx": 1,
  "src/shared/components/ui/PrivacyBanner.tsx": 1,
  "src/shared/components/ui/QuickStartBanner.tsx": 1,
  "src/shared/components/Privacy/PrivacyOnboarding.tsx": 1,
  "src/shared/lib/dataSync.test.ts": 1,
};

describe("VIS-005 token-only colours: the guard detects what it claims to", () => {
  /**
   * Guards the guard. The first version of this file wrapped the palette
   * families without their own group, so the alternation bound at the top level
   * and bare colour words matched inside identifiers — "stoRED" matched `red`
   * and the inventory was ~3x inflated, all while the file still passed its own
   * assertions because every number was derived from the same broken regex.
   * Self-consistency cannot catch that, so the expected cases are pinned here.
   */
  it.each([
    // Must NOT match: ordinary identifiers that contain colour words.
    ["const stored = readFileSync(p)", false],
    ['import { guardedStorage } from "@/shared/lib/manifestStorage"', false],
    ['import "@/platform/web/main"', false],
    // Must match: real hardcoded colours.
    ["bg-[#0c111e]", true],
    ["text-white", true],
    ["bg-blue-600/20", true],
    ["border-slate-700", true],
    ["dark:text-amber-300", true],
    ["shadow-blue-500/30", true],
    ["ring-emerald-500/40", true],
    ["decoration-slate-400", true],
    ["from-slate-900", true],
    // Must NOT match: the token layer itself.
    ["var(--color-text-primary)", false],
    ["var(--surface-canvas)", false],
    ["prefers-color-scheme", false],
    // THE 19 BLIND SPOTS a reviewer found in the first version of this guard.
    // Each of these is a real hardcoded colour that the original three-branch
    // regex matched none of, so the guard reported green while they shipped.
    ['className="bg-[#0C111E]"', true], // uppercase hex
    ['ctx.fillStyle = "#ff0000"', true], // hex in a JS string
    ['<rect fill="#ff0000" />', true], // SVG attribute
    ["bg-[rgba(0,0,0,0.5)]", true], // functional notation
    ["bg-[hsl(210,50%,40%)]", true],
    ["bg-[oklch(0.5_0.1_250)]", true],
    ['"ring-white"', true],
    ['"fill-white"', true],
    ['"stroke-black"', true],
    ['"divide-white"', true],
    ['"from-black"', true],
    ['"shadow-black"', true],
    ['"bg-red-5"', true], // single-digit step
    // Hex in a comma list (gradient stops). This branch was dropped once and
    // silently lost 15 real literals in BentoSurface plus all of BentoHeader.
    ["0%,#0b1120,100%", true],
    ["rgba(0, 0, 0, 0.5)", true],
    // Known acceptable false positive: a data key that reads like a colour.
    ['{"bg-blue-500": "not a colour, a data key"}', true],
  ])("classifies %j as debt=%s", (source, expected) => {
    DEBT.lastIndex = 0;
    expect(DEBT.test(source)).toBe(expected);
  });
});

describe("VIS-005 token-only colours: no NEW hardcoded palette literals", () => {
  it("reports the audited inventory so the header can be checked by eye", () => {
    const files = Object.keys(FLOOR).length;
    const occurrences = Object.values(FLOOR).reduce((a, b) => a + b, 0);
    expect(files).toBe(62);
    expect(occurrences).toBe(848);
  });

  it("has no file carrying debt that the floor does not name", () => {
    // A new file with a palette literal is new debt, and is the case a
    // count-only guard would miss entirely.
    const unnamed = [...measured.keys()].filter((f) => !(f in FLOOR)).sort();
    expect(
      unnamed,
      "these files contain hardcoded palette literals but are not in the FLOOR " +
        "table. Either migrate them or add them with their count — an unnamed " +
        "file is how debt becomes invisible.",
    ).toEqual([]);
  });

  it("has no floor entry for a file that no longer carries debt", () => {
    // Keeps the documented list honest in the other direction: a file that has
    // been fully migrated must leave the table, not sit at a stale count.
    const stale = Object.keys(FLOOR)
      .filter((f) => !measured.has(f))
      .sort();
    expect(
      stale,
      "these files are in the FLOOR table but no longer contain any hardcoded " +
        "literal. Remove them so the documented debt list reflects reality.",
    ).toEqual([]);
  });

  it("matches the floor exactly, per file", () => {
    const drift: string[] = [];
    for (const [file, pinned] of Object.entries(FLOOR)) {
      const actual = measured.get(file) ?? 0;
      if (actual > pinned) {
        drift.push(
          `${file}: ${pinned} -> ${actual} (+${actual - pinned}) NEW hardcoded literals`,
        );
      } else if (actual < pinned) {
        drift.push(
          `${file}: ${pinned} -> ${actual} (PROGRESS — refresh the FLOOR table ` +
            `in this change so the documented debt list stays honest)`,
        );
      }
    }
    expect(
      drift,
      drift.length
        ? drift.join("\n")
        : "the inventory matches the floor exactly",
    ).toEqual([]);
  });
});
