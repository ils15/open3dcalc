import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import fs from "node:fs";
import { resolve } from "node:path";

import { defaultNavigationPrefs } from "@/shared/lib/navigationPrefs";
import { useNavigationPrefsStore } from "@/shared/stores/navigationPrefsStore";
import { useTutorialStore } from "@/shared/stores/tutorialStore";

/**
 * Phase 7o s4 follow-up — the Focus Mode exit is ALWAYS VISIBLE.
 *
 * The stage shipped a structural promise: the exit renders whenever the mode is
 * on, in no dialog and in no trap. Themis found two ways the "always" was
 * false anyway, both purely about LAYER — the promise was made in the DOM tree
 * and never checked in the stacking order:
 *
 * 1. The exit sat at z-[60], ABOVE the modal tier (z-50), so it painted over
 *    the backdrops of ConfirmDialog, ConsentModal, PrivacyPolicy, DataSyncModal,
 *    ComparisonModal, the field customizer and the tutorial. Chrome floating
 *    over a modal's scrim is the visible half; the other half is that it
 *    contradicts the rule the design already reasons about — a modal owns
 *    Escape and owns the screen while it is up.
 *
 * 2. StlPreview's fullscreen / toolpath overlay sat at z-[100], above the exit,
 *    so it obscured AND intercepted it. That overlay is reachable while Focus
 *    Mode is on precisely because the mode forces activeTab: "calculator" —
 *    StlPreview is mounted by MaterialSection, inside the calculator. It is
 *    not a permanent trap (the overlay owns Escape and has its own toggle), but
 *    the guarantee as written did not hold.
 *
 * The fix is a scale, not a nudged number. `tokens.css` already owned
 * `--z-dropdown`, so this file joins that scale rather than inventing a second
 * one, and consumes it the way `Select` already does (inline
 * `style={{ zIndex: "var(--z-…)" }}`) so the ordering is assertable here and
 * not only by reading class names.
 *
 * These tests drive the REAL StlPreview portal. Mocking it away is exactly the
 * mistake that let defect 2 through: a test that deletes the overlay proves
 * nothing about what the overlay does to the stacking order.
 */

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: "pt-BR", changeLanguage: vi.fn() },
  }),
}));

// ─── R3F / three: jsdom has no GL. Mirrors StlPreview.test.tsx so the real
// StlPreview (and therefore the real fullscreen portal) can mount.
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="r3f-canvas">{children}</div>
  ),
}));
vi.mock("@react-three/drei", () => ({
  OrbitControls: () => null,
  Center: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Bounds: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useBounds: () => ({ fit: vi.fn(), refresh: vi.fn(), clip: vi.fn() }),
  MeshStandardMaterial: () => null,
  MeshBasicMaterial: () => null,
}));
vi.mock("three/examples/jsm/loaders/STLLoader", () => ({ STLLoader: vi.fn() }));
vi.mock("three/examples/jsm/loaders/OBJLoader", () => ({ OBJLoader: vi.fn() }));

// The calculator surface is stubbed exactly as focusMode.test.tsx does, but it
// renders the REAL StlPreview — which is what MaterialSection mounts at the
// three call sites that stay reachable in Focus Mode. The factory body runs at
// render time, not at hoist time, so the closed-over imports are initialised.
vi.mock("@/shared/components/Calculator/surfaces/CalculatorSurface", () => ({
  CalculatorSurface: () => <StlPreview initialGeometry={geometryFixture} />,
}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const geometryFixture: any = {
  type: "BufferGeometry",
  uuid: "focus-mode-geometry",
  clone: vi.fn().mockReturnThis(),
};

vi.mock("@/shared/components/Dashboard/Dashboard", () => ({
  Dashboard: () => <div data-testid="surface-dashboard" />,
}));
vi.mock("@/shared/components/Calculator/HistoryTab/HistoryTab", () => ({
  HistoryTab: () => <div data-testid="surface-history" />,
}));
vi.mock("@/shared/components/Catalog/CatalogTab", () => ({
  CatalogTab: () => <div data-testid="surface-catalog" />,
}));
vi.mock("@/shared/components/SpoolShelf/SpoolShelf", () => ({
  SpoolShelf: () => <div data-testid="surface-inventory" />,
}));
vi.mock("@/shared/components/Calculator/InfillCalculator", () => ({
  InfillCalculator: () => <div data-testid="surface-infill" />,
}));
vi.mock("@/shared/components/Calculator/QuoteSection", () => ({
  QuoteSection: () => <div data-testid="surface-quotes" />,
}));
vi.mock("@/shared/components/Catalog/CustomerTab", () => ({
  CustomerTab: () => <div data-testid="surface-customers" />,
}));
vi.mock("@/shared/components/Catalog/ProductInventory", () => ({
  ProductInventory: () => <div data-testid="surface-products" />,
}));
vi.mock("@/shared/components/Privacy/PrivacyScreen", () => ({
  PrivacyScreen: () => <div data-testid="surface-privacy" />,
}));
vi.mock("@/shared/components/Changelog/ChangelogPage", () => ({
  ChangelogPage: () => <div data-testid="surface-changelog" />,
}));
vi.mock("@/shared/components/Wiki/WikiPage", () => ({
  WikiPage: () => <div data-testid="surface-wiki" />,
}));

import { AppShell } from "@/shared/components/AppShell/AppShell";
import { FocusModeButton } from "@/shared/components/AppShell/FocusModeButton";
import { NavigationProvider } from "@/shared/components/AppShell/NavigationProvider";
import {
  useActiveTab,
  useNavigateToTab,
} from "@/shared/components/AppShell/NavigationContext";
import { StlPreview } from "@/shared/components/StlPreview/StlPreview";
import { ToastContainer } from "@/shared/components/ui/Toast";
import { Tooltip } from "@/shared/components/ui/Tooltip";
import { Tutorial } from "@/shared/components/ui/Tutorial";
import { useLayoutStore } from "@/shared/stores/layoutStore";

const TOKENS_CSS = resolve(process.cwd(), "src/styles/tokens.css");

/** The numeric value a `--z-*` scale step declares in tokens.css. */
function scaleStep(name: string): number {
  const css = fs.readFileSync(TOKENS_CSS, "utf8");
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)`));
  expect(
    match,
    `--${name} must be declared in the layering scale in tokens.css`,
  ).not.toBeNull();
  return Number(match![1]);
}

/** The scale step a real element actually resolved to. */
function resolvedStep(element: HTMLElement): string {
  const value = element.style.zIndex;
  expect(
    value,
    "element must take its layer from the scale, not from a literal class",
  ).toMatch(/^var\(--z-[a-z-]+\)$/);
  // `var(--z-viewer)` -> `z-viewer`; `scaleStep` re-adds the `--` prefix.
  return value.slice(4, -1).replace(/^--/, "");
}

/**
 * Every scale step a source file's surfaces take, read from their inline styles.
 *
 * Used only for surfaces this harness does not mount — the platform bottom nav
 * is composed by the Apps, outside AppShell, and the results-sidebar listbox
 * and field customizer sit behind store state that a layering test has no
 * business arranging. The property under test is static anyway (which step a
 * surface was given), so reading the declaration is the direct assertion; the
 * surfaces that CAN be mounted here are mounted instead, further down.
 */
function sourceLayers(file: string): string[] {
  const src = fs.readFileSync(resolve(process.cwd(), file), "utf8");
  // Captured WITH the `z-` prefix, so the result feeds `scaleStep` and
  // `resolvedStep` unchanged — one spelling of a step name in this file.
  return [...src.matchAll(/zIndex:\s*"var\(--(z-[a-z-]+)\)"/g)].map(
    (m) => m[1],
  );
}

function Harness(): React.ReactElement {
  const activeTab = useActiveTab();
  const navigateToTab = useNavigateToTab();
  return (
    <>
      <FocusModeButton />
      <AppShell
        activeTab={activeTab}
        onTabChange={navigateToTab}
        mainClassName="main-normal"
        mainFocusClassName="main-focus"
      />
    </>
  );
}

function renderHarness(): void {
  render(
    <NavigationProvider>
      <Harness />
    </NavigationProvider>,
  );
}

function enterFocusMode(): void {
  fireEvent.click(screen.getByRole("button", { name: "focusMode.enter" }));
}

function exitBar(): HTMLElement {
  return screen.getByTestId("focus-mode-exit");
}

function exitButton(): HTMLElement {
  return screen.getByRole("button", { name: "focusMode.exit" });
}

beforeEach(() => {
  window.localStorage.clear();
  useNavigationPrefsStore.setState({
    ...defaultNavigationPrefs(),
    focusMode: false,
    focusModeReturnTab: null,
  });
  useTutorialStore.setState({ isActive: false, sessionDismissed: false });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

/* ------------------------------------------------------------------ *
 * Deriving the z-50 audit's own inputs, so the derivation is testable
 * instead of being a regex buried in an assertion.
 *
 * Two defects, both LOWs from the PR #233 review, both in how this file
 * works out what it is auditing:
 *
 * 1. The file list was derived with `/class(?:Name)?=[^\n]*\bz-50\b/`, which
 *    requires `z-50` to sit on the SAME LINE as `className=`. A class string
 *    written across several lines — which prettier produces without complaint
 *    once it gets long, and which five of the covered files already do for the
 *    part after `bg-black/60` — puts the token somewhere the heuristic cannot
 *    see. Such a file is never discovered, so it never reaches the covered-set
 *    assertion, so the audit silently stops auditing it. An unlisted file is
 *    the one case this test exists to catch, and the derivation was the hole.
 *
 *    The fix is to scan the file TEXT for the token instead of for a
 *    same-line shape. That is only sound with comments stripped, because a
 *    comment is not a class string: this tree discusses `z-50` in prose in five
 *    files that do not paint it (Toast, FocusModeExit, FieldCustomizer,
 *    InventoryDeductionCard, MobileNav — all of them explaining why they are
 *    NOT at z-50), and a raw text scan would list all five as unpinned and send
 *    the audit chasing its own documentation.
 *
 * 2. The sheet panel was recognised by `z-50[^\n]*rounded-t-2xl` — a
 *    COSMETIC proxy. Any unrelated floating box rounded at the top and filed in
 *    the modal tier passes as a legitimate panel, and pairing was only checked
 *    per FILE, so a panel in one file could be "answered" by a backdrop in the
 *    same file that has nothing to do with it. Both real panels are
 *    `fixed bottom-0 left-0 right-0 z-50 … rounded-t-2xl`: the load-bearing
 *    token is `bottom-0`, which is what makes it a bottom SHEET rather than a
 *    floating box, so that is what the pattern now requires. The pairing check
 *    becomes `panels <= backdrops`, which bounds the count rather than merely
 *    testing that a backdrop exists somewhere in the file.
 *
 * The classifier below reproduces the previous counts EXACTLY on all 14 covered
 * files — verified before it was written in, because a narrowing that silently
 * changed a number would be a weakening wearing a fix's clothes.
 * ------------------------------------------------------------------ */

/**
 * Remove `/* … *\/` and `// …`.
 *
 * `[^:]` before the `//` is load-bearing: ConsentModal and PrivacyPolicy both
 * carry `href="https://github.com/…"` on a line the audit reads, and a naive
 * strip truncates that line at `https:`. It happens to be harmless there today
 * because those lines hold no z-50, which is exactly the kind of accident that
 * stops being harmless.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/([^:])\/\/[^\n]*/g, "$1");
}

/**
 * `z-50` at a word boundary. Without the boundary this matches `z-500` and
 * `z-50x`; the tree also contains `z-[50]`-style arbitrary values, which the
 * literal token correctly does not match.
 */
const Z50_TOKEN = /\bz-50\b/;

/** True when a file paints a z-50 in a class string, on any line. */
function paintsZ50(source: string): boolean {
  return Z50_TOKEN.test(stripComments(source));
}

interface Z50Census {
  /** every z-50 token, comment-stripped */
  all: number;
  /** a dimming backdrop: a fixed, full-bleed layer */
  backdrops: number;
  /** a bottom-sheet panel: anchored to the bottom edge, rounded at the top */
  panels: number;
}

/**
 * The occurrence-scope rule, as a function, so it can be tested on fixtures.
 *
 * Kept inline in the audit loop until a mutation proved why that is wrong: the
 * current tree has exactly one panel against one backdrop in each of the two
 * files that have panels, so tightening the pairing check from "is there a
 * backdrop somewhere in this file" to "panels <= backdrops" changed no
 * assertion and no test went red. The rule was narrowed and nothing recorded
 * that it now holds. Extracting it is what makes the narrowing testable at all.
 *
 * Returns null when the file is in scope, and a diagnostic when it is not.
 */
function scopeFault(file: string, census: Z50Census): string | null {
  const { all, backdrops, panels } = census;
  if (backdrops + panels !== all) {
    return (
      `${file}: every z-50 must be a dimming backdrop or the panel that answers ` +
      `one (found ${all} z-50, ${backdrops} backdrop, ${panels} panel)`
    );
  }
  // The pairing is a COUNT, not a presence. "If there is a panel, is there a
  // backdrop in this file" is satisfied by two panels and one scrim, so a second
  // sheet could mount against a single backdrop and pass.
  if (panels > backdrops) {
    return (
      `${file}: ${panels} sheet panel(s) against ${backdrops} backdrop(s); each ` +
      `panel answers one backdrop`
    );
  }
  return null;
}

/**
 * How a file's z-50 occurrences divide up.
 *
 * Classified per line, because that is the unit a class list is written in, and
 * matched on semantic tokens rather than on adjacency so a reordering of the
 * utilities in a class string does not turn a scrim into an unexplained z-50.
 * A z-50 that matches neither shape is left over on purpose: the audit's
 * assertion is `backdrops + panels === all`, so an unclassifiable z-50 fails
 * loudly instead of being quietly absorbed.
 */
function censusZ50(source: string): Z50Census {
  const code = stripComments(source);
  let all = 0;
  let backdrops = 0;
  let panels = 0;
  for (const line of code.split("\n")) {
    const hits = line.match(/\bz-50\b/g)?.length ?? 0;
    if (!hits) continue;
    all += hits;
    if (line.includes("fixed") && line.includes("inset-0")) backdrops += 1;
    if (line.includes("bottom-0") && line.includes("rounded-t-2xl"))
      panels += 1;
  }
  return { all, backdrops, panels };
}

describe("focus mode — the z-50 audit can derive its own inputs", () => {
  it("finds a z-50 written across several lines", () => {
    // The defect. `class(?:Name)?=[^\n]*\bz-50\b` cannot see this, so the file
    // would never be discovered, never reach the covered-set assertion, and the
    // audit would report green while leaving it unpinned.
    const multiline = [
      "      <div",
      "        className={",
      "          `fixed inset-0",
      "            z-50",
      "            bg-black/60`",
      "        }",
      "      />",
    ].join("\n");
    expect(
      paintsZ50(multiline),
      "a z-50 on its own line inside a multi-line class string must still be " +
        "discovered — this is the case the same-line heuristic missed",
    ).toBe(true);
  });

  it("finds a z-50 on the same line too, so nothing that used to be seen is lost", () => {
    expect(
      paintsZ50('<div className="fixed inset-0 z-50 bg-black/60" />'),
    ).toBe(true);
  });

  it("ignores a z-50 that only appears in a comment", () => {
    // A comment is not a class string. Five files in this tree explain in prose
    // why they are NOT at z-50, and a raw text scan would list all five.
    const commented = [
      "export function X() {",
      "  // It used to be z-50, which painted over the only exit.",
      '  return <div className="fixed bottom-4" />;',
      "}",
    ].join("\n");
    expect(
      paintsZ50(commented),
      "a z-50 mentioned in a `//` comment must not count as a painted layer",
    ).toBe(false);

    const blockCommented = [
      "/*",
      " * Filed at z-50 it painted over the exit for four seconds.",
      " */",
      'export const y = <div className="fixed bottom-4" />;',
    ].join("\n");
    expect(paintsZ50(blockCommented)).toBe(false);
  });

  it("names every file in the tree that only discusses z-50 in prose", () => {
    // The real instances, not a fixture. If one of these ever gains a painted
    // z-50 the audit SHOULD list it — so this asserts they are still comment-only
    // and is the thing that fails when the strip regresses.
    for (const file of [
      "src/shared/components/ui/Toast.tsx",
      "src/shared/components/AppShell/FocusModeExit.tsx",
      "src/shared/components/Calculator/FieldCustomizer.tsx",
      "src/shared/components/Results/InventoryDeductionCard.tsx",
      "src/platform/web/components/MobileNav.tsx",
    ]) {
      const source = fs.readFileSync(resolve(process.cwd(), file), "utf8");
      expect(
        Z50_TOKEN.test(source),
        `${file} is expected to mention z-50 in a comment; if it no longer does, ` +
          `this fixture has stopped testing anything and should be replaced`,
      ).toBe(true);
      expect(
        paintsZ50(source),
        `${file} mentions z-50 but does not paint one. If the comment strip has ` +
          `regressed, the audit will list a file that has no layer at all.`,
      ).toBe(false);
    }
  });

  it("does not read `https://` as the start of a line comment", () => {
    // ConsentModal and PrivacyPolicy both carry a github link on a line this
    // audit reads. A naive `//` strip truncates it at `https:`.
    for (const file of [
      "src/shared/components/ui/ConsentModal.tsx",
      "src/shared/components/ui/PrivacyPolicy.tsx",
    ]) {
      const source = fs.readFileSync(resolve(process.cwd(), file), "utf8");
      expect(
        stripComments(source).includes("https://github.com/ils15/open3dcalc"),
        `${file} has its href truncated by the comment strip, so any z-50 later ` +
          `on that line would be discarded`,
      ).toBe(true);
    }
  });

  it.each([
    ["z-500", false],
    ["z-5", false],
    ["z-[50]", false],
    ["z-50x", false],
    ["z-50", true],
  ])("matches %s -> %s at a word boundary", (token, expected) => {
    expect(Z50_TOKEN.test(token)).toBe(expected);
  });

  it("calls a bottom sheet a panel and a floating box not a panel", () => {
    // The narrowed pattern keys on `bottom-0`, which is what makes a panel a
    // SHEET. `rounded-t-2xl` alone was a cosmetic proxy: an unrelated floating
    // box rounded at the top and filed at z-50 passed as a legitimate panel,
    // which is the false pass the review flagged.
    const sheet = censusZ50(
      '<div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden rounded-t-2xl" />',
    );
    expect(sheet).toEqual({ all: 1, backdrops: 0, panels: 1 });

    const floatingBox = censusZ50(
      '<div className="fixed right-4 top-24 z-50 rounded-t-2xl w-64" />',
    );
    expect(
      floatingBox,
      "a floating box is not a bottom sheet, so it must not be counted as a " +
        "panel that answers a backdrop",
    ).toEqual({ all: 1, backdrops: 0, panels: 0 });
  });

  it("tolerates utilities being reordered within a class string", () => {
    // Matched on semantic tokens, not adjacency, so a scrim does not become an
    // unexplained z-50 the day someone moves `z-50` to the end of the list.
    const reordered = censusZ50(
      '<div className="z-50 bg-black/60 flex items-center justify-center fixed inset-0" />',
    );
    expect(reordered).toEqual({ all: 1, backdrops: 1, panels: 0 });
  });

  it("rejects a second sheet panel against a single backdrop", () => {
    // The mutation that forced this rule out of the audit loop and into a
    // function. Both panel files in the tree hold exactly one panel and one
    // backdrop, so the tightened pairing is satisfied everywhere by
    // coincidence, and a rule that only holds by coincidence is not a rule.
    expect(
      scopeFault("src/Thing.tsx", { all: 3, backdrops: 1, panels: 2 }),
      "two sheet panels cannot both be answered by one backdrop — the " +
        "presence-only check this replaces was satisfied by exactly this case",
    ).toMatch(/each panel answers one backdrop/);
  });

  it("accepts one panel per backdrop, which is the rule", () => {
    expect(
      scopeFault("src/Thing.tsx", { all: 2, backdrops: 1, panels: 1 }),
    ).toBeNull();
    expect(
      scopeFault("src/Thing.tsx", { all: 4, backdrops: 2, panels: 2 }),
    ).toBeNull();
    expect(
      scopeFault("src/Thing.tsx", { all: 1, backdrops: 1, panels: 0 }),
      "a plain scrim modal is in scope",
    ).toBeNull();
  });

  it("rejects a z-50 that is neither a backdrop nor a panel", () => {
    expect(
      scopeFault("src/Thing.tsx", { all: 2, backdrops: 1, panels: 0 }),
    ).toMatch(/every z-50 must be a dimming backdrop/);
  });

  it("leaves a multi-line z-50 unclassified rather than absorbing it", () => {
    // The consequence of classifying per line, stated rather than hidden: a
    // class string that wraps puts the z-50 away from `inset-0`. It shows up as
    // a leftover, and the audit's `backdrops + panels === all` assertion then
    // fails and says so. That is the intended direction — an unrecognised layer
    // must be loud, not absorbed.
    const wrapped = censusZ50(
      ["<div className={`fixed inset-0", "  z-50 bg-black/60`} />"].join("\n"),
    );
    expect(wrapped).toEqual({ all: 1, backdrops: 0, panels: 0 });
  });
});

describe("focus mode — the exit is layered, not merely present", () => {
  it("sits BELOW the modal tier, so chrome never paints over a scrim", () => {
    renderHarness();
    enterFocusMode();

    // The defect: z-[60] against a modal tier of z-50. A modal asks the user a
    // question and owns the screen while it is up; an always-on-top exit
    // floating across its backdrop contradicts the rule the design already
    // reasons about everywhere else.
    expect(resolvedStep(exitBar())).toBe("z-shell-chrome");
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
  });

  it("declares the two steps it needs as one ordered scale", () => {
    // A viewer (the same surface, full-bleed) sits under shell chrome; a modal
    // sits over it. If the order of those three ever inverts, one of the two
    // guarantees above is false again — so the ORDER is the assertion.
    expect(scaleStep("z-viewer")).toBeLessThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
    expect(scaleStep("z-dropdown")).toBeGreaterThan(50);
  });
});

/**
 * Defect 3 — a PASSIVE surface buried the exit.
 *
 * Moving the exit from `z-[60]` down to `--z-shell-chrome` fixed the scrim
 * half of the first defect and opened this one: at `z-50` the Toast was the
 * modal TIER, and the modal tier sits above shell chrome by design. The toast
 * is not a modal. It is `role="region"` — no scrim, no focus trap, it does not
 * own Escape, and it dismisses itself after 4s — and `escapeIsOwnedByOverlay`
 * does not even match it, so nothing in the model treated it as a layer at
 * all. It inherited the one tier whose whole justification is "this surface
 * owns the screen", and the exit inherited the consequence.
 *
 * At `sm+` the two are pixel-identical: Toast anchors `sm:top-4 sm:right-4`,
 * the exit anchors `sm:top-4 sm:right-4`. The toast therefore painted
 * directly over the only way out of the mode, and covered it for four
 * seconds. It is reachable: `Calculator.tsx` mounts `ToastContainer` on the
 * calculator surface and Focus Mode forces `activeTab: "calculator"`.
 *
 * The root cause is not the number. It is that one tier admitted both
 * scrim-owning modals AND passive transients, so a surface that owns nothing
 * could inherit the right to cover the only thing that must stay reachable.
 * Passive surfaces get their own step, under shell chrome, and the modal tier
 * is left meaning only what it says.
 */
describe("focus mode — a passive surface never buries the exit", () => {
  /** The real ToastContainer, in the position Calculator.tsx gives it. */
  function PassiveHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        <ToastContainer
          items={[{ id: 1, message: "Export blocked", type: "info" }]}
          onDismiss={vi.fn()}
        />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
      </>
    );
  }

  function renderPassiveHarness(): void {
    render(
      <NavigationProvider>
        <PassiveHarness />
      </NavigationProvider>,
    );
  }

  function toastRegion(): HTMLElement {
    return screen.getByRole("region", { name: "Notificações" });
  }

  it("mounts the REAL toast inside Focus Mode and keeps it under the exit", () => {
    // Not a stub: the toast is the element that caused the defect, so mocking
    // it away would prove nothing — the same mistake the StlPreview portal
    // test was written to avoid.
    renderPassiveHarness();
    enterFocusMode();

    const toast = toastRegion();
    expect(
      toast,
      "the real toast must be mounted while the mode is on",
    ).toBeInTheDocument();

    // The defect: the toast resolved to the modal tier (z-50), one step above
    // the exit, at the same top-right anchor.
    expect(resolvedStep(toast)).toBe("z-passive");
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(toast)),
    );
  });

  it("shares the exit's top-right anchor at sm+, which is why the tier decides", () => {
    // jsdom has no layout and no hit-testing, so the occlusion itself cannot be
    // measured. Its two INPUTS can be: both surfaces resolve to the same corner
    // once the mobile breakpoint passes, so nothing but the layer order keeps
    // them apart. Pin both, or this test silently stops describing the bug.
    renderPassiveHarness();
    enterFocusMode();

    const toast = toastRegion();
    const exit = exitBar();
    for (const anchor of ["sm:top-4", "sm:right-4"]) {
      expect(toast.className).toContain(anchor);
      expect(exit.className).toContain(anchor);
    }
  });

  it("leaves the exit focusable and clickable while a toast is up", () => {
    // Layering alone is not the guarantee, and neither is focus: the toast is
    // the surface that used to sit on top. So the control is actually used,
    // because a number nobody clicks is not a reachable exit.
    renderPassiveHarness();
    enterFocusMode();
    const toast = toastRegion();
    expect(toast).toBeInTheDocument();
    // Anchored, not vacuous: jsdom does not hit-test, so this test would pass on
    // its own even with the toast on top. The layer relation is the part that
    // would have caught it; the click below is what keeps the number honest.
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(toast)),
    );

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);

    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.queryByTestId("focus-mode-exit")).toBeNull();
  });

  it("gives Escape to nobody when only a passive surface is up", () => {
    // A toast owns no key, so it must not silently disarm the exit the way an
    // overlay would. `escapeIsOwnedByOverlay` matches dialog/menu/listbox and
    // a toast is none of those — asserted here so the passive tier cannot grow
    // a marker that would make the toast an Escape owner by accident.
    renderPassiveHarness();
    enterFocusMode();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("declares passive as its own step, not as a member of the modal tier", () => {
    // The model, as an order. Everything that owns nothing is under the exit;
    // the exit is under everything that owns the screen.
    expect(scaleStep("z-app-chrome")).toBeLessThan(scaleStep("z-passive"));
    expect(scaleStep("z-viewer")).toBeLessThan(scaleStep("z-passive"));
    expect(scaleStep("z-passive")).toBeLessThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-shell-chrome")).toBeLessThan(50);
    expect(50).toBeLessThan(scaleStep("z-dropdown"));
    expect(scaleStep("z-dropdown")).toBeLessThan(scaleStep("z-panel"));
  });

  it("puts the mobile bottom nav under the passive band, in both platforms", () => {
    // The toast sits at `bottom-4` and the nav at `bottom-0`, so the toast has
    // to win or the nav buries IT — which is why the nav cannot stay filed in
    // the modal tier either. Web and desktop had drifted to 50 and 40 for the
    // same component; one named step is what stops them drifting again.
    for (const file of [
      "src/platform/web/components/MobileNav.tsx",
      "src/platform/desktop/components/MobileNav.tsx",
    ]) {
      expect(
        sourceLayers(file),
        `${file} must take its layer from the scale`,
      ).toContain("z-app-chrome");
    }
  });

  it("keeps the bounded non-scrim popovers under the exit", () => {
    // Two more surfaces that were filed in the modal tier without being modals.
    // Neither is mounted here, so the assertion is on the declared step.
    for (const file of [
      "src/shared/components/Results/InventoryDeductionCard.tsx",
      "src/shared/components/Calculator/FieldCustomizer.tsx",
    ]) {
      const layers = sourceLayers(file);
      expect(
        layers.length,
        `${file} must take its layer from the scale`,
      ).toBeGreaterThan(0);
      for (const layer of layers) {
        expect(
          scaleStep(layer),
          `${file} (${layer}) must stay under the exit`,
        ).toBeLessThan(scaleStep("z-shell-chrome"));
      }
    }
  });

  it("files every menu at the dropdown step, not as a scrim", () => {
    // The last non-scrim occupants of the tiers they do not belong to. None can
    // reach Focus Mode (the nav chrome is unmounted there), so none is part of
    // the occlusion bug — but a menu left at z-50 or on a bare literal is how
    // this scale was breached twice, and the two Headers are the pair that
    // drifted apart last time (the bottom nav was 50 on web and 40 on desktop
    // for the same component). Every one of these is a `role="menu"` the user is
    // actively operating, so they belong with Select at --z-dropdown.
    //
    // The marker differs per file on purpose: `MoreMenu` is the one
    // `useDismissablePopover` panel with no ARIA role at all, which
    // `focusMode.ts` calls out by name — it needs no marker because it is
    // navigation chrome and so does not exist while Focus Mode is on. The other
    // three are `role="menu"`.
    const menus: Array<[string, string]> = [
      [
        "src/shared/components/AppShell/MoreMenu.tsx",
        'data-testid="more-menu"',
      ],
      ["src/shared/components/Header/Header.tsx", 'role="menu"'],
      ["src/platform/desktop/components/Header/Header.tsx", 'role="menu"'],
      ["src/shared/components/ui/TutorialLauncher.tsx", 'role="menu"'],
    ];
    for (const [file, marker] of menus) {
      const src = fs.readFileSync(resolve(process.cwd(), file), "utf8");
      expect(src, `${file} must actually render a menu`).toContain(marker);
      expect(
        sourceLayers(file),
        `${file} must take its band from the scale, not a literal`,
      ).toEqual(["z-dropdown"]);
    }
  });

  it("pins every z-50 in the tree, by occurrence and not by file", () => {
    // The audit, done so it can fail.
    //
    // The previous version of this test was a per-file boolean: "does this file
    // contain a scrim?" A file with one scrim therefore passed even with a
    // second, unrelated z-50 sitting in it, and the covered list held 12 files
    // while 14 files carry a scrim-shaped z-50 — so the two it omitted were
    // entirely unpinned. That is false assurance from a test whose name claims
    // more than it checks, and it shipped on top of a rule that was itself false:
    // Header.tsx and MobileSettingsSheet.tsx each put a mobile-sheet PANEL in
    // the scrim tier alongside its own backdrop.
    //
    // So the rule is stated as what it actually is — the dimming backdrop plus
    // the panel that answers it — and this counts OCCURRENCES in every file in
    // the tree, with the covered set derived rather than trusted.
    // The derivation and the classifier are the documented, fixture-tested
    // helpers at the top of this file, NOT inline regexes. They were inline
    // here, which is why two of their properties were never tested: that a
    // multi-line class string is still found, and that a z-50 in a comment is
    // not. Both are asserted above, where a change to either is visible.
    //
    // 1. Derive the set: every file in src that paints a z-50, comments
    //    excluded. Token scan rather than a `className=` adjacency heuristic, so
    //    a class string that wraps cannot hide a layer from the audit.
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "node_modules") {
            walk(full);
          }
          continue;
        }
        if (!/\.(tsx|ts)$/.test(entry.name)) continue;
        if (paintsZ50(fs.readFileSync(full, "utf8"))) {
          found.push(full.replace(`${process.cwd()}/`, ""));
        }
      }
    };
    walk(resolve(process.cwd(), "src"));

    // 2. The covered set may not fall behind the tree, or a new z-50 is
    //    silently unpinned. This is what catches a file nobody thought to list.
    const covered = [
      "src/shared/components/ui/ComparisonModal.tsx",
      "src/shared/components/ui/ConfirmDialog.tsx",
      "src/shared/components/ui/ConsentModal.tsx",
      "src/shared/components/ui/DataSyncModal.tsx",
      "src/shared/components/ui/PrivacyPolicy.tsx",
      "src/shared/components/Calculator/HistoryTab/HistoryTab.tsx",
      "src/shared/components/Calculator/QuoteSection.tsx",
      "src/shared/components/Catalog/CatalogTab.tsx",
      "src/shared/components/Catalog/CustomerTab.tsx",
      "src/shared/components/Catalog/FilamentInventory.tsx",
      "src/shared/components/Catalog/ProductInventory.tsx",
      "src/shared/components/Header/Header.tsx",
      "src/platform/web/components/MobileSettingsSheet.tsx",
      "src/shared/components/SpoolShelf/SpoolForm.tsx",
    ].sort();
    expect(
      found.sort(),
      "every file with a class-level z-50 must be covered here; list one that is missing",
    ).toEqual(covered);

    // 3. Occurrence scope. In every covered file, the number of z-50s must be
    //    exactly the number of backdrops plus the number of sheet panels, so a
    //    second z-50 of any other kind cannot ride along inside a file that
    //    already has a scrim.
    for (const file of covered) {
      // Still file-scoped, and that is a known limit rather than a solved
      // problem: a panel in one file paired with a backdrop in ANOTHER is not
      // detectable from source, because the two are never in the same string
      // and the render tree is what relates them. What the count closes is the
      // half that is decidable — more panels than backdrops inside one file.
      expect(
        scopeFault(
          file,
          censusZ50(fs.readFileSync(resolve(process.cwd(), file), "utf8")),
        ),
        `${file} is outside the rule this audit claims to enforce`,
      ).toBeNull();
    }
  });
});

/**
 * Defect 4 — the guided tour is an OWNING surface, and the rule said it was not.
 *
 * The tour is a scrim (`rgba(0,0,0,0.6)`, click-to-dismiss) with a card the user
 * is meant to answer: it has a scrim, it takes a click, and it takes Escape
 * (`finishTutorial()`, Tutorial.tsx:504). By ownership that puts it in the same
 * class as a scrim modal, so it is CORRECT for it to sit above the exit, and
 * correct for the exit to yield while it is up.
 *
 * What was wrong was the rule text, which claimed the tooltip was "the one
 * surface allowed above shell chrome" and that "anything clickable" was
 * forbidden there. 55 and 56 are above 45, and the tour card is clickable. The
 * rule was describing a tree it did not match, which is how a second hole got
 * in after the first was closed.
 *
 * `App.tsx:93` mounts the tutorial outside the Focus Mode guard on purpose, and
 * `App.focusMode.test.tsx` pins that — but it pins it with a MOCK
 * (`Tutorial: () => <div data-testid="tutorial" />`), so what it actually
 * asserts is that the component is still mounted, never that a scrim exists.
 * The decision stands, unchanged; these tests are what finally exercise it. A
 * keyboard user, with no focus trap to stop them, can Tab to the
 * FocusModeButton and press Enter mid-tour — the sequence modelled here.
 */
describe("focus mode — the guided tour owns the screen, and the exit yields", () => {
  function TourHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        {/* The anchor the first spotlighted step looks for. */}
        <div data-tutorial="material" data-testid="tour-anchor" />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
        {/* As App.tsx:93 mounts it: outside the Focus Mode guard. */}
        <Tutorial />
      </>
    );
  }

  function renderTourHarness(): void {
    render(
      <NavigationProvider>
        <TourHarness />
      </NavigationProvider>,
    );
  }

  function startTour(): void {
    useLayoutStore.setState({ layoutMode: "classic" });
    act(() => {
      useTutorialStore.getState().startTutorial();
    });
  }

  /** The real scrim, found by its test id rather than by its class. */
  function tourScrim(): HTMLElement {
    return screen.getByTestId("tutorial-overlay");
  }

  it("mounts the REAL tour in Focus Mode and layers it as an owning surface", () => {
    renderTourHarness();
    startTour();
    enterFocusMode();

    // The real component, the real scrim, the real card. Mocking the tutorial is
    // what `App.focusMode.test.tsx` does, and it is why this went uncaught.
    const scrim = tourScrim();
    expect(scrim).toBeInTheDocument();
    const card = document.querySelector<HTMLElement>('[data-tutorial="true"]');
    expect(card, "the real tour card must be up").not.toBeNull();

    // Declared steps, not magic literals — the rule can only be true of the
    // tree if every layer in it is named.
    expect(resolvedStep(scrim)).toBe("z-tour");
    expect(resolvedStep(card!)).toBe("z-tour-card");

    // And the relationship is asserted deliberately, not tolerated: an owning
    // surface belongs above the exit, because it owns the screen and the key.
    expect(scaleStep("z-tour")).toBeGreaterThan(scaleStep("z-shell-chrome"));
    expect(scaleStep("z-tour-card")).toBeGreaterThan(scaleStep("z-tour"));
  });

  it("gives Escape to the tour, and the exit is operable the moment it ends", () => {
    // "Always reachable" stated honestly: while an owning surface is up, the
    // exit is not what responds — the owning layer is, and it ends on that same
    // key. One key, one layer, and the exit is back. This is the contract the
    // exit has had for scrim modals since the first commit; the tour is the same
    // class, so it gets the same contract, and the spec's "always" is NOT
    // narrowed — the exit is never destroyed and never trapped, only deferred.
    renderTourHarness();
    startTour();
    enterFocusMode();
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(
      useNavigationPrefsStore.getState().focusMode,
      "the tour owns Escape, so the mode must survive it",
    ).toBe(true);
    expect(screen.queryByTestId("tutorial-overlay")).toBeNull();

    // And the exit now works, for real.
    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);
    fireEvent.click(exit);
    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });

  it("is the scrim, not the exit, that the tour intercepts", () => {
    // The defect was never "the exit is under an opaque scrim" — that is what a
    // tour IS. It was that the scrim had no declared owner. It takes the click,
    // and taking it is what dismisses the tour.
    renderTourHarness();
    startTour();
    enterFocusMode();

    fireEvent.click(tourScrim());

    expect(useTutorialStore.getState().isActive).toBe(false);
    expect(useNavigationPrefsStore.getState().focusMode).toBe(true);
    expect(exitBar()).toBeInTheDocument();
  });
});
/**
 * The Tooltip is the one INERT surface allowed above the exit, and that
 * exception is asserted rather than assumed.
 *
 * It cannot simply join the passive band, because it is a global annotator and
 * its trigger can live inside any layer: a trigger added inside a Select menu
 * (60) or the guide drawer (70) tomorrow must not produce help text that
 * renders behind its own trigger. It also cannot stay an undocumented
 * `zIndex: 100`, which was the defect — a magic number that outranked
 * everything, including the exit.
 *
 * What makes it safe above the exit is inertness: `pointer-events-none` on the
 * bubble and `visibility: hidden` whenever it is closed. It may overlap the
 * exit while a trigger is hovered, and the exit stays operable. These tests
 * hold that line: a named step from the scale, no interception, and a real
 * click on the real exit with the real tooltip mounted.
 *
 * Worth being precise about, because the first version of this comment was
 * wrong twice over: no call site needs the top band today. `InputGroup` renders
 * its tooltip only when the `tooltip` prop is passed, and no `tooltip=` call
 * site is inside a modal, a panel or a menu — so this is a rule about the
 * primitive, pinned by a test, not a claim about a usage that does not exist.
 */
describe("focus mode — the tooltip exception holds", () => {
  function TooltipHarness(): React.ReactElement {
    const activeTab = useActiveTab();
    const navigateToTab = useNavigateToTab();
    return (
      <>
        <FocusModeButton />
        <AppShell
          activeTab={activeTab}
          onTabChange={navigateToTab}
          mainClassName="main-normal"
          mainFocusClassName="main-focus"
        />
        <Tooltip content="Ajuda" delay={0}>
          <button type="button">tooltip-trigger</button>
        </Tooltip>
      </>
    );
  }

  /** The floating bubble, found through its inline z-index like the DOM does. */
  function tooltipBubble(): HTMLElement {
    const bubble = screen
      .getByText("Ajuda")
      .closest<HTMLElement>('[style*="z-index"]');
    expect(
      bubble,
      "the real tooltip bubble must be portaled into the document",
    ).not.toBeNull();
    return bubble!;
  }

  it("takes a named step from the scale instead of an undocumented 100", () => {
    render(
      <NavigationProvider>
        <TooltipHarness />
      </NavigationProvider>,
    );
    enterFocusMode();

    // The defect: a bare 100, above every declared step, documenting nothing.
    expect(resolvedStep(tooltipBubble())).toBe("z-tooltip");
    expect(scaleStep("z-tooltip")).toBeGreaterThan(scaleStep("z-panel"));
  });

  it("cannot intercept the exit, so being above it is survivable", () => {
    render(
      <NavigationProvider>
        <TooltipHarness />
      </NavigationProvider>,
    );
    enterFocusMode();

    const bubble = tooltipBubble();
    expect(
      bubble.className,
      "the exception is only sound while the bubble is inert",
    ).toContain("pointer-events-none");
    // Same anchoring as the toast case: the click is the proof that the
    // exception is load-bearing, the layer is what makes it non-vacuous.
    expect(resolvedStep(bubble)).toBe("z-tooltip");

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);
    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
  });
});

describe("focus mode — the exit survives the real StlPreview fullscreen overlay", () => {
  it("opens the REAL portal from inside Focus Mode and leaves the exit on top of it", () => {
    // MaterialSection mounts StlPreview at three sites inside the calculator,
    // and Focus Mode forces activeTab: "calculator" — so this overlay is
    // reachable while the mode is on. Driving the real component is the point:
    // a stub would delete the very element that caused the defect.
    renderHarness();
    enterFocusMode();

    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));

    const overlay = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    expect(
      overlay,
      "the real fullscreen portal must be in the DOM",
    ).not.toBeNull();
    expect(resolvedStep(overlay!)).toBe("z-viewer");
    // The defect: z-[100] against the exit's z-[60].
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(overlay!)),
    );
  });

  it("leaves the exit focusable and clickable while the overlay is up", () => {
    // Layering alone is not the guarantee: the overlay is `fixed inset-0`, so
    // it also INTERCEPTS pointer events over the exit. jsdom has no layout and
    // no hit-testing, so the interception property is asserted structurally —
    // nothing may sit in a layer above the exit while the overlay is open —
    // and the operability of the control is then asserted by actually using it,
    // because a number nobody clicks is not a reachable exit.
    renderHarness();
    enterFocusMode();
    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));
    const overlay = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    expect(overlay).not.toBeNull();
    expect(scaleStep(resolvedStep(exitBar()))).toBeGreaterThan(
      scaleStep(resolvedStep(overlay!)),
    );
    // The exit is a sibling of the portal, not swallowed by it.
    expect(overlay).not.toContainElement(exitButton());

    const exit = exitButton();
    act(() => exit.focus());
    expect(document.activeElement).toBe(exit);

    fireEvent.click(exit);

    expect(useNavigationPrefsStore.getState().focusMode).toBe(false);
    expect(screen.queryByTestId("focus-mode-exit")).toBeNull();
  });

  it("gives Escape to the overlay rather than taking it for the exit", () => {
    // One Escape, one layer. The overlay declares role="dialog", which is what
    // `escapeIsOwnedByOverlay` reads — this is the same rule the stage-3
    // Manage Visibility dialog relies on, asserted against a real overlay.
    renderHarness();
    enterFocusMode();
    fireEvent.click(screen.getByRole("button", { name: "stl.fullscreen" }));

    fireEvent.keyDown(window, { key: "Escape" });

    expect(
      useNavigationPrefsStore.getState().focusMode,
      "the overlay owns the key, so the mode must survive",
    ).toBe(true);
  });
});
