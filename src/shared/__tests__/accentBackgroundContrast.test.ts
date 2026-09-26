import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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
  censusPaletteBackgrounds,
  censusWashes,
  scanPaletteInSource,
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
   * THE PIN IS PER SITE, NOT PER FORM
   * ---------------------------------
   * The previous version of this was a GLOBAL set of allowed shapes. That was
   * a weaker instrument than it looked, and the review was right to call it: a
   * site could migrate from one already-allowlisted form to a DIFFERENT
   * already-allowlisted form without changing the count or the set, and pass
   * silently. The allowlist said "this form is known broken" when what needed
   * saying was "this form is broken *here*".
   *
   * So the pin maps FILE -> the multiset of shapes that file is allowed to
   * hold, and a discovered site is only accounted for if its own file has that
   * shape still available. Multiset, not set: CatalogTab holds three identical
   * `bg-[var(--color-accent)]/20 + text-[var(--color-accent)]` sites and that is
   * three pieces of information, not one.
   *
   * HOW SITE IDENTITY STAYS STABLE — the question a line-number pin cannot
   * answer
   * ------------------------------------------------------------------------
   * A site's identity here is the PAIR (file, shape), and the stability is
   * structural rather than maintained: a site is *defined* by where it is and
   * what form it takes, so altering either component necessarily produces a
   * different key, and the check is on keys. There is no separate identifier to
   * fall out of date — no line number, which any edit above it would shift, and
   * no counter, which any insertion above it would renumber.
   *
   * The encoding cannot drift silently, which is the property that matters:
   *
   *   - a site changes form      -> (file, newShape) is a new key. Even if
   *                                 newShape is allowlisted for ANOTHER file,
   *                                 this file's multiset has no copy left, so
   *                                 it is an excess. Caught.
   *   - a site appears           -> a new key in some file. Caught.
   *   - a site is resolved       -> its key simply stops being discovered.
   *                                 Not caught, deliberately (below).
   *   - a file is renamed        -> both the pin and the census move together,
   *                                 so the key still matches; the pin is
   *                                 updated in the same commit as the rename.
   *
   * ONE-DIRECTIONALITY, AND WHAT IT COSTS
   * -------------------------------------
   * Still an allowlist, for the same reason as before: fixing a site must never
   * fail this suite, only lower the number. So a pinned entry that is no longer
   * discovered does NOT fail — which means a resolved site leaves a stale entry
   * here. The cost is unchanged and still named in the file header: the list
   * over-describes the backlog after a wave of fixes, and must be pruned by
   * hand. The alternative punishes exactly the behaviour the guard exists to
   * encourage.
   */
  /**
   * THE PIN IS PER OCCURRENCE
   * -------------------------
   * Two earlier versions of this pin were both too weak, and each was caught by
   * the review rather than by me.
   *
   * v1 counted FILES. A site that changed form left every file count untouched.
   * v2 held a GLOBAL set of allowed shapes, then a per-FILE multiset of them.
   * Both still shared one blind spot: a shape is not an occurrence. Resolve the
   * occurrence at `CatalogTab.tsx:PrinterManager#1` and add the same shape at
   * `CatalogTab.tsx:MaterialManager#1`, and a per-file multiset is unchanged —
   * three identical shapes before, three after. The population is just as
   * broken and the floor says nothing.
   *
   * So the pin is keyed on OCCURRENCE, and the shape is the pinned VALUE:
   *
   *   key   `file#declaration#ordinal`   — which site
   *   value the class-string pair that site is allowed to hold — what it is
   *
   * IDENTITY STABILITY, STATED HONESTLY
   * -----------------------------------
   * The key is the enclosing column-zero declaration plus a 1-based ordinal
   * within it, both in source order. Why those two and not something cleverer:
   *
   *   SURVIVES   line shifts and edits above the site; reformatting; added or
   *              removed literals that are not wash pairings, since they do not
   *              consume an ordinal; a file being renamed (pin and census move
   *              together, in the same commit).
   *   CHANGES ON a wash pairing being added, removed, reordered within its
   *              declaration, or taking a different form.
   *
   * A line number was rejected because any edit above shifts it, which is the
   * most common edit there is. The literal's own text was rejected because two
   * occurrences of one shape are then indistinguishable — that is precisely the
   * gap being closed. A stable annotation in the source would be the strongest
   * key and it was NOT used: it would mean editing thirteen components to add
   * bookkeeping they do not otherwise need, and the guarantee it buys over
   * `declaration#ordinal` is small next to that cost.
   *
   * THE COST, WHICH IS REAL: inserting a wash pairing near the top of a
   * declaration renumbers the ones after it, and they are reported as changed.
   * That is accepted deliberately. A silent re-baseline of a file's
   * known-broken sites is worse than one loud failure, and the message names
   * the declaration and ordinal so the repair is mechanical.
   *
   * ONE-DIRECTIONALITY, UNCHANGED AND STILL PAID FOR
   * ----------------------------------------------
   * A pinned occurrence that no longer exists does NOT fail, because fixing a
   * site must never fail this suite — only lower the count. The cost is
   * unchanged: a resolved site leaves a stale entry here, and the map
   * over-describes the backlog until pruned by hand. What is new is that a
   * still-existing occurrence must match its OWN pinned shape, which is a
   * stronger requirement than the file aggregate it replaces.
   */
  const WASH_OCCURRENCES: Record<string, string> = {
    "src/shared/components/GcodePreview/GcodePreviewPanel.tsx#GcodePreviewPanel#1":
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    "src/shared/components/GcodePreview/GcodePreviewPanel.tsx#GcodePreviewPanel#2":
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    "src/shared/components/StlPreview/StlPreview.tsx#StlPreview#1":
      "bg-[var(--color-danger)]/90 + text-[var(--color-text-primary)]",
    "src/shared/components/Calculator/QuoteSection.tsx#QuoteSection#2":
      "hover:bg-[var(--color-accent)]/20 + hover:text-[var(--color-accent)]",
    "src/shared/components/Catalog/CatalogTab.tsx#PrinterManager#1":
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    "src/shared/components/Catalog/CatalogTab.tsx#MaterialManager#1":
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    "src/shared/components/Catalog/CatalogTab.tsx#MarketplaceManager#1":
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    "src/shared/components/Changelog/ChangelogPage.tsx#ChangelogPage#1":
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    "src/shared/components/SpoolShelf/SpoolThumb.tsx#SpoolThumb#1":
      "bg-[var(--color-accent)]/20 + text-[var(--color-accent)]",
    "src/shared/components/ui/Select/Select.tsx#OptionThumb#1":
      "bg-[var(--accent)]/20 + text-[var(--accent)]",
    "src/shared/components/Results/PriceHeroCard.tsx#PriceHeroCard#1":
      "hover:bg-[var(--revenue)]/10 + hover:text-[var(--revenue)]",
    "src/shared/components/Results/ExportActionsCard.tsx#ExportActionsCard#4":
      "hover:bg-[var(--info)]/80 + text-[var(--text-inverse)]",
    "src/shared/components/Calculator/SectionNav.tsx#SectionNav#1":
      "bg-[var(--color-accent)]/15 + text-[var(--color-accent)]",
    "src/shared/components/Calculator/SectionNav.tsx#SectionNav#2":
      "bg-[var(--color-accent)]/15 + text-[var(--color-accent)]",
    "src/shared/components/Results/PriceHeroCard.tsx#PriceHeroCard#4":
      "bg-[var(--accent)]/15 + text-[var(--accent)]",
  };

  const PALETTE_OCCURRENCES: Record<string, string> = {
    "src/shared/components/Calculator/HistoryTab/HistoryTab.tsx#HistoryTab#1":
      "bg-red-600 + text-[var(--color-danger)]",
    "src/shared/components/Catalog/CustomerTab.tsx#CustomerTab#1":
      "bg-red-600 + text-[var(--color-danger)]",
    "src/platform/desktop/components/UpdateNotification/UpdateNotification.tsx#DownloadedBanner#2":
      "bg-emerald-500 + text-white",
    "src/shared/components/Calculator/QuoteSection.tsx#QuoteViewModal#2":
      "bg-emerald-500 + text-white",
    "src/shared/components/Catalog/CatalogTab.tsx#PrinterManager#2":
      "bg-emerald-500 + text-white",
    "src/shared/components/SpoolShelf/SpoolForm.tsx#SpoolForm#2":
      "bg-emerald-500 + text-white",
    "src/platform/desktop/components/UpdateNotification/UpdateNotification.tsx#DownloadedBanner#1":
      "bg-emerald-600 + text-white",
    "src/shared/components/Calculator/QuoteSection.tsx#QuoteViewModal#1":
      "bg-emerald-600 + text-white",
    "src/shared/components/Catalog/CatalogTab.tsx#PrinterManager#1":
      "bg-emerald-600 + text-white",
    "src/shared/components/SpoolShelf/SpoolForm.tsx#SpoolForm#1":
      "bg-emerald-600 + text-white",
    "src/shared/components/Privacy/PrivacyScreen.tsx#PrivacyScreen#1":
      "bg-red-500 + text-white",
  };

  /** `"<file>#<decl>#<ordinal>"` — the key a pin is written against. */
  const occurrenceKey = (site: { file: string; id: string }): string =>
    `${site.file}#${site.id}`;

  /**
   * Discovered occurrences that their own pin entry does not account for.
   *
   * Two distinct findings, and the message distinguishes them because the
   * remedies differ:
   *   `unpinned`     — the occurrence is not in the map at all. A new site, or
   *                    one that moved to a different declaration/ordinal.
   *   `changedForm`  — the occurrence IS pinned, but to a different shape. This
   *                    is a site that changed form, which is the defect the pin
   *                    exists to catch.
   */
  function occurrenceFaults(
    discovered: ReadonlyArray<{
      file: string;
      id: string;
      shape: string;
      line: number;
    }>,
    pin: Record<string, string>,
  ): Array<{ key: string; shape: string; pinned: string | null }> {
    const faults: Array<{
      key: string;
      shape: string;
      pinned: string | null;
    }> = [];
    for (const site of discovered) {
      const key = occurrenceKey(site);
      const pinned = pin[key];
      if (pinned === undefined || pinned !== site.shape) {
        faults.push({ key, shape: site.shape, pinned: pinned ?? null });
      }
    }
    return faults;
  }

  function describeFaults(
    family: string,
    rows: Array<{ key: string; shape: string; pinned: string | null }>,
  ): string {
    return (
      `${rows.length} ${family} occurrence(s) below AA are not accounted for by ` +
      `their own pin entry:\n` +
      rows
        .map(
          (r) =>
            `  ${r.key}\n` +
            `      now:    ${r.shape}\n` +
            (r.pinned === null
              ? `      pinned: (nothing — this occurrence is new, or it moved)\n`
              : `      pinned: ${r.pinned}`),
        )
        .join("\n") +
      `\n\nThe key is \`file#declaration#ordinal\`, so this is about WHICH site, ` +
      `not merely which form. Either the site is new or moved — a regression, ` +
      `and it belongs in the fix rather than in the map — or it changed form, ` +
      `in which case the pinned value above is the form it used to hold.`
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
    ["wash", WASH_OCCURRENCES, () => census.failing],
    ["palette", PALETTE_OCCURRENCES, () => palette.failing],
  ] as const)(
    "accounts for every %s OCCURRENCE against its own pin entry",
    (family, pin, discovered) => {
      const rows = occurrenceFaults(discovered(), pin);
      expect(
        rows,
        rows.length
          ? describeFaults(family, rows)
          : `${family} census is fully accounted for`,
      ).toHaveLength(0);
    },
  );

  it.each([
    ["wash", WASH_OCCURRENCES],
    ["palette", PALETTE_OCCURRENCES],
  ] as const)(
    "pins only real files for the %s family, so a typo cannot pin nothing",
    (_family, pin) => {
      for (const key of Object.keys(pin)) {
        const file = key.split("#")[0];
        expect(
          existsSync(resolve(projectRoot, file)),
          `${file} is a key in the ${_family} pin but not a file in the tree; a ` +
            `misspelt path pins nothing, and every occurrence in it then reads ` +
            `as new`,
        ).toBe(true);
        expect(
          pin[key].length,
          `${key} is pinned with an empty shape`,
        ).toBeGreaterThan(0);
      }
    },
  );

  it("catches an occurrence replaced by the same shape elsewhere in the SAME file", () => {
    // The mutation the per-file multiset could not see, modelled so it cannot be
    // satisfied by accident.
    //
    // CatalogTab really does hold three identical accent washes, in three
    // different declarations. Under a per-file multiset the file said
    // {accent/20 x3} before and {accent/20 x3} after this migration: the count
    // is identical, the multiset is identical, and the file aggregate says
    // nothing has happened. One site was resolved and a different site was
    // created in its place, which is not nothing — it is a new broken site and a
    // silently dropped one.
    const pin = {
      "src/A.tsx#Alpha#1": "bg-[var(--x)]/20 + text-[var(--x)]",
      "src/A.tsx#Beta#1": "bg-[var(--x)]/20 + text-[var(--x)]",
    };
    const before = [
      {
        file: "src/A.tsx",
        id: "Alpha#1",
        shape: "bg-[var(--x)]/20 + text-[var(--x)]",
        line: 10,
      },
      {
        file: "src/A.tsx",
        id: "Beta#1",
        shape: "bg-[var(--x)]/20 + text-[var(--x)]",
        line: 40,
      },
    ];
    expect(
      occurrenceFaults(before, pin),
      "the unmigrated population is fully accounted for",
    ).toHaveLength(0);

    // Alpha#1 is resolved; a NEW occurrence appears in Gamma, same shape, same
    // file. The per-file multiset is byte-identical to `before`.
    const after = [
      {
        file: "src/A.tsx",
        id: "Gamma#1",
        shape: "bg-[var(--x)]/20 + text-[var(--x)]",
        line: 90,
      },
      {
        file: "src/A.tsx",
        id: "Beta#1",
        shape: "bg-[var(--x)]/20 + text-[var(--x)]",
        line: 40,
      },
    ];
    const rows = occurrenceFaults(after, pin);
    expect(
      rows,
      "a same-file occurrence swap must be reported even though the file's " +
        "shape multiset and site count are both unchanged",
    ).toHaveLength(1);
    expect(rows[0].key).toBe("src/A.tsx#Gamma#1");
    expect(
      rows[0].pinned,
      "the new occurrence has no pinned entry at all",
    ).toBeNull();
  });

  it("catches a still-existing occurrence that changed form", () => {
    const pin = { "src/A.tsx#Alpha#1": "bg-[var(--x)]/20 + text-[var(--x)]" };
    const rows = occurrenceFaults(
      [
        {
          file: "src/A.tsx",
          id: "Alpha#1",
          shape: "bg-[var(--y)]/90 + text-[var(--y)]",
          line: 10,
        },
      ],
      pin,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].pinned).toBe("bg-[var(--x)]/20 + text-[var(--x)]");
    expect(rows[0].shape).toBe("bg-[var(--y)]/90 + text-[var(--y)]");
  });

  it("catches a form swap that moves an occurrence to a new ordinal", () => {
    // Inserting a wash pairing above renumbers the ones after it. That is the
    // documented cost of this identity, and it must be reported rather than
    // silently re-baselined.
    const pin = {
      "src/A.tsx#Alpha#1": "bg-[var(--p)]/10 + text-[var(--p)]",
      "src/A.tsx#Alpha#2": "bg-[var(--x)]/20 + text-[var(--x)]",
    };
    const rows = occurrenceFaults(
      [
        {
          file: "src/A.tsx",
          id: "Alpha#1",
          shape: "bg-[var(--new)]/50 + text-[var(--new)]",
          line: 5,
        },
        {
          file: "src/A.tsx",
          id: "Alpha#2",
          shape: "bg-[var(--p)]/10 + text-[var(--p)]",
          line: 9,
        },
        {
          file: "src/A.tsx",
          id: "Alpha#3",
          shape: "bg-[var(--x)]/20 + text-[var(--x)]",
          line: 30,
        },
      ],
      pin,
    );
    // THREE faults, not one and not two, and that is the point. The pinned
    // values were Alpha#1=p and Alpha#2=x; after the insertion Alpha#1 is a new
    // form, Alpha#2 holds p where x was pinned, and Alpha#3 holds x where
    // nothing was pinned. Reporting only the new one would under-report a
    // renumbering that touches everything after it, and the repair would then
    // be discovered one failure at a time.
    expect(rows.map((r) => r.key)).toEqual([
      "src/A.tsx#Alpha#1",
      "src/A.tsx#Alpha#2",
      "src/A.tsx#Alpha#3",
    ]);
  });

  it("still passes when an occurrence is RESOLVED, so a fix never fails the suite", () => {
    // The one-directional property, asserted rather than assumed. A resolved
    // occurrence leaves a stale pin entry and no fault.
    const pin = {
      "src/A.tsx#Alpha#1": "bg-[var(--x)]/20 + text-[var(--x)]",
      "src/A.tsx#Alpha#2": "bg-[var(--x)]/20 + text-[var(--x)]",
    };
    expect(
      occurrenceFaults(
        [
          {
            file: "src/A.tsx",
            id: "Alpha#1",
            shape: "bg-[var(--x)]/20 + text-[var(--x)]",
            line: 10,
          },
        ],
        pin,
      ),
      "resolving one of two identical occurrences leaves a stale entry and no fault",
    ).toHaveLength(0);
    expect(
      occurrenceFaults([], pin),
      "resolving every occurrence in a file leaves stale entries and no fault",
    ).toHaveLength(0);
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
