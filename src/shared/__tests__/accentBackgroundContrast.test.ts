import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  AA_NORMAL_TEXT,
  compositeOver,
  contrastRatio,
  resolveTokenHex,
  resolveTokenLayers,
  tokenValueInBlock,
} from "./helpers/contrast";

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
 * size, not soundness — the census found 48 failing wash pairings across 13
 * files and 27 failing palette pairings across 8 files, i.e. roughly 23
 * distinct call sites over ~19 files, all pre-existing and all outside the
 * seven this task was scoped to (Toast, Select, CatalogTab, ChangelogPage,
 * SpoolThumb, SectionNav, PriceHeroCard, ExportActionsCard,
 * GcodePreviewPanel, PrivacyScreen, HistoryTab, CustomerTab, SpoolForm,
 * UpdateNotification and the StlPreview error banner among them). Turning the
 * guard on for them now means committing red, and quietly adding an xfail
 * allowance instead would convert a conformance guard into a known-issues
 * tracker that can go stale.
 *
 * So the census numbers are pinned as regression floors at the bottom of this
 * file. They can only go DOWN as sites are migrated, and a floor that stops
 * moving is a visible signal to schedule the next wave. The status fill tokens
 * added above are the one part that was brought into scope, because they are
 * solid, so no backdrop has to be assumed and the existing machinery decides
 * them exactly.
 */

const projectRoot = resolve(__dirname, "../..", "..");
const srcRoot = resolve(projectRoot, "src");
const tokensCss = readFileSync(resolve(srcRoot, "styles/tokens.css"), "utf-8");

const THEMES = [{ name: "light" }, { name: "dark" }] as const;

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
  /^(color-accent|color-primary|accent|color-accent-hover|accent-hover|accent-fill|accent-fill-hover|color-accent-fill|color-accent-fill-hover|danger-fill|danger-fill-hover|color-danger-fill|color-danger-fill-hover|warning-fill|warning-fill-hover|color-warning-fill|color-warning-fill-hover)$/;

/** Text tokens that are legal in a class string, resolved per theme. */
const TEXT_TOKEN =
  /^(color-text-primary|text-primary|color-text-inverse|text-inverse|color-accent-text|accent-fill-fg|color-accent-fill-fg|danger-fill-fg|color-danger-fill-fg|warning-fill-fg|color-warning-fill-fg|color-accent|accent|color-text-secondary|text-secondary|color-text-muted)$/;

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
    const texts = utilities.filter((u) => {
      const base = stripVariants(u);
      return (
        base in TEXT_LITERAL || /^text-\[var\(--[a-z0-9-]+\)\]$/i.test(base)
      );
    });
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

    const files = new Set(pairings.map((p) => p.file));
    expect(files.size).toBeGreaterThan(5);
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

  /**
   * The complete set of backdrops. Order is irrelevant; exhaustiveness is the
   * point. If a new surface token is ever added, add it here too, because a
   * backdrop left out of this list is a hole in the proof.
   */
  const BACKDROPS = [
    "surface-canvas",
    "surface-raised",
    "surface-overlay",
    "surface-sunken",
    "surface-input",
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

describe("guard coverage limits, asserted so they stay honest", () => {
  it("skips translucent accent backgrounds rather than guessing a backdrop", () => {
    const translucent = /bg-\[var\(--(?:color-)?accent\)\]\/\d+/;
    let found = 0;
    for (const file of walk(srcRoot)) {
      if (file.includes("__tests__") || file.includes(".test.")) continue;
      if (translucent.test(readFileSync(file, "utf-8"))) found++;
    }
    // If this ever hits 0 the skip has become dead code and the documented
    // limitation should be revisited rather than left as a stale caveat.
    expect(found).toBeGreaterThan(0);
  });

  /**
   * The census in the header block was taken before the seven call sites in
   * this branch were fixed. These two floors pin what is LEFT, so the deferred
   * population can only shrink and the caveat cannot quietly rot into a lie.
   * They are `toBeLessThanOrEqual` on purpose: fixing a site must never fail
   * this suite, only lower the number.
   */
  it("keeps the deferred translucent-accent population shrinking", () => {
    const translucent = /bg-\[var\(--(?:color-)?accent\)\]\/\d+/;
    const files: string[] = [];
    for (const file of walk(srcRoot)) {
      if (file.includes("__tests__") || file.includes(".test.")) continue;
      if (translucent.test(readFileSync(file, "utf-8"))) files.push(file);
    }
    // 16 files at the time of writing. QuoteSection and MaterialSection left
    // this population in this branch; the rest are the documented next wave.
    expect(
      files.length,
      `translucent accent washes remain in ${files.length} file(s); the header ` +
        `block says 16, so either the deferred population is growing or the ` +
        `comment is stale:\n  ${files.map((f) => relative(projectRoot, f)).join("\n  ")}`,
    ).toBeLessThanOrEqual(16);
  });

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
