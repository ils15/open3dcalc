/**
 * The DEFERRED population: two families of call site that this guard measures
 * but does not yet police, and the census that counts them.
 *
 * WHY A SEPARATE MODULE
 * ---------------------
 * The measurement is the expensive, mechanical half; the assertions are the
 * half a reviewer reads. Splitting them keeps accentBackgroundContrast.test.ts
 * about what must be true rather than about how the number was obtained — and
 * it means a fix to the census does not have to be re-reviewed as if it were a
 * change of policy.
 *
 * THE TWO FAMILIES
 * -----------------
 * 1. Translucent washes — `bg-[var(--<hue>)]/NN` over a text token. The main
 *    guard deliberately skips these, because a translucent background's
 *    effective colour depends on what is behind it and a class string does not
 *    say what that is. They ARE decidable over the complete set of surface
 *    tokens, which is what this census does.
 * 2. Raw Tailwind palette backgrounds — `bg-red-600`. Theme-independent by
 *    construction, which is the defect: behind an ink that flips. Decidable
 *    because `tailwindPaletteMap` resolves the oklch palette to sRGB.
 *
 * A SITE IS AN OCCURRENCE, NOT A FILE AND NOT A FORM
 * --------------------------------------------------
 * The unit is a site: one (background, ink) pairing at one source location,
 * identified as `declaration#ordinal` within its file. Two weaker units were
 * tried and both were caught by review, and the reasons are the reason this
 * module reports an `id` at all:
 *
 *   FILE COUNT  cannot distinguish a site that was fixed (count falls — good)
 *               from a site that changed form (count unchanged — BAD, hidden),
 *               or three sites in one file with one fixed (count unchanged).
 *   GLOBAL FORM SET  cannot see a site migrate from one already-allowlisted
 *               form to a DIFFERENT already-allowlisted form. Count unchanged,
 *               set unchanged, guard green.
 *   FILE FORM MULTISET  closes the cross-file case, but not the same-file one:
 *               resolve the occurrence in `PrinterManager` and add the same
 *               shape in `MaterialManager`, and the file still holds three
 *               identical shapes. The population is just as broken and the file
 *               aggregate says nothing happened.
 *
 * So the census reports, per site: `decl`, `ordinal`, a combined `id`, and the
 * `shape` it currently holds. The caller pins `id -> shape`, so the pin says
 * which site AND what it is. Occurrence identity and the shape are deliberately
 * separate: identity survives reformatting, shape is the thing that can change.
 *
 * The census FAILS CLOSED. A pairing it cannot decide — an unlisted palette
 * step, an ink naming an undeclared token, a surface token that does not
 * resolve — is reported in `unresolved` and is NOT counted as a site in either
 * direction. The alternative is the failure this module was corrected for: a
 * dropped site is invisible to a count floor, and `worst` left at Infinity filed
 * an unmeasured pairing under PASSING, so an unreadable measurement was recorded
 * as a clean one and its absence read as progress.
 *
 * COMMENTS ARE STRIPPED, AND THAT IS NOT COSMETIC
 * ----------------------------------------------
 * A scan that reads comment text counts sites that do not exist. This is not
 * hypothetical: the toast fix documents the exact class string it removed, so
 * the broken form is quoted verbatim in the file that no longer contains it.
 * For a floor this is worse than a false positive — it pins a number for work
 * that does not exist, and makes the number depend on how a comment is worded.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { relative } from "node:path";

import {
  AA_NORMAL_TEXT,
  compositeOver,
  contrastRatio,
  resolveTokenHex,
  resolveTokenLayers,
  tailwindPaletteMap,
} from "./contrast";

/** The surfaces an element can sit on. Exhaustiveness is the point. */
export const BACKDROPS = [
  "surface-canvas",
  "surface-raised",
  "surface-overlay",
  "surface-sunken",
  "surface-input",
] as const;

export const THEMES = ["light", "dark"] as const;

/**
 * The hue/foreground token families a wash is derived from, without the leading
 * `--`. Both spellings are listed because call sites use both and they are the
 * same colour: `--color-accent` is an alias of `--accent`.
 *
 * Deliberately broader than the accent alone. The previous floor matched
 * `/bg-\[var\(--(?:color-)?accent\)\]\/\d+/` and so counted none of the status
 * washes — `--color-danger/90` and `--color-success/90` were invisible to it,
 * and those were among the worst pairings in the app. A floor that does not
 * cover the population it is a floor for is decoration.
 */
const WASH_FAMILY =
  /^(color-)?(accent|primary|positive|success|danger|critical|warning|info|revenue|cost)$/;

const PALETTE_BG = /^bg-([a-z]+-\d{2,3})$/;

export interface DeferredSite {
  /** repo-relative, for the failure message */
  file: string;
  line: number;
  /**
   * The enclosing top-level declaration — `typeStyles`, `CatalogTab`,
   * `useMobileSheet`. Only COLUMN-ZERO declarations count, so a `const` inside a
   * function body does not become a boundary and the granularity stays at the
   * component or module level.
   */
  decl: string;
  /** 1-based ordinal of this pairing within that declaration, in source order */
  ordinal: number;
  /**
   * The stable occurrence identity: `${decl}#${ordinal}`.
   *
   * This is what a pin is keyed on, and it is the answer to "which occurrence".
   * A shape string cannot serve, because two occurrences of one shape are
   * indistinguishable — resolve one and add the same shape elsewhere in the
   * same file and a per-file multiset is unchanged. A line number cannot serve
   * either, because any edit above shifts it.
   *
   * Stability, stated honestly rather than oversold:
   *
   *   SURVIVES  line shifts; edits above the declaration; added or removed
   *             literals that are not wash pairings (they do not consume an
   *             ordinal); reformatting.
   *   CHANGES ON a wash pairing being added, removed or reordered within the
   *             same declaration, or taking a different form.
   *
   * The one real cost: inserting a wash pairing near the top of a declaration
   * renumbers the ones after it, and they are reported as changed. That is
   * deliberate — a shift in the order of a file's known-broken sites is worth
   * one loud failure rather than a silent re-baseline, and the failure message
   * names the declaration and ordinal so the fix is a copy-paste.
   */
  id: string;
  /**
   * The FORM, as written: `bg-[var(--color-accent)]/20 + text-[var(--color-accent)]`.
   * Kept as a first-class output because it is the PINNED VALUE for the
   * occurrence — identity says which site, shape says what it currently is.
   */
  shape: string;
  /** worst ratio over every theme x backdrop, and where that worst case is */
  ratio: number;
  where: string;
}

/**
 * Top-level declarations, at column zero only. Anchored with `m` so an indented
 * `const` inside a function body is not a boundary.
 */
const DECLARATION =
  /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm;

/**
 * A cursor that turns a source offset into `decl#ordinal`, consumed in source
 * order by the scanners below.
 *
 * Held per FILE, not globally, so two files cannot share ordinals. One pass:
 * the caller walks literals in order, advancing the declaration cursor as it
 * goes, and takes the next ordinal for the declaration it lands in.
 */
class OccurrenceCounter {
  private readonly declarations: Array<{ name: string; at: number }>;
  private next = 0;
  private readonly used = new Map<string, number>();

  constructor(private readonly source: string) {
    this.declarations = [...source.matchAll(DECLARATION)].map((m) => ({
      name: m[1],
      at: m.index!,
    }));
  }

  /** The declaration owning `offset`. */
  private declarationAt(offset: number): string {
    while (
      this.next < this.declarations.length &&
      this.declarations[this.next].at < offset
    ) {
      this.next += 1;
    }
    return this.declarations[this.next - 1]?.name ?? "<module>";
  }

  /** The identity for the next pairing at `offset`. Call once per pairing. */
  at(offset: number): { decl: string; ordinal: number; id: string } {
    const decl = this.declarationAt(offset);
    const ordinal = (this.used.get(decl) ?? 0) + 1;
    this.used.set(decl, ordinal);
    return { decl, ordinal, id: `${decl}#${ordinal}` };
  }
}

/**
 * Removes `/* … *\/` and `// …` without eating the `//` in `https://`.
 *
 * The block-comment replacement preserves every NEWLINE and blanks the rest,
 * rather than deleting the comment outright. That is not cosmetic: deleting a
 * multi-line comment shifts every subsequent line, so a reported `line` pointed
 * 12 lines above the site that actually had the problem — which is precisely
 * when a reviewer most needs the line number to be right. Occurrence identity
 * is unaffected either way (it is declaration + ordinal, not position), but the
 * diagnostics are only actionable if the line is true.
 */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/([^:])\/\/[^\n]*/g, "$1");
}

function stripVariants(utility: string): string {
  let out = utility;
  while (/^[a-z-]+:/.test(out)) out = out.slice(out.indexOf(":") + 1);
  return out;
}

/** Every .tsx under `root`, tests excluded. */
export function walkComponents(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry === "Example") continue;
      const full = `${dir}/${entry}`;
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".tsx")) out.push(full);
    }
  };
  walk(root);
  return out
    .filter((f) => !f.includes("__tests__") && !f.includes(".test."))
    .sort();
}

/** Single-line string literals. Every class string in this repo is one line. */
const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;

function isTextUtility(utility: string): boolean {
  const base = stripVariants(utility);
  return /^text-\[var\(--[a-z0-9-]+\)\]$/i.test(base);
}

function isInkLiteral(utility: string): boolean {
  const base = stripVariants(utility);
  return base === "text-white" || base === "text-black";
}

function inkHex(
  tokensCss: string,
  utility: string,
  theme: (typeof THEMES)[number],
): string | null {
  const base = stripVariants(utility);
  if (isInkLiteral(utility))
    return base === "text-white" ? "#ffffff" : "#000000";
  const token = base.match(/^text-\[var\(--([a-z0-9-]+)\)\]$/i)?.[1];
  return token ? resolveTokenHex(tokensCss, theme, token) : null;
}

/**
 * `bg-[var(--x)]` or `bg-[var(--x)]/NN` -> the token and the alpha to paint it
 * at. Alpha composes with whatever alpha the token itself declares, so a wash
 * token under a `/NN` modifier is measured at the product, which is what
 * renders.
 */
function washLayers(
  tokensCss: string,
  utility: string,
  theme: (typeof THEMES)[number],
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

export interface Census {
  failing: DeferredSite[];
  passing: DeferredSite[];
  /**
   * Pairings the scan could not decide, one diagnostic per site.
   *
   * This is the fail-closed channel, and it exists because the alternative is
   * silent. A palette step missing from the theme map, or a `text-[var(--x)]`
   * naming an undeclared token, used to make the scan `continue`, which left the
   * site invisible AND — because `worst` was still Infinity — filed it under
   * PASSING. An unreadable measurement was being recorded as a clean one, and
   * the count floor read the absence as progress. A scan that cannot decide must
   * say so; a guard that cannot measure must fail.
   */
  unresolved: string[];
}

const byWorst = (a: DeferredSite, b: DeferredSite): number => a.ratio - b.ratio;

const finish = (c: Census): Census => ({
  failing: c.failing.sort(byWorst),
  passing: c.passing.sort(byWorst),
  unresolved: c.unresolved.sort(),
});

/**
 * Wash pairings in one file's source. Exported so it can be tested against a
 * synthetic source, which is the only way to prove the fail-closed and
 * occurrence-identity behaviour without editing a component.
 */
export function scanWashesInSource(options: {
  tokensCss: string;
  file: string;
  source: string;
}): Census {
  const { tokensCss, file } = options;
  const source = stripComments(options.source);
  const census: Census = { failing: [], passing: [], unresolved: [] };
  const counter = new OccurrenceCounter(source);

  for (const literal of source.matchAll(LITERAL)) {
    const utilities = literal[2].split(/\s+/).filter(Boolean);
    const washes = utilities.filter((u) => {
      const token = stripVariants(u).match(
        /^bg-\[var\(--([a-z0-9-]+)\)\](?:\/\d{1,3})?$/i,
      )?.[1];
      return token !== undefined && WASH_FAMILY.test(token);
    });
    if (!washes.length) continue;
    const inks = utilities.filter(isTextUtility);
    if (!inks.length) continue;
    const line = source.slice(0, literal.index!).split("\n").length;

    for (const wash of washes) {
      for (const ink of inks) {
        const { decl, ordinal, id } = counter.at(literal.index!);
        let worst = Infinity;
        let where = "";
        let ok = true;
        for (const theme of THEMES) {
          const layers = washLayers(tokensCss, wash, theme);
          const inkHexValue = inkHex(tokensCss, ink, theme);
          if (!layers || !inkHexValue) {
            ok = false;
            continue;
          }
          for (const backdrop of BACKDROPS) {
            const surface = resolveTokenHex(tokensCss, theme, backdrop);
            if (!surface) {
              ok = false;
              continue;
            }
            const composited = compositeOver(layers, surface);
            const ratio = contrastRatio(inkHexValue, composited);
            if (ratio < worst) {
              worst = ratio;
              where =
                `${inkHexValue} on ${composited} (${ink} on ${wash} over ` +
                `--${backdrop} ${surface}) in ${theme} mode`;
            }
          }
        }
        if (!ok) {
          census.unresolved.push(
            `  ${file}:${line}  [${id}]  ${wash} + ${ink}`,
          );
          continue;
        }
        const site: DeferredSite = {
          file,
          line,
          decl,
          ordinal,
          id,
          shape: `${wash} + ${ink}`,
          ratio: worst,
          where,
        };
        (worst < AA_NORMAL_TEXT ? census.failing : census.passing).push(site);
      }
    }
  }
  return census;
}

/** Wash pairings across the tree. */
export function censusWashes(options: {
  tokensCss: string;
  srcRoot: string;
  projectRoot: string;
}): Census {
  const { tokensCss, srcRoot, projectRoot } = options;
  const census: Census = { failing: [], passing: [], unresolved: [] };
  for (const file of walkComponents(srcRoot)) {
    const found = scanWashesInSource({
      tokensCss,
      file: relative(projectRoot, file),
      source: readFileSync(file, "utf-8"),
    });
    census.failing.push(...found.failing);
    census.passing.push(...found.passing);
    census.unresolved.push(...found.unresolved);
  }
  return finish(census);
}

/**
 * Raw-palette pairings in one file's source.
 *
 * No backdrop set is needed: a palette utility is opaque, so the pairing is
 * decided by the two colours alone. The theme still matters, because the ink
 * flips and the background does not — which is the defect.
 *
 * Fail-closed, and this is the whole substance of the change. A `bg-<step>`
 * whose step is not in the theme map, or a `text-[var(--x)]` naming an
 * undeclared token, is recorded in `unresolved` and NOT counted as a site. It
 * used to be `continue`d past, which dropped the site from the population
 * entirely — and because `worst` stayed `Infinity`, the pair was then filed as
 * PASSING. So an unmeasurable pairing was silently reported as a clean one, and
 * the count floor read its disappearance as the backlog shrinking.
 */
export function scanPaletteInSource(options: {
  tokensCss: string;
  file: string;
  source: string;
  palette: Map<string, string>;
}): Census {
  const { tokensCss, file, palette } = options;
  const source = stripComments(options.source);
  const census: Census = { failing: [], passing: [], unresolved: [] };
  const counter = new OccurrenceCounter(source);

  for (const literal of source.matchAll(LITERAL)) {
    const utilities = literal[2].split(/\s+/).filter(Boolean);
    const bgs = utilities
      .map((u) => stripVariants(u).match(PALETTE_BG)?.[1])
      .filter((v): v is string => v !== undefined);
    if (!bgs.length) continue;
    const inks = utilities.filter((u) => isTextUtility(u) || isInkLiteral(u));
    if (!inks.length) continue;
    const line = source.slice(0, literal.index!).split("\n").length;

    for (const bg of bgs) {
      const hex = palette.get(bg);
      if (!hex) {
        // Unresolvable BACKGROUND. Recorded for every ink in the literal,
        // because the pairing is a (background, ink) product and an unreadable
        // background leaves each of them undecidable.
        for (const ink of inks) {
          const { id } = counter.at(literal.index!);
          census.unresolved.push(
            `  ${file}:${line}  [${id}]  bg-${bg} + ${ink}  — ` +
              `bg-${bg} is not in the Tailwind theme map, so the pairing cannot ` +
              `be decided (an unreadable measurement is not a passing one)`,
          );
        }
        continue;
      }
      for (const ink of inks) {
        const { decl, ordinal, id } = counter.at(literal.index!);
        let worst = Infinity;
        let where = "";
        let ok = true;
        for (const theme of THEMES) {
          const inkHexValue = inkHex(tokensCss, ink, theme);
          if (!inkHexValue) {
            ok = false;
            continue;
          }
          const ratio = contrastRatio(inkHexValue, hex);
          if (ratio < worst) {
            worst = ratio;
            where = `${inkHexValue} on ${hex} (${ink} on bg-${bg}) in ${theme} mode`;
          }
        }
        if (!ok) {
          census.unresolved.push(
            `  ${file}:${line}  [${id}]  bg-${bg} + ${ink}  — ${ink} does not ` +
              `resolve in every theme, so the pairing cannot be decided`,
          );
          continue;
        }
        const site: DeferredSite = {
          file,
          line,
          decl,
          ordinal,
          id,
          shape: `bg-${bg} + ${ink}`,
          ratio: worst,
          where,
        };
        (worst < AA_NORMAL_TEXT ? census.failing : census.passing).push(site);
      }
    }
  }
  return census;
}

/** Raw-palette pairings across the tree. */
export function censusPaletteBackgrounds(options: {
  tokensCss: string;
  srcRoot: string;
  projectRoot: string;
  themeCss: string;
}): Census {
  const { tokensCss, srcRoot, projectRoot, themeCss } = options;
  const palette = tailwindPaletteMap(themeCss);
  const census: Census = { failing: [], passing: [], unresolved: [] };
  for (const file of walkComponents(srcRoot)) {
    const found = scanPaletteInSource({
      tokensCss,
      file: relative(projectRoot, file),
      source: readFileSync(file, "utf-8"),
      palette,
    });
    census.failing.push(...found.failing);
    census.passing.push(...found.passing);
    census.unresolved.push(...found.unresolved);
  }
  return finish(census);
}
