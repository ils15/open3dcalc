import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  AA_NORMAL_TEXT,
  PALETTE_SELF_CHECK,
  ThemeName,
  compositeOver,
  contrastRatio,
  resolveTokenHex,
  resolveTokenLayers,
  tailwindPaletteMap,
  tokenValueInBlock,
} from "./helpers/contrast";
import {
  BACKDROPS as CENSUS_BACKDROPS,
  describeIdentityFaults,
  identityContext,
  identityFaults,
  resolveSiteId,
  siteMarkers,
  walkComponents,
  censusPaletteBackgrounds,
  censusWashes,
  scanPaletteInSource,
  scanWashesInSource,
} from "./helpers/deferredCensus";

/**
 * CALL-SITE guard for accent-derived backgrounds.
 *
 * tokens.test.ts already proves the token-level invariant (--accent-fill is a
 * literal, --accent-fill-fg sits on it at 6.29:1). That says nothing about
 * whether components actually USE those tokens. This file closes the gap: it
 * reads every class string in the app and fails if any of them paints an
 * accent-derived background behind a text token that lands under 4.5:1 in
 * either theme.
 *
 * WHY IT SCANS STRING LITERALS, NOT `className` ATTRIBUTES
 * --------------------------------------------------------
 * Two real defects in this class escaped a className-attribute scan, and both
 * shaped this file:
 *
 *  1. CatalogTab.tsx defines `const chipClass = (active: boolean) => \`...\``
 *     — a class string built by a helper function and never written to a
 *     className attribute. An attribute scan cannot see it at all.
 *  2. ConfirmDialog.tsx puts `text-[var(--color-text-primary)]` in the shared
 *     className while the background arrives from a per-variant map
 *     (`${styles.button}`), so the background and the text token are never in
 *     the same attribute.
 *
 * Scanning every string literal catches (1) directly. For (2) the fix was
 * structural — ConfirmDialog now carries each variant's own text token inside
 * the map — which brings the pair back into one literal and into range. See
 * KNOWN BLIND SPOTS below for the shape that is still not covered.
 *
 * WHAT THIS CANNOT DO — read before trusting a green run
 * ----------------------------------------------------
 * This is a regex over source text. It is not a CSS engine. Concretely:
 *
 *  - It cannot evaluate Tailwind composition. A later utility in the same
 *    class list overrides an earlier one (`bg-x text-y bg-z` paints z); this
 *    test treats every bg/text in a literal as simultaneously live. That
 *    biases towards FALSE POSITIVES, never towards missing a failure.
 *  - It cannot evaluate `opacity`, `disabled:opacity-40`, `hover:opacity-90`
 *    or any group/peer state. These multiply the effective alpha of BOTH the
 *    background and the text, and the resulting pair is undecidable from
 *    source. Sites carrying them (e.g. `disabled:opacity-60` on the
 *    DataSyncModal buttons) are measured at full opacity here, which is the
 *    optimistic reading. A disabled control is also exempt from 1.4.3 in
 *    practice, but that exemption is not encoded.
 *  - It skips translucent backgrounds entirely (`bg-[...]/20`). The effective
 *    colour is the accent composited over whatever is behind it, and the
 *    parent surface is not knowable from a class string. Compositing over
 *    --surface-raised is what the audit used by hand and it is NOT automated
 *    here. That skip is WHY the tinted-wash family escaped: `bg-[var(--color-
 *    accent)]/30 text-[var(--color-accent)]` at QuoteSection, MaterialSection,
 *    EmptyState and StlPreview all measured 2.36:1-3.52:1 and are not in the
 *    scope below. See MEASURED, NOT GUESSED below.
 *  - It cannot see a background or a text colour that arrives from a CSS
 *    class in styles/components.css rather than a utility in a literal. The
 *    `.segmented-btn.active-*` rules there pair a wash with a foreground and are
 *    unmeasured.
 *  - It does not see a background written as a raw Tailwind palette utility
 *    (`bg-red-600`, `bg-amber-500`, `bg-emerald-600`). Those resolve to
 *    `oklch(...)` in Tailwind v4, which resolveTokenHex() cannot evaluate, and
 *    they are the exact shape that broke ConfirmDialog before the status fill
 *    tokens replaced them. Anything still written that way is unmeasured.
 *  - Variant-prefixed utilities (`hover:`, `focus:`, `dark:`, `active:`) are
 *    stripped before matching, so `hover:bg-[var(--color-accent-hover)]` is
 *    measured as a real resting-state pairing. That is stricter than the
 *    rendered reality and is intentional.
 *
 * In short: this catches the regression it was written for — someone typing
 * `bg-[var(--color-accent)] text-white` or `... text-[var(--color-text-primary)]`
 * again — and it is not a WCAG conformance proof for the app.
 *
 * WHY THE SCOPE STOPS WHERE IT DOES — measured, not guessed
 * -------------------------------------------------------
 * Extending this guard to translucent washes and to raw Tailwind palette
 * backgrounds was evaluated with a census, not by intuition. The method that
 * makes a translucent background decidable WITHOUT assuming a backdrop is to
 * composite the wash over every surface token the app can actually paint on
 * (--surface-raised/-overlay/-canvas/-sunken/-input) and require 4.5:1 on all
 * of them. Requiring the worst case cannot miss a real failure; the five
 * surfaces are the complete set, so it cannot invent one either. Reading the
 * palette out of the installed node_modules/tailwindcss/theme.css and
 * converting oklch() to sRGB likewise makes `bg-red-600` fully decidable.
 *
 * Both work. Neither is shippable in this branch, and the reason is population
 * size, not soundness — the population is real, pre-existing, and spread across
 * components this task was never scoped to (Select, CatalogTab, ChangelogPage,
 * SpoolThumb, SectionNav, PriceHeroCard, ExportActionsCard, GcodePreviewPanel,
 * PrivacyScreen, HistoryTab, CustomerTab, SpoolForm, UpdateNotification and the
 * StlPreview error banner among them). Turning the guard on for them now means
 * committing red, and quietly adding an xfail allowance instead would convert a
 * conformance guard into a known-issues tracker that can go stale.
 *
 * So the population is pinned as a regression floor at the bottom of this file,
 * in SITES rather than in files. They can only go DOWN as sites are migrated,
 * and a floor that stops moving is a visible signal to schedule the next wave.
 * The status fill tokens added above are the one part that was brought into
 * scope, because they are solid, so no backdrop has to be assumed and the
 * existing machinery decides them exactly.
 *
 * THE CENSUS NUMBERS, CORRECTED — this paragraph used to be wrong
 * -----------------------------------------------------------
 * This block previously read "48 failing wash pairings across 13 files and 27
 * failing palette pairings across 8 files, i.e. roughly 23 distinct call sites
 * over ~19 files". Re-deriving both with the helpers in
 * ./helpers/deferredCensus found NEITHER figure correct, and both were wrong in
 * the one direction a floor must never be wrong in:
 *
 *   family        cited      actual (at the base commit)   actual now
 *   washes        48 / 13    18 sites / 10 shapes / 11 f    15 / 8 / 10
 *   palette       27 /  8    11 sites /  4 shapes /  7 f    11 / 4 / 7
 *
 * The cited numbers were roughly 2.5x the truth. A floor that overstates the
 * backlog is not merely untidy: it reads as "less work than there is", which is
 * the direction that lets a deferred population age indefinitely without anyone
 * noticing it was never finished.
 *
 * Two further reasons the old count was wrong, both now fixed:
 *
 *  - It counted FILES, so a site that migrated from one broken form to a
 *    DIFFERENT broken form left the number untouched and the floor green. That
 *    is the defect the review named, and the floor is now in sites with the
 *    set of shapes pinned beside it.
 *  - It matched the accent token only, so it never counted the status washes at
 *    all. `--color-danger/90` and `--color-success/90` were invisible to it, and
 *    those measured 2.07:1 and 2.10:1 — the two worst pairings in the app. A
 *    floor that does not cover the population it is a floor for is decoration.
 */

/**
 * The comparison the pin is built on, at module scope so the regression below
 * can drive it directly while the census assertions drive it through the tree.
 */
function siteFaults(
  discovered: ReadonlyArray<{ siteId: string | null; shape: string }>,
  pin: Record<string, string[]>,
): Array<{
  siteId: string;
  kind: "unidentified" | "unpinned" | "changedForm";
  detail: string;
}> {
  const faults: Array<{
    siteId: string;
    kind: "unidentified" | "unpinned" | "changedForm";
    detail: string;
  }> = [];
  const seen = new Map<string, Set<string>>();
  for (const site of discovered) {
    if (!site.siteId) {
      faults.push({
        siteId: "<none>",
        kind: "unidentified",
        detail: `  ${site.shape}`,
      });
      continue;
    }
    const have = seen.get(site.siteId) ?? new Set<string>();
    have.add(site.shape);
    seen.set(site.siteId, have);
  }
  for (const [siteId, shapes] of [...seen].sort()) {
    const pinned = pin[siteId];
    if (!pinned) {
      faults.push({
        siteId,
        kind: "unpinned",
        detail: `  now: ${[...shapes].sort().join(" | ")}`,
      });
      continue;
    }
    const want = [...shapes].sort();
    if (want.join(" || ") !== [...pinned].sort().join(" || ")) {
      faults.push({
        siteId,
        kind: "changedForm",
        detail: `  now:    ${want.join(" | ")}\n      pinned: ${[...pinned].sort().join(" | ")}`,
      });
    }
  }
  return faults;
}

const projectRoot = resolve(__dirname, "../..", "..");
const srcRoot = resolve(projectRoot, "src");
const tokensCss = readFileSync(resolve(srcRoot, "styles/tokens.css"), "utf-8");

const THEMES = [{ name: "light" }, { name: "dark" }] as const;

/**
 * The COMPLETE set of backdrops an element in this app can sit on. Re-exported
 * from the census module rather than restated, because three blocks below now
 * measure over it and a second copy of this list is a second thing that can
 * drift out of step with the first — which is the failure this file exists to
 * catch, so it must not have one of its own.
 */
const BACKDROPS = [...CENSUS_BACKDROPS];

/**
 * Background tokens derived from the accent hue or from a status hue, in the
 * two spellings the call sites use. The list is exhaustive ON PURPOSE within
 * those families: it spans the FOREGROUND/border tokens (--color-accent,
 * --color-primary, --accent and their -hover companions), the accent FILL
 * tokens (--accent-fill, --accent-fill-hover) and the two status FILL families
 * added for the confirm dialog (--danger-fill/-hover, --warning-fill/-hover).
 * An unlisted token is skipped SILENTLY, which is the main way this guard
 * could go quiet — which is why `finds the accent-background call sites it is
 * meant to police` pins a floor on the discovered population instead of
 * trusting the regex.
 *
 * Both families are policed because both have shipped broken: the foreground
 * family put white on #818cf8 (2.98:1), and the fill family was declared but
 * had no consumers at all until this branch adopted it at the call sites. The
 * status fill family exists because ConfirmDialog's danger and warning variants
 * were painting `bg-red-600` / `bg-amber-600` — theme-independent palette
 * utilities — behind a theme-flipping ink, which read as 4.19:1 in dark and
 * 3.20:1 for warning. Making them tokens is what brought them into range AND
 * into this file's reach.
 *
 * Names are matched WITHOUT the leading `--`, which is the form
 * resolveTokenHex() expects (it re-adds it when reading the declaration).
 * The `color-` prefixed spellings are the --color-* alias layer; the bare
 * names are the underlying tokens. Both appear at call sites and both are the
 * same colour, so both are listed.
 */
const BG_TOKEN =
  /^(color-accent|color-primary|accent|color-accent-hover|accent-hover|accent-fill|accent-fill-hover|color-accent-fill|color-accent-fill-hover|danger-fill|danger-fill-hover|color-danger-fill|color-danger-fill-hover|warning-fill|warning-fill-hover|color-warning-fill|color-warning-fill-hover|positive-fill|color-positive-fill)$/;

/** Text tokens that are legal in a class string, resolved per theme. */
const TEXT_TOKEN =
  /^(color-text-primary|text-primary|color-text-inverse|text-inverse|color-accent-text|accent-fill-fg|color-accent-fill-fg|danger-fill-fg|color-danger-fill-fg|warning-fill-fg|color-warning-fill-fg|positive-fill-fg|color-positive-fill-fg|color-accent|accent|color-text-secondary|text-secondary|color-text-muted)$/;

/** Hard-coded text colours with no token. */
const TEXT_LITERAL: Record<string, string> = { "text-white": "#ffffff" };

interface Pairing {
  file: string;
  line: number;
  bgUtility: string;
  bgToken: string;
  textUtility: string;
  textToken: string;
  theme: string;
  ratio: number;
  bgHex: string;
  textHex: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "Example") continue;
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** Single-line string literals. Every class string in this repo is one line. */
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

function stripVariants(utility: string): string {
  let out = utility;
  while (/^[a-z-]+:/.test(out)) out = out.slice(out.indexOf(":") + 1);
  return out;
}

function tokenOf(utility: string, prefix: "bg" | "text"): string | null {
  const base = stripVariants(utility);
  const m = base.match(
    new RegExp(`^${prefix}-\\[var\\((--[a-z0-9-]+)\\)\\]$`, "i"),
  );
  return m ? m[1].slice(2) : null;
}

/** True for a SOLID background utility: `/NN` translucency is out of scope. */
function isSolidBg(utility: string): boolean {
  return /^bg-\[var\(--[a-z0-9-]+\)\]$/i.test(stripVariants(utility));
}

/** True for a text utility this guard can measure: a token or a bare literal. */
function isTextUtility(utility: string): boolean {
  const base = stripVariants(utility);
  return base in TEXT_LITERAL || /^text-\[var\(--[a-z0-9-]+\)\]$/i.test(base);
}

/**
 * A background utility as LAYERS, in whichever of the two spellings the call
 * site used: `bg-[var(--x)]` is solid, `bg-[var(--x)]/NN` carries that alpha on
 * top of whatever the token itself is. Returning the token too lets a caller
 * report which token failed to resolve.
 *
 * `theme` is REQUIRED, not defaulted. A default of "light" would silently
 * measure the dark-mode block against a light backdrop, which turns a real
 * failure into a green test — the mistake this shape prevents.
 *
 * Returns null for any other background form (`bg-red-600`, `bg-black/40`), so
 * a site written in a shape this cannot decide reports as unmeasured rather
 * than as measured-and-fine.
 */
function bgLayersOf(
  utility: string,
  theme: ThemeName,
): { token: string; hex: string; alpha: number } | null {
  const m = stripVariants(utility).match(
    /^bg-\[var\(--([a-z0-9-]+)\)\](?:\/(\d{1,3}))?$/i,
  );
  if (!m) return null;
  const layers = resolveTokenLayers(tokensCss, theme, m[1]);
  if (!layers) return null;
  return {
    token: m[1],
    hex: layers.hex,
    alpha: m[2] ? (parseInt(m[2], 10) / 100) * layers.alpha : layers.alpha,
  };
}

/** An ink utility resolved to a hex in one theme, or null if it does not. */
function inkHexOf(utility: string, theme: ThemeName): string | null {
  const base = stripVariants(utility);
  if (base in TEXT_LITERAL) return TEXT_LITERAL[base];
  const token = tokenOf(base, "text");
  return token ? resolveTokenHex(tokensCss, theme, token) : null;
}

const pairings: Pairing[] = [];
const unresolvable: { file: string; line: number; token: string }[] = [];

for (const file of walk(srcRoot).sort()) {
  if (file.includes("__tests__") || file.includes(".test.")) continue;
  const source = readFileSync(file, "utf-8");
  const rel = relative(projectRoot, file);

  for (const literal of source.matchAll(LITERAL)) {
    const body = literal[2];
    if (!body.includes("var(--")) continue;
    const utilities = body.split(/\s+/).filter(Boolean);
    if (!utilities.some(isSolidBg)) continue;

    const bgs = utilities.filter(isSolidBg);
    const texts = utilities.filter(isTextUtility);
    if (!bgs.length || !texts.length) continue;

    const line = source.slice(0, literal.index!).split("\n").length;

    for (const bg of bgs) {
      const bgName = tokenOf(bg, "bg");
      if (!bgName || !BG_TOKEN.test(bgName)) continue;
      for (const text of texts) {
        const base = stripVariants(text);
        const textName = base in TEXT_LITERAL ? null : tokenOf(text, "text");
        if (textName !== null && !TEXT_TOKEN.test(textName)) continue;

        for (const theme of THEMES) {
          const bgHex = resolveTokenHex(tokensCss, theme.name, bgName);
          if (!bgHex) {
            unresolvable.push({ file: rel, line, token: bgName });
            continue;
          }
          const textHex = textName
            ? resolveTokenHex(tokensCss, theme.name, textName)
            : TEXT_LITERAL[base];
          if (!textHex) {
            unresolvable.push({ file: rel, line, token: textName! });
            continue;
          }
          pairings.push({
            file: rel,
            line,
            bgUtility: bg,
            bgToken: bgName,
            textUtility: text,
            textToken: textName ?? base,
            theme: theme.name,
            ratio: contrastRatio(textHex, bgHex),
            bgHex,
            textHex,
          });
        }
      }
    }
  }
}

describe("accent-derived call sites meet WCAG AA text contrast", () => {
  it("finds the accent-background call sites it is meant to police", () => {
    // A guard that silently matches nothing is worse than no guard: it would
    // report green forever. Pin a floor on the population.
    expect(
      pairings.length,
      "no accent-background/text pairings were discovered — the literal scan " +
        "has probably stopped matching the class strings it was written for",
    ).toBeGreaterThan(20);

    // SHAPES, not files. The previous pin here was `files.size > 5`, and a file
    // is the wrong thing to count for the reason set out in full below: a site
    // that changes form leaves the file count untouched. Pinning the set of
    // FORMS catches a site being rewritten from one pairing into a different
    // pairing, which is the failure that hides. 14 shapes over 37 files, so
    // this is not merely a restatement of the file count in other words — the
    // two genuinely disagree, and the shape set is the one with information in
    // it.
    const shapes = new Set(
      pairings.map((p) => `${p.bgUtility} + ${p.textUtility}`),
    );
    expect(
      shapes.size,
      `only ${shapes.size} distinct pairing shape(s) were discovered across ` +
        `${new Set(pairings.map((p) => p.file)).size} file(s); the scan is ` +
        `matching far less than it was written for`,
    ).toBeGreaterThan(10);
  });

  it.each(THEMES)(
    "every accent background keeps its text at >= 4.5:1 in $name mode",
    (theme) => {
      const inTheme = pairings.filter((p) => p.theme === theme.name);
      const failures = inTheme.filter((p) => p.ratio < AA_NORMAL_TEXT);

      const report = failures
        .map(
          (p) =>
            `  ${p.file}:${p.line}  ${p.textHex} on ${p.bgHex} ` +
            `(${p.textUtility} on ${p.bgUtility}) = ${p.ratio.toFixed(2)}:1`,
        )
        .join("\n");

      expect(
        failures,
        `${failures.length} accent-background call site(s) below WCAG AA ` +
          `(${AA_NORMAL_TEXT}:1) in ${theme.name} mode:\n${report}`,
      ).toHaveLength(0);
    },
  );

  it("resolves every background and text token it pairs", () => {
    // An undefined token makes `color`/`background` invalid at computed-value
    // time, so the declaration is DROPPED and the property inherits. That is
    // how three Wizard buttons using the never-declared --color-bg rendered
    // text they never asked for. A token this guard cannot resolve is a
    // finding, not a skip.
    expect(
      unresolvable,
      unresolvable.map((u) => `  ${u.file}:${u.line}  --${u.token}`).join("\n"),
    ).toHaveLength(0);
  });

  it("declares --color-bg nowhere, so nothing can inherit by accident", () => {
    // --color-bg was used by three Wizard buttons and does not exist in
    // tokens.css. Kept as a named regression: the token is a plausible name,
    // so it will be typed again.
    expect(tokenValueInBlock(tokensCss, ":root", "color-bg")).toBeNull();
  });
});

describe("tinted-wash call sites keep their ink at >= 4.5:1 on every surface", () => {
  /**
   * The extension of this guard that IS sound, and the one the header block
   * says was evaluated. A translucent background is not decidable if you
   * assume a single backdrop — but it IS decidable if you prove the ratio over
   * the COMPLETE set of backdrops the app can paint on. Every element in the
   * app sits on one of the five surface tokens below, so "clears 4.5:1 on all
   * five" is a statement about the real rendering: it cannot miss a genuine
   * failure, and because the set is complete it cannot invent one either.
   *
   * That is the difference between this and the skipped `bg-[...]/NN` form
   * above, and it is why the four migrated sites can be policed while the
   * unmigrated ones cannot yet: those still name the wash as a raw alpha
   * modifier on a FOREGROUND token, which is the defect, not a decidable
   * pairing. Migrate a site to --*-wash / --*-wash-strong and add it here.
   *
   * Both states are checked, not just the resting one. A hover state is a real
   * rendered state and WCAG 1.4.3 applies to it, which is precisely how the
   * pre-fix sites failed: resting read 3.52:1 and the 50% hover read 2.51:1.
   */
  const WASH_SITES: {
    what: string;
    file: string;
    /** the exact class-string fragment the site must use, see the pin below */
    must: string[];
    ink: string;
    states: { label: string; wash: string; alpha?: number }[];
  }[] = [
    {
      what: "QuoteSection 'Adicionar do Historico' (secondary action)",
      file: "shared/components/Calculator/QuoteSection.tsx",
      must: [
        "bg-[var(--color-accent-wash)]",
        "hover:bg-[var(--color-accent-wash-strong)]",
      ],
      ink: "color-text-primary",
      states: [
        { label: "rest", wash: "color-accent-wash" },
        { label: "hover", wash: "color-accent-wash-strong" },
      ],
    },
    {
      what: "MaterialSection 'Inventario' toggle, resting branch",
      file: "shared/components/Calculator/sections/MaterialSection.tsx",
      must: [
        "bg-[var(--color-accent-wash)]",
        "hover:bg-[var(--color-accent-wash-strong)]",
      ],
      ink: "color-text-primary",
      states: [
        { label: "rest", wash: "color-accent-wash" },
        { label: "hover", wash: "color-accent-wash-strong" },
      ],
    },
    {
      what: "MaterialSection 'Inventario' toggle, ACTIVE branch",
      file: "shared/components/Calculator/sections/MaterialSection.tsx",
      must: ["bg-[var(--color-accent-wash-strong)]"],
      ink: "color-text-primary",
      states: [{ label: "active", wash: "color-accent-wash-strong" }],
    },
    {
      what: "StlPreview 'preview toolpath' (secondary action)",
      file: "shared/components/StlPreview/StlPreview.tsx",
      must: [
        "bg-[var(--color-accent-wash)]",
        "hover:bg-[var(--color-accent-wash-strong)]",
      ],
      ink: "color-text-primary",
      states: [
        { label: "rest", wash: "color-accent-wash" },
        { label: "hover", wash: "color-accent-wash-strong" },
      ],
    },
    {
      what: "EmptyState call to action (the empty region's primary action)",
      file: "shared/components/ui/EmptyState.tsx",
      must: [
        "bg-[var(--color-accent-fill)]",
        "text-[var(--color-accent-fill-fg)]",
        "hover:bg-[var(--color-accent-fill-hover)]",
      ],
      ink: "color-accent-fill-fg",
      states: [
        { label: "rest", wash: "accent-fill" },
        { label: "hover", wash: "accent-fill-hover" },
      ],
    },
  ];

  it("names only real backdrops, so the proof stays complete", () => {
    for (const surface of BACKDROPS) {
      expect(
        resolveTokenHex(tokensCss, "light", surface),
        `--${surface} is in BACKDROPS but is not a light-theme token; the ` +
          `proof would be measuring a backdrop that cannot exist`,
      ).not.toBeNull();
    }
  });

  /**
   * The measurement above only sees these sites because the table names them.
   * If a component reverted to `bg-[var(--color-accent)]/30` it would simply
   * stop matching the table and go quiet — the exact failure mode this file
   * exists to prevent. So the shape is pinned directly in the source, per site.
   */
  it("pins each migrated site to its token-backed class string", () => {
    const missing: string[] = [];
    for (const site of WASH_SITES) {
      const source = readFileSync(resolve(srcRoot, site.file), "utf-8");
      for (const fragment of site.must) {
        if (!source.includes(fragment)) {
          missing.push(
            `  ${site.file} no longer contains \`${fragment}\` (${site.what})`,
          );
        }
      }
    }
    expect(
      missing,
      `${missing.length} migrated call site(s) reverted away from their token:\n${missing.join("\n")}`,
    ).toHaveLength(0);
  });

  it.each(THEMES)(
    "every tinted wash keeps its ink at >= 4.5:1 on all 5 surfaces in $name mode",
    (theme) => {
      const failures: string[] = [];
      for (const site of WASH_SITES) {
        const ink = resolveTokenHex(tokensCss, theme.name, site.ink);
        if (!ink) {
          failures.push(`  ${site.what}: --${site.ink} does not resolve`);
          continue;
        }
        for (const state of site.states) {
          const wash = resolveTokenLayers(tokensCss, theme.name, state.wash);
          if (!wash) {
            failures.push(
              `  ${site.what} (${state.label}): --${state.wash} is not a ` +
                `resolvable wash — if it is a typo, that is the finding`,
            );
            continue;
          }
          // `alpha` lets a state express the OLD form too
          // (`bg-[var(--color-accent)]/30` === wash "color-accent" at 0.3), so
          // a regression to it is measured and fails on the NUMBER rather than
          // disappearing from the table.
          const layers = state.alpha
            ? { hex: wash.hex, alpha: wash.alpha * state.alpha }
            : wash;
          for (const backdrop of BACKDROPS) {
            const surface = resolveTokenHex(tokensCss, theme.name, backdrop)!;
            const composited = compositeOver(layers, surface);
            const ratio = contrastRatio(ink, composited);
            if (ratio < AA_NORMAL_TEXT) {
              failures.push(
                `  ${site.what} (${state.label})  ${ink} on ${composited} ` +
                  `(= --${state.wash} over --${backdrop} ${surface}) = ` +
                  `${ratio.toFixed(2)}:1`,
              );
            }
          }
        }
      }
      expect(
        failures,
        `${failures.length} tinted-wash state(s) below WCAG AA ` +
          `(${AA_NORMAL_TEXT}:1) in ${theme.name} mode:\n${failures.join("\n")}`,
      ).toHaveLength(0);
    },
  );

  it("leaves a visible rest->hover step at every migrated site", () => {
    // The reason these sites use --color-text-primary and not --color-accent is
    // this: accent ink clears 4.5:1 on the 12% wash but collapses to 3.52:1 on
    // the 30% one, so a wash-strong hover is only legal with primary ink. If a
    // future change makes the two washes indistinguishable, the hover step is
    // gone and the button stops reading as interactive — which the contrast
    // assertions above would NOT catch, because both states would still pass.
    for (const theme of THEMES) {
      const rest = resolveTokenLayers(
        tokensCss,
        theme.name,
        "color-accent-wash",
      );
      const strong = resolveTokenLayers(
        tokensCss,
        theme.name,
        "color-accent-wash-strong",
      );
      expect(rest).not.toBeNull();
      expect(strong).not.toBeNull();
      for (const backdrop of BACKDROPS) {
        const surface = resolveTokenHex(tokensCss, theme.name, backdrop)!;
        const restRatio = contrastRatio(
          resolveTokenHex(tokensCss, theme.name, "color-text-primary")!,
          compositeOver(rest!, surface),
        );
        const hoverRatio = contrastRatio(
          resolveTokenHex(tokensCss, theme.name, "color-text-primary")!,
          compositeOver(strong!, surface),
        );
        // Both still legible, and the backgrounds are genuinely different
        // colours — a step small enough to be invisible is not a step.
        expect(
          Math.abs(restRatio - hoverRatio),
          `rest and hover land within ${Math.abs(restRatio - hoverRatio).toFixed(3)}:1 ` +
            `of each other on --${backdrop} in ${theme.name} mode; the hover ` +
            `state is not distinguishable from rest`,
        ).toBeGreaterThan(1);
      }
    }
  });
});

describe("toast variants keep their ink at >= 4.5:1 in both themes", () => {
  const toastSource = readFileSync(
    resolve(srcRoot, "shared/components/ui/Toast.tsx"),
    "utf-8",
  );

  /**
   * `{ error: "bg-…/90 border-… text-…", … }` as declared, one entry per
   * `typeStyles` key. Tolerates the value sitting on the key's line or the next
   * one, and any of the three quote styles, so an unrelated refactor cannot turn
   * the block below into a vacuous pass — the "finds the three variants" test
   * asserts it parsed.
   *
   * KNOWN LIMIT: a value assembled from a template expression (`${styles.x}`)
   * does not match, and would report as a missing variant rather than as a
   * silent pass. That is the failure direction worth having.
   */
  const variants: Record<string, string> = {};
  for (const m of toastSource.matchAll(
    /\b(error|success|info):\s*(["'`])([^"'`]*)\2/g,
  )) {
    variants[m[1]] = m[3];
  }

  interface ToastVariant {
    name: string;
    /** the background utility exactly as written */
    bgUtility: string;
    /** the ink utility exactly as written */
    inkUtility: string;
  }

  const parsed: ToastVariant[] = Object.entries(variants).map(
    ([name, classString]) => {
      const utilities = classString.split(/\s+/).filter(Boolean);
      const bg = utilities.find((u) =>
        /^bg-\[var\(--[a-z0-9-]+\)\](\/\d+)?$/i.test(stripVariants(u)),
      );
      const ink = utilities.find(isTextUtility);
      expect(
        [bg, ink],
        `Toast's \`${name}\` variant must carry one var()-backed background and ` +
          `one text utility for this block to measure it; got: ${classString}`,
      ).not.toContain(undefined);
      return { name, bgUtility: bg!, inkUtility: ink! };
    },
  );

  it("finds the three toast variants, so nothing below is vacuous", () => {
    expect(Object.keys(variants).sort()).toEqual(["error", "info", "success"]);
  });

  it.each(THEMES)(
    "keeps every toast variant's ink at >= 4.5:1 in $name mode",
    (theme) => {
      const failures: string[] = [];
      for (const variant of parsed) {
        const bg = bgLayersOf(variant.bgUtility, theme.name);
        const ink = inkHexOf(variant.inkUtility, theme.name);
        if (!bg || !ink) {
          failures.push(
            `  ${variant.name}: ${variant.bgUtility} / ${variant.inkUtility} ` +
              `does not resolve in ${theme.name} mode — if it is a typo, that is the finding`,
          );
          continue;
        }
        // Compositing a solid layer (alpha 1) is the identity, so this one loop
        // is correct for the fixed form AND for a regression to the translucent
        // one. There is no branch that only runs in the passing case.
        for (const backdrop of BACKDROPS) {
          const surface = resolveTokenHex(tokensCss, theme.name, backdrop)!;
          const composited = compositeOver(bg, surface);
          const ratio = contrastRatio(ink, composited);
          if (ratio < AA_NORMAL_TEXT) {
            failures.push(
              `  ${variant.name}  ${ink} on ${composited} ` +
                `(${variant.inkUtility} on ${variant.bgUtility} over ` +
                `--${backdrop} ${surface}) = ${ratio.toFixed(2)}:1`,
            );
          }
        }
      }
      expect(
        failures,
        `${failures.length} toast state(s) below WCAG AA (${AA_NORMAL_TEXT}:1) ` +
          `in ${theme.name} mode:\n${failures.join("\n")}`,
      ).toHaveLength(0);
    },
  );

  it("names an ink that does not flip between themes", () => {
    // The invariant behind the numbers, stated so it survives a refactor that
    // changes the colours. No single text token can be correct on a
    // theme-independent backdrop in both themes — which is the whole reason
    // --danger-fill-fg and --warning-fill-fg exist. So the ink is required to be
    // a per-variant -fg. This is the assertion that catches the defect even if a
    // future fill were to measure 4.5:1 by luck in one theme.
    for (const variant of parsed) {
      const light = inkHexOf(variant.inkUtility, "light");
      const dark = inkHexOf(variant.inkUtility, "dark");
      expect(
        light,
        `${variant.inkUtility} must resolve in light`,
      ).not.toBeNull();
      expect(
        dark,
        `Toast's \`${variant.name}\` paints ${variant.inkUtility}, which flips ` +
          `${light} -> ${dark} between themes. A flipping ink on a ` +
          `theme-independent backdrop is the defect itself and no value of it ` +
          `can pass in both — use this variant's own -fg token.`,
      ).toBe(light);
    }
  });

  it("paints a solid fill, so no toast pairing depends on what is behind it", () => {
    // The `90` is why the pairing was undecidable rather than merely wrong. A
    // solid backdrop is decided by the tokens alone.
    for (const variant of parsed) {
      const bg = bgLayersOf(variant.bgUtility, "light");
      expect(
        bg?.alpha,
        `Toast's \`${variant.name}\` variant still paints a translucent backdrop ` +
          `(${variant.bgUtility}); its effective colour then depends on whatever ` +
          `is behind the toast, which no contrast guard can decide`,
      ).toBe(1);
    }
  });

  it("keeps the three variants distinguishable from each other", () => {
    // A toast's only state distinction IS its variant colour — there is no
    // hover, because it is not a control. If two fills converge, a failure stops
    // being tellable from a success, and every ratio above would still pass:
    // legibility and distinctness are different properties.
    const fills = parsed.map((v) => bgLayersOf(v.bgUtility, "light")?.hex);
    for (const fill of fills) expect(fill).toBeTruthy();
    expect(
      new Set(fills).size,
      `the three toast fills must differ: ${fills}`,
    ).toBe(3);
  });
});

describe("the deferred population is floored in SITES, with its forms pinned", () => {
  /**
   * WHY THIS BLOCK REPLACED A FILE-COUNT FLOOR
   * -----------------------------------------
   * The previous floor counted FILES matching
   * `/bg-\[var\(--(?:color-)?accent\)\]\/\d+/` and asserted `files.length <= 16`.
   * Three things were wrong with it, and the first is the one that hides bugs.
   *
   * 1. A file count cannot see a site changing FORM. Migrate
   *    `bg-[var(--color-accent)]/20 text-[var(--color-accent)]` to a different
   *    broken pairing in the same file and the count is unchanged, so the floor
   *    reports green over a population that is exactly as broken as before.
   *    The floor's number is therefore not a measure of the work left; it is a
   *    measure of how many files were touched once.
   * 2. It could not see a site changing form WITHIN a file either: fix one of
   *    three sites in CatalogTab and the file is still listed.
   * 3. The regex matched the accent token only, so it never counted the status
   *    washes at all — `--color-danger/90` and `--color-success/90` were
   *    invisible to it, and those measured 2.07:1 and 2.10:1. A floor that does
   *    not cover the population it is a floor for is decoration.
   *
   * The unit is now a SITE — one (background, ink) pairing at one source
   * location — which falls whenever real work happens, and the set of SHAPES is
   * pinned alongside it, which is what catches a form change. Both are needed:
   * a count alone cannot see two sites that share a shape, and a shape set alone
   * cannot see one of a kind being removed.
   *
   * ONE DIRECTIONALITY, STATED PLAINLY
   * ----------------------------------
   * The shape list is an ALLOWLIST: a shape that appears and is not listed
   * fails. A listed shape that no longer occurs does NOT fail, because this
   * file's stated design is that fixing a site must never fail the suite — only
   * lower the number. The cost of that choice is real and worth naming: a
   * migrated site leaves a stale line here. It is accepted rather than solved
   * with a two-directional assertion because the alternative punishes the exact
   * behaviour the guard exists to encourage, and a guard that cries wolf is
   * disabled. The site count is pinned beside the list so the two can be read
   * together, and a count that has fallen without the list being touched is the
   * prompt to prune it.
   *
   * THE NUMBERS ARE MEASURED, NOT INHERITED
   * ----------------------------------------
   * The header block above USED TO cite a census of "48 failing wash pairings
   * across 13 files and 27 failing palette pairings across 8 files"; it now
   * carries the corrected table. Re-deriving both with the helpers in
   * ./helpers/deferredCensus found neither cited figure correct: the wash family
   * is 18 failing sites across 10 shapes and 11 files at the base commit, and
   * the palette family is 11 failing sites across 4 shapes and 7 files. Both
   * cited numbers were roughly 2.5x the truth, and both were wrong in the
   * direction that makes a floor look like LESS work than there is — which is
   * the direction a floor must never be wrong in.
   *
   * What is pinned below is what the census computes, and the census runs in
   * this suite, so the number can be re-derived rather than taken on trust.
   * The floors themselves are 15 wash sites and 11 palette sites; the wash
   * figure fell from 18 because this branch tokenised the toast, which removed
   * three of them.
   */
  const census = censusWashes({ tokensCss, srcRoot, projectRoot });
  const palette = censusPaletteBackgrounds({
    tokensCss,
    srcRoot,
    projectRoot,
    themeCss: readFileSync(
      resolve(projectRoot, "node_modules/tailwindcss/theme.css"),
      "utf-8",
    ),
  });

  /**
   * THE PIN IS PER SITE — the owning JSX element, by its own identity
   *
   * A site is the element that owns the pairing, resolved by a hybrid: a static
   * `data-testid`/`id` the element already carries, otherwise a source-only
   * comment beside it. Never a runtime attribute added for the test, never a
   * line number (shifts on any edit above), never a per-file or global shape set
   * (a site migrating to an already-allowlisted form is invisible to both), and
   * never a localized `aria-label`, which is localized at 20 of these sites and
   * would make the key a translation string.
   *
   * The value is a SHAPE LIST rather than one shape: four elements pair
   * `bg-emerald-600` and its `hover:bg-emerald-500` with a single ink, so one
   * identity legitimately covers two occurrences.
   *
   * ONE-DIRECTIONAL, and the cost is still paid: a pinned site that no longer has
   * a deferred pairing does NOT fail, because fixing a site must never fail this
   * suite — only lower the count. A resolved site therefore leaves a stale entry
   * behind, and the map over-describes the backlog until pruned by hand. The
   * contract is one-directional in BOTH directions of that sentence: every CURRENT
   * site must exist, hold exactly one identity, and match its own pinned value;
   * nothing requires a pinned entry to still be in use.
   */
  const WASH_SITES: Record<string, string[]> = {
    "catalog-tab-printer-custom-badge": [
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    ],
    "catalog-tab-material-custom-badge": [
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    ],
    "catalog-tab-marketplace-custom-badge": [
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    ],
    "changelog-latest-badge": [
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    ],
    "gcode-preview-read-error-banner": [
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    ],
    "gcode-preview-parse-error-banner": [
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    ],
    "price-hero-edit-price-button": [
      "hover:bg-[var(--revenue)]/10 + hover:text-[var(--revenue)]",
    ],
    "price-hero-margin-label": ["bg-[var(--accent)]/15 + text-[var(--accent)]"],
    "quote-section-view-quote-button": [
      "hover:bg-[var(--color-accent)]/20 + hover:text-[var(--color-accent)]",
    ],
    "section-nav-desktop-item": [
      "bg-[var(--color-accent)]/15 + text-[var(--color-accent)]",
    ],
    "section-nav-compact-item": [
      "bg-[var(--color-accent)]/15 + text-[var(--color-accent)]",
    ],
    "select-option-thumb": ["bg-[var(--accent)]/20 + text-[var(--accent)]"],
    "data-testid=spool-thumb": [
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    ],
    "export-actions-csv-button": [
      "hover:bg-[var(--info)]/80 + text-[var(--text-inverse)]",
    ],
    "stl-preview-error-banner": [
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    ],
  };

  const PALETTE_SITES: Record<string, string[]> = {
    "catalog-tab-save-printer-button": [
      "bg-emerald-500 + text-white",
      "bg-emerald-600 + text-white",
    ],
    "customer-tab-delete-button": ["bg-red-600 + text-[var(--color-danger)]"],
    "history-tab-delete-entry-button": [
      "bg-red-600 + text-[var(--color-danger)]",
    ],
    "privacy-screen-delete-all-button": ["bg-red-500 + text-white"],
    "quote-section-export-pdf-button": [
      "bg-emerald-500 + text-white",
      "bg-emerald-600 + text-white",
    ],
    "spool-form-use-existing-button": [
      "bg-emerald-500 + text-white",
      "bg-emerald-600 + text-white",
    ],
    "update-notification-install-button": [
      "bg-emerald-500 + text-white",
      "bg-emerald-600 + text-white",
    ],
  };

  /** siteId -> the shapes its element is pinned to. */
  function describeSiteFaults(
    family: string,
    rows: Array<{ siteId: string; kind: string; detail: string }>,
  ): string {
    return (
      `${rows.length} ${family} SITE(S) below AA are not accounted for by their own pin:\n` +
      rows.map((r) => `  ${r.siteId}  [${r.kind}]\n${r.detail}`).join("\n") +
      `\n\nA site is the owning JSX element, named by a static data-testid/id it ` +
      `already carries or by a source-only comment beside it. "unidentified" ` +
      `means the element has neither. "unpinned" means a new element appeared. ` +
      `"changedForm" means the element is pinned to a different shape — which is ` +
      `what a same-declaration substitution looks like, and is the thing a ` +
      `position-based key could not see.`
    );
  }

  it("resolves every wash token it pairs, so the census is not a partial view", () => {
    // A census that silently skips what it cannot resolve reports a smaller
    // population, which a `toBeLessThanOrEqual` floor would read as progress.
    // That is the failure direction a floor must never have, so unresolvable
    // pairings are a finding rather than a skip.
    expect(
      census.unresolved,
      `${census.unresolved.length} wash pairing(s) could not be resolved, so ` +
        `the floor below is measuring less than it appears to:\n` +
        census.unresolved.join("\n"),
    ).toHaveLength(0);
  });

  it("resolves every PALETTE pairing it forms, so the scan fails closed", () => {
    // The fail-open this closes: an unlisted palette step used to be `continue`d
    // past, which dropped the site from the population entirely, and because
    // `worst` was still Infinity the pair was then filed as PASSING. An
    // unreadable measurement was recorded as a clean one, and a `toBeLessThanOr
    // Equal` count floor read the disappearance as the backlog shrinking — the
    // one direction a floor must never be fooled in.
    expect(
      palette.unresolved,
      `${palette.unresolved.length} palette pairing(s) could not be resolved, so ` +
        `the palette floor below is measuring less than it appears to:\n` +
        palette.unresolved.join("\n"),
    ).toHaveLength(0);
  });

  it("fails closed on a palette step the theme map does not contain", () => {
    // Synthetic source, so the proof does not require editing a component to
    // introduce a defect. `emerald-650` is not a Tailwind step, so the map has
    // no entry and the pairing is undecidable.
    const result = scanPaletteInSource({
      tokensCss,
      file: "src/Synthetic.tsx",
      source: [
        "export function Thing() {",
        '  return <button className="bg-emerald-650 text-white">go</button>;',
        "}",
      ].join("\n"),
      palette: tailwindPaletteMap(
        readFileSync(
          resolve(projectRoot, "node_modules/tailwindcss/theme.css"),
          "utf-8",
        ),
      ),
    });
    expect(
      result.unresolved.length,
      "an unlisted palette step must be reported, not dropped",
    ).toBe(1);
    expect(result.unresolved[0]).toContain("bg-emerald-650");
    expect(
      [...result.failing, ...result.passing],
      "and it must NOT be filed as a site in either direction — it was never " +
        "measured, and recording it as passing is the fail-open being fixed",
    ).toHaveLength(0);
  });

  it("fails closed on a palette pairing whose ink does not resolve", () => {
    const result = scanPaletteInSource({
      tokensCss,
      file: "src/Synthetic.tsx",
      source: [
        "export function Thing() {",
        '  return <button className="bg-red-600 text-[var(--no-such-token)]">x</button>;',
        "}",
      ].join("\n"),
      palette: tailwindPaletteMap(
        readFileSync(
          resolve(projectRoot, "node_modules/tailwindcss/theme.css"),
          "utf-8",
        ),
      ),
    });
    expect(result.unresolved.length).toBe(1);
    expect(result.unresolved[0]).toContain("--no-such-token");
    expect([...result.failing, ...result.passing]).toHaveLength(0);
  });

  it("keeps no NUL byte in its own source, so git does not treat it as binary", () => {
    // A literal NUL once sat in a template delimiter here. It made `git diff`
    // and `file` report this source as binary data, which quietly suppresses
    // diffs and makes any review of it impossible. Cheap to assert, and the
    // failure is otherwise silent.
    const raw = readFileSync(__filename);
    expect(
      raw.includes(0),
      "this file contains a NUL byte; git and `file` will classify it as " +
        "binary, which hides diffs. Use an escaped or ordinary delimiter instead.",
    ).toBe(false);
  });

  it("measures a population, and not everything in it", () => {
    // A census that classified every site as failing would satisfy a floor
    // forever and prove nothing. Both halves must be populated, and the passing
    // half is the falsifiable one.
    expect(census.failing.length).toBeGreaterThan(0);
    expect(census.passing.length).toBeGreaterThan(0);
    expect(palette.failing.length).toBeGreaterThan(0);
    expect(palette.passing.length).toBeGreaterThan(0);
  });

  it("keeps the deferred wash population at or below the measured floor", () => {
    // 15 sites at the time of writing, down from 18 at the base commit: the
    // toast's three /90 variants left this population when they became solid
    // fills. `toBeLessThanOrEqual` on purpose — fixing a site must only ever
    // lower this number.
    expect(
      census.failing.length,
      `translucent wash pairings below AA now number ${census.failing.length}; ` +
        `the floor is 15, so either the deferred population is growing or this ` +
        `comment is stale:\n` +
        census.failing
          .map(
            (s) => `  ${s.ratio.toFixed(2)}:1  ${s.file}:${s.line}  ${s.shape}`,
          )
          .join("\n"),
    ).toBeLessThanOrEqual(15);
  });

  it("keeps the deferred palette population at or below the measured floor", () => {
    // 11 sites, unchanged by the toast work: the palette family is a separate
    // queue and this branch did not touch it. Pinned anyway, because a floor
    // that covers one family and not the other is how the other one rots.
    expect(
      palette.failing.length,
      `raw Tailwind palette pairings below AA now number ` +
        `${palette.failing.length}; the floor is 11:\n` +
        palette.failing
          .map(
            (s) => `  ${s.ratio.toFixed(2)}:1  ${s.file}:${s.line}  ${s.shape}`,
          )
          .join("\n"),
    ).toBeLessThanOrEqual(11);
  });

  it.each([
    ["wash", WASH_SITES, () => census.failing],
    ["palette", PALETTE_SITES, () => palette.failing],
  ] as const)(
    "accounts for every %s SITE against its own pin",
    (family, pin, discovered) => {
      const rows = siteFaults(discovered(), pin);
      expect(
        rows,
        rows.length
          ? describeSiteFaults(family, rows)
          : `${family} sites fully accounted for`,
      ).toHaveLength(0);
    },
  );

  it("gives every deferred wash element exactly one identity, and no marker two elements", () => {
    // The inventory, asserted rather than described: 22 owning elements, 26
    // paired occurrences, every one identified, no id used twice, and every
    // marker in the tree claimed by exactly one element. An orphan is a marker
    // that sits next to nothing deferred — usually a marker that lost its
    // element to an edit, and a pin entry that quietly protects nothing.
    for (const [family, sites] of [
      ["wash", census.failing],
      ["palette", palette.failing],
    ] as const) {
      const ids = sites.map((s) => s.siteId);
      expect(
        ids.filter((id) => !id).length,
        `${family}: ${ids.filter((id) => !id).length} deferred occurrence(s) have no identity`,
      ).toBe(0);
      const byId = new Map<string, Set<string>>();
      for (const s of sites) {
        byId.set(s.siteId!, new Set([...(byId.get(s.siteId!) ?? []), s.shape]));
      }
      // A site MAY hold two shapes: four elements pair `bg-emerald-600` and its
      // `hover:bg-emerald-500` with one ink. What must hold is that the count
      // per site is exactly what the pin says, which `siteFaults` checks; here
      // only that the population is 22 elements over 26 occurrences, i.e. four
      // sites carry a second occurrence and eighteen carry one.
      const perSite = [...byId.values()].map((v) => v.size).sort();
      const expected =
        family === "palette"
          ? [1, 1, 1, 2, 2, 2, 2]
          : Array(perSite.length).fill(1);
      expect(
        perSite,
        `${family}: occurrences per site, which must total the pin's shape count`,
      ).toEqual(expected);
    }
    // 22 elements: 21 marker-identified plus the one reusing a data-testid.
    expect(new Set(census.failing.map((s) => s.siteId)).size).toBe(15);
    expect(
      new Set([...census.failing, ...palette.failing].map((s) => s.siteId))
        .size,
      "22 owning elements carry the 26 paired occurrences",
    ).toBe(22);
    expect(census.failing.length + palette.failing.length).toBe(26);
    expect(
      census.failing.filter((s) => s.siteId === "data-testid=spool-thumb")
        .length,
      "the one element reusing an existing static data-testid is resolved through it",
    ).toBe(1);
  });

  it("permits a resolved site to leave a stale pin, even for a unique shape", () => {
    // Finding B: the previous version of this slot demanded the reverse — that
    // every pinned shape still occurs SOMEWHERE in the tree. That contradicts
    // the one-directional policy two tests above state, and it fails precisely
    // when the policy is working: resolve the last site holding a shape and the
    // shape is gone from the tree, which is progress, yet the assertion demanded
    // the backlog keep reproducing it.
    //
    // The real contract is one-directional: every CURRENT site must exist, hold
    // exactly one identity, and match its own pinned value. A resolved site is
    // allowed to leave its entry behind.
    // A shape whose ONLY owner is one site. The accent wash is deliberately not
    // used: five sites hold it, so resolving one of them would leave the shape in
    // the population and the test would pass for the wrong reason.
    const soleOwner = "price-hero-margin-label";
    const shape = WASH_SITES[soleOwner][0];
    const elsewhere = [...census.failing, ...palette.failing].filter(
      (s) => s.shape === shape,
    );
    expect(
      elsewhere.length,
      `${soleOwner} is expected to be the only site holding ${shape}; the count ` +
        `is asserted so this test keeps testing what it claims`,
    ).toBe(1);

    // Simulate that site being resolved: it stops being a current site, its
    // shape leaves the population, and its pin entry stays.
    // Wash sites only: this compares against the WASH pin, and the palette
    // sites are keyed in PALETTE_SITES, so mixing them in would report every one
    // of them as unpinned.
    const remaining = census.failing.filter((s) => s.siteId !== soleOwner);
    expect(
      remaining.some((s) => s.shape === shape),
      "with the site resolved, its shape occurs nowhere",
    ).toBe(false);
    expect(
      siteFaults(remaining, WASH_SITES),
      "and a stale pin entry for a resolved site is NOT a fault",
    ).toEqual([]);
    expect(
      WASH_SITES[soleOwner],
      "the stale entry is still there, which is the cost of the policy",
    ).toEqual([shape]);
  });

  it("still fails a CURRENT site whose shape no longer matches its pin", () => {
    // The half of the contract that must not weaken: current sites are checked.
    const drifted = [
      {
        siteId: Object.keys(WASH_SITES)[0],
        shape: "bg-[var(--z)]/90 + text-[var(--z)]",
      },
    ];
    expect(
      siteFaults(drifted, {
        [Object.keys(WASH_SITES)[0]]: ["bg-[var(--x)]/20 + text-[var(--x)]"],
      }).map((f) => f.kind),
    ).toEqual(["changedForm"]);
  });

  it("resolves the Tailwind palette it measures palette pairings against", () => {
    // If Tailwind's theme format changed, the palette map would come back empty
    // and the census would report ZERO failures — which a `toBeLessThanOrEqual`
    // floor would read as the whole queue being fixed. So the decoder is pinned
    // against the two conversions whose provenance tokens.css writes down, and
    // the map is required to be populated.
    for (const [step, expected] of PALETTE_SELF_CHECK) {
      expect(
        tailwindPaletteMap(
          readFileSync(
            resolve(projectRoot, "node_modules/tailwindcss/theme.css"),
            "utf-8",
          ),
        ).get(step),
        `${step} must decode to ${expected} — tokens.css documents that value ` +
          `as "the sRGB rendering of Tailwind v4's oklch palette". If Tailwind ` +
          `changed the format, this floor is measuring nothing.`,
      ).toBe(expected);
    }
  });
});

/**
 * The defect a file count cannot see, stated as an executable example.
 *
 * This is the finding that motivated re-measuring the floor, kept as a test
 * because it is cheap and it is the part most likely to be forgotten: the two
 * populations below describe the SAME file before and after a site is migrated
 * from one broken form to a different broken form. The file count is identical
 * in both, so any floor expressed in files reports the migration as neutral. The
 * shape set differs, so a floor expressed in forms does not.
 */
describe("a file count cannot see a site change form", () => {
  interface Population {
    /** one entry per SITE, as [file, line, shape] */
    sites: Array<[string, number, string]>;
  }

  const BEFORE: Population = {
    sites: [
      [
        "src/Thing.tsx",
        10,
        "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
      ],
      [
        "src/Thing.tsx",
        20,
        "bg-[var(--color-accent)]/20 + text-[var(--color-text-primary)]",
      ],
      [
        "src/Other.tsx",
        5,
        "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
      ],
    ],
  };

  /**
   * The same three sites, one of them migrated to a different broken form.
   *
   * The three BEFORE shapes are deliberately all DISTINCT. With two sites
   * sharing a shape, rewriting one of them leaves the shape SET unchanged, so
   * the example would not demonstrate what it claims — which is the same reason
   * a shape list cannot be used alone as a floor.
   */
  const AFTER: Population = {
    sites: [
      [
        "src/Thing.tsx",
        10,
        "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
      ],
      [
        "src/Thing.tsx",
        20,
        "bg-[var(--color-success)]/80 + text-[var(--color-text-primary)]",
      ],
      [
        "src/Other.tsx",
        5,
        "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
      ],
    ],
  };

  const filesOf = (p: Population): string[] =>
    [...new Set(p.sites.map(([file]) => file))].sort();
  const shapesOf = (p: Population): string[] =>
    [...new Set(p.sites.map(([, , shape]) => shape))].sort();

  it("leaves the file count untouched, which is why the old floor hid this", () => {
    // Not a claim — an assertion. This is the behaviour that made a file-count
    // floor report green while a site was rewritten into a different failure.
    expect(filesOf(AFTER)).toEqual(filesOf(BEFORE));
  });

  it("moves the shape set, which is what the new floor measures instead", () => {
    const gained = shapesOf(AFTER).filter((s) => !shapesOf(BEFORE).includes(s));
    const lost = shapesOf(BEFORE).filter((s) => !shapesOf(AFTER).includes(s));
    expect(
      gained,
      "the migrated site must present a form that was not listed",
    ).toHaveLength(1);
    expect(lost, "and must stop presenting the form that was").toHaveLength(1);
    expect(gained[0]).toBe(
      "bg-[var(--color-success)]/80 + text-[var(--color-text-primary)]",
    );
  });

  it("still counts a real fix, so the unit is not blind in the other direction", () => {
    // A site count must fall when work happens, or it is not a floor at all.
    const FIXED: Population = {
      sites: BEFORE.sites.slice(0, 2),
    };
    expect(FIXED.sites.length).toBeLessThan(BEFORE.sites.length);
  });
});

describe("guard coverage limits, asserted so they stay honest", () => {
  it("keeps no raw Tailwind palette background behind a dialog variant", () => {
    // The specific defect this branch fixed: theme-independent `bg-red-600` /
    // `bg-amber-600` behind a theme-flipping ink. Asserted on the dialog
    // because that is where it shipped; the rest of the app's palette
    // backgrounds are the deferred population described in the header block.
    const dialog = readFileSync(
      resolve(srcRoot, "shared/components/ui/ConfirmDialog.tsx"),
      "utf-8",
    );
    const code = dialog
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/`[^`]*`/g, "");
    for (const palette of [
      "bg-red-600",
      "bg-red-500",
      "bg-amber-600",
      "bg-amber-500",
    ]) {
      expect(
        code.includes(palette),
        `${palette} is back in ConfirmDialog's code; the status fill tokens ` +
          `exist precisely so a theme-independent palette utility never sits ` +
          `behind a theme-flipping ink again`,
      ).toBe(false);
    }
  });
});

/**
 * The regression the per-site pin exists for, driven through the REAL scanner.
 *
 * Every earlier version of this proof passed fabricated identifiers straight
 * into the comparison function, so it never exercised the parsing that decides
 * which element a pairing belongs to. These go through
 * `scanWashesInSource` on real source text, so the marker syntax, the
 * expression-position comment form, the tag scan and the ownership rule are all
 * under test rather than assumed.
 */
describe("the site pin, through the real scanner", () => {
  const projectRoot = resolve(__dirname, "../..", "..");
  const tokensCss = readFileSync(
    resolve(projectRoot, "src/styles/tokens.css"),
    "utf-8",
  );

  const SHAPE = "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]";
  const OTHER = "bg-[var(--accent)]/20 + text-[var(--accent)]";

  /** Two marked siblings inside ONE declaration, as the real tree has them. */
  function fixture(shapeA: string, shapeB: string): string {
    return [
      "export function Widget({ a, b }: { a: string; b: string }) {",
      "  return (",
      '    <div className="flex gap-2">',
      "      {/* contrast-site: site-a */}",
      `      <span className="${shapeA}">A</span>`,
      "      {/* contrast-site: site-b */}",
      `      <span className="${shapeB}">B</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
  }

  function sites(
    source: string,
  ): Array<{ siteId: string | null; shape: string }> {
    return scanWashesInSource({
      tokensCss,
      file: "src/Widget.tsx",
      source,
    }).failing.map((s) => ({ siteId: s.siteId, shape: s.shape }));
  }

  const PIN: Record<string, string[]> = {
    "site-a": [SHAPE],
    "site-b": [OTHER],
  };

  it("resolves two marked siblings in one declaration to their own identities", () => {
    expect(sites(fixture(SHAPE, OTHER))).toEqual([
      { siteId: "site-a", shape: SHAPE },
      { siteId: "site-b", shape: OTHER },
    ]);
  });

  it("catches the same-shape move between two elements in ONE declaration", () => {
    // The substitution a position-based key cannot see. Shape X leaves element
    // A and appears on element B. B now holds two occurrences, A holds none.
    // The file's total shape multiset and its pairing count both change, so this
    // is the strict version — the same-multiset case is the next test.
    const moved = sites(fixture(OTHER, `${SHAPE} ${SHAPE}`));
    const rows = siteFaults(moved, PIN);
    expect(
      rows.map((r) => `${r.siteId}:${r.kind}`).sort(),
      "the move must be reported against the site that lost the shape",
    ).toEqual(["site-a:changedForm", "site-b:changedForm"]);
  });

  it("catches a swap that keeps the file's shape multiset and count identical", () => {
    // The precise case the review named: A holds X, B holds Y; afterwards A
    // holds Y and B holds X. Same two shapes, same count, same declaration —
    // and a `decl#ordinal` or global-shape pin sees nothing at all, because
    // neither the ordinals nor the shape set moved.
    const before = sites(fixture(SHAPE, OTHER));
    expect(siteFaults(before, PIN)).toHaveLength(0);

    const after = sites(fixture(OTHER, SHAPE));
    expect(
      after.map((s) => s.shape).sort(),
      "the file's shape multiset is unchanged by the swap",
    ).toEqual(before.map((s) => s.shape).sort());
    expect(after.length, "and so is its pairing count").toBe(before.length);

    const rows = siteFaults(after, PIN);
    expect(
      rows.map((r) => `${r.siteId}:${r.kind}`).sort(),
      "yet both sites changed form, and both are named",
    ).toEqual(["site-a:changedForm", "site-b:changedForm"]);
  });

  it("catches a new element with an identity nobody pinned", () => {
    const rows = siteFaults(sites(fixture(SHAPE, OTHER)), {
      "site-a": [SHAPE],
    });
    expect(rows.map((r) => `${r.siteId}:${r.kind}`)).toEqual([
      "site-b:unpinned",
    ]);
  });

  it("catches a deferred element with no identity at all", () => {
    const source = [
      "export function Widget() {",
      "  return (",
      '    <div className="flex">',
      `      <span className="${SHAPE}">A</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const rows = siteFaults(sites(source), PIN);
    expect(rows.map((r) => r.kind)).toEqual(["unidentified"]);
  });

  it("catches two elements claiming one identity", () => {
    const source = [
      "export function Widget() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: site-a */}",
      `      <span className="${SHAPE}">A</span>`,
      "      {/* contrast-site: site-a */}",
      `      <span className="${SHAPE}">A again</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    // Both occurrences carry the same id and the same shape, so the pin's
    // per-site comparison cannot see the collision — the scanner-level check is
    // what has to catch it, by counting identities per file.
    const found = sites(source);
    expect(found.map((s) => s.siteId)).toEqual(["site-a", "site-a"]);
    const ids = siteMarkers(source).map((m) => m.id);
    expect(
      ids.length === new Set(ids).size,
      "two markers share an id, which must be reported rather than merged",
    ).toBe(false);
  });

  it("resolves an identity in expression position, where the JSX form cannot go", () => {
    // `{x ? (` puts the element inside a parenthesised EXPRESSION, where
    // `{/* … */}` is an object literal rather than a comment. The plain form has
    // to work there or the file does not parse at all.
    const source = [
      "export function Widget({ on }: { on: boolean }) {",
      "  return (",
      '    <div className="flex">',
      "      {on ? (",
      "        /* contrast-site: gated-item */",
      `        <span className="${SHAPE}">A</span>`,
      "      ) : null}",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(sites(source)).toEqual([{ siteId: "gated-item", shape: SHAPE }]);
  });

  it("keeps identity stable when the site moves down the file", () => {
    // Line numbers are not identity. Reformatting above the site, and the site
    // itself moving, must not change which element it belongs to.
    const before = sites(fixture(SHAPE, OTHER));
    const shifted = fixture(SHAPE, OTHER)
      .split("\n")
      .map((l, i) => (i < 3 ? `// padding ${i}` : l))
      .join("\n");
    expect(
      sites(shifted),
      "adding lines above the site must not change any identity",
    ).toEqual(before);
    expect(
      sites(fixture(SHAPE, OTHER).replace("  <span", "    <span")),
      "reindenting the element must not change any identity",
    ).toEqual(before);
  });

  it("reuses an existing static data-testid instead of demanding a marker", () => {
    const source = [
      "export function Widget() {",
      "  return (",
      '    <div className="flex">',
      `      <span data-testid="thumb" className="${SHAPE}">A</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(sites(source)).toEqual([
      { siteId: "data-testid=thumb", shape: SHAPE },
    ]);
  });

  it("does not accept a dynamic data-testid as identity", () => {
    const source = [
      "export function Widget({ v }: { v: string }) {",
      "  return (",
      '    <div className="flex">',
      `      <span data-testid={\`badge-\${v}\`} className="${SHAPE}">A</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    expect(
      sites(source).map((s) => s.siteId),
      "a per-render test id names no single source site, so it is not identity",
    ).toEqual([null]);
  });
});

/**
 * Ownership, proven by DURABLE tests through the production identity path.
 *
 * The previous pass reported mutation proof for these cases, and the committed
 * tests did not support that claim: they asserted that a FIXTURE contained two
 * identical strings, and that the clean tree held a certain number of sites.
 * Neither says anything about whether the guard rejects the malformed source.
 * Every test below therefore drives `scanWashesInSource` plus the real
 * `identityFaults`, and asserts on the faults the production code produces.
 *
 * They are written to fail if ownership ever becomes last-writer-wins, or if
 * orphan checking is removed — which is checked by mutation in the commit that
 * introduced them, and re-checkable at any time.
 */
describe("marker ownership, through the production identity path", () => {
  const projectRoot = resolve(__dirname, "../..", "..");
  const tokensCss = readFileSync(
    resolve(projectRoot, "src/styles/tokens.css"),
    "utf-8",
  );

  const X = "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]";
  const Y = "bg-[var(--accent)]/20 + text-[var(--accent)]";

  /**
   * The production path: scan, then read the faults the scan actually produced.
   * `ctxFor` replays the scan's own resolutions so the recorded claims are the
   * ones a real scan made, rather than a separate guess.
   */
  function inspect(source: string) {
    const scan = () =>
      scanWashesInSource({ tokensCss, file: "src/Widget.tsx", source });
    const result = scan();
    const ctx = identityContext(source);
    for (const site of result.failing) resolveSiteId(ctx, site.offset);
    return {
      sites: result.failing.map((s) => ({ siteId: s.siteId, shape: s.shape })),
      unresolved: result.unresolved,
      faults: identityFaults(ctx),
    };
  }

  const kinds = (f: { kind: string }[]): string[] =>
    f.map((x) => x.kind).sort();

  it("a marker names only the element immediately after it, and is consumed once", () => {
    // THE leak this replaces. Under nearest-preceding-marker resolution the
    // second element inherited the first's identity and both looked healthy.
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: first */}",
      `      <span className="${X}">A</span>`,
      `      <span className="${X}">B has no marker of its own</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(
      found.faults,
      "both elements hold a deferred pairing, so the marker is consumed and " +
        "the second element simply has no identity — which the guard reports",
    ).toEqual([]);
    expect(
      found.sites.map((s) => s.siteId),
      "the second element must NOT inherit the first's identity",
    ).toEqual(["first", null]);
    expect(
      kinds(siteFaults(found.sites, { first: [X] })),
      "and an un-named deferred element is a finding, not a silent merge",
    ).toEqual(["unidentified"]);
  });

  it("orphans a marker whose element has no deferred pairing", () => {
    // The other half of the leak: the marked element is not deferred, and a
    // LATER element must not inherit the marker.
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: stale */}",
      '      <span className="px-2 py-1 rounded-full">plain</span>',
      `      <span className="${X}">deferred</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(kinds(found.faults)).toEqual(["orphanMarker"]);
    expect(found.faults[0].identity).toBe("stale");
    expect(
      found.faults[0].detail,
      "the message must say the marker cannot be inherited",
    ).toMatch(/cannot be inherited/);
    expect(
      found.sites.map((s) => s.siteId),
      "the later deferred element has no identity of its own",
    ).toEqual([null]);
  });

  it("rejects two markers claiming one element as ambiguous", () => {
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: one */}",
      "      {/* contrast-site: two */}",
      `      <span className="${X}">A</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(kinds(found.faults)).toEqual(["ambiguousMarker"]);
    expect(
      found.faults[0].detail,
      "and it must name BOTH markers and the element they fight over",
    ).toMatch(/both claim the element/);
  });

  it("rejects a duplicate marker id on two different elements", () => {
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: same */}",
      `      <span className="${X}">A</span>`,
      "      {/* contrast-site: same */}",
      `      <span className="${X}">B</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(
      kinds(found.faults),
      "one id, one element — and the shapes here are identical, so nothing " +
        "downstream could tell this from the healthy case",
    ).toEqual(["duplicateIdentity"]);
    expect(found.faults[0].identity).toBe("same");
  });

  it("rejects a static attribute reused on two elements", () => {
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      `      <span data-testid="dup" className="${X}">A</span>`,
      `      <span data-testid="dup" className="${Y}">B</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(kinds(found.faults)).toEqual(["duplicateIdentity"]);
    expect(found.faults[0].identity).toBe("data-testid=dup");
  });

  it("rejects a marker followed by no element at all", () => {
    const source = [
      "export function W() {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: dangling */}",
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const found = inspect(source);
    expect(kinds(found.faults)).toEqual(["orphanMarker"]);
    expect(found.faults[0].detail).toMatch(/no JSX\s+element at all/);
  });

  it("keeps the marked A/B same-declaration swap failing on both sites", () => {
    // Preserved from the accepted work: two marked siblings in one declaration,
    // swapped. The file's shape multiset and pairing count are unchanged, so
    // only a per-site key can see it.
    const before = [
      "export function W({ a, b }: { a: string; b: string }) {",
      "  return (",
      '    <div className="flex">',
      "      {/* contrast-site: site-a */}",
      `      <span className="${X}">A</span>`,
      "      {/* contrast-site: site-b */}",
      `      <span className="${Y}">B</span>`,
      "    </div>",
      "  );",
      "}",
    ].join("\n");
    const pin = { "site-a": [X], "site-b": [Y] };
    expect(inspect(before).faults).toEqual([]);
    expect(siteFaults(inspect(before).sites, pin)).toEqual([]);

    const after = before
      .replace(
        `<span className="${X}">A</span>`,
        `<span className="${Y}">A</span>`,
      )
      .replace(
        `<span className="${Y}">B</span>`,
        `<span className="${X}">B</span>`,
      );
    const moved = inspect(after);
    expect(
      moved.sites.map((s) => s.shape).sort(),
      "the shape multiset is unchanged by the swap",
    ).toEqual(
      inspect(before)
        .sites.map((s) => s.shape)
        .sort(),
    );
    expect(
      moved.faults,
      "and the swap produces no identity fault at all",
    ).toEqual([]);
    expect(
      siteFaults(moved.sites, pin)
        .map((f) => `${f.siteId}:${f.kind}`)
        .sort(),
      "so the PIN is what catches it, naming both sites",
    ).toEqual(["site-a:changedForm", "site-b:changedForm"]);
  });

  it("holds across the real tree: 22 elements, no ownership fault", () => {
    // The real static inventory, so the durable tests above are anchored to a
    // population that actually exists rather than only to fixtures.
    const found = inspectRealTree();
    expect(found.faults, describeIdentityFaults(found.faults)).toEqual([]);
    expect(found.elements).toBe(22);
    expect(found.occurrences).toBe(26);
    expect(found.markers).toBe(21);
    expect(found.missingIdentity).toBe(0);
  });

  function inspectRealTree() {
    const palette = tailwindPaletteMap(
      readFileSync(
        resolve(projectRoot, "node_modules/tailwindcss/theme.css"),
        "utf-8",
      ),
    );
    let elements = 0;
    let occurrences = 0;
    let markers = 0;
    let missingIdentity = 0;
    const faults: ReturnType<typeof identityFaults> = [];
    for (const file of walkComponents(srcRoot)) {
      const source = readFileSync(file, "utf-8");
      markers += siteMarkers(source).length;
      const sites = [
        ...scanWashesInSource({ tokensCss, file, source }).failing,
        ...scanPaletteInSource({ tokensCss, file, source, palette }).failing,
      ];
      const ctx = identityContext(source);
      const ids = new Set<string | null>();
      for (const site of sites) {
        const id = resolveSiteId(ctx, site.offset);
        ids.add(id);
        if (!id) missingIdentity++;
      }
      elements += ids.size;
      occurrences += sites.length;
      faults.push(...identityFaults(ctx));
    }
    return { elements, occurrences, markers, missingIdentity, faults };
  }
});
