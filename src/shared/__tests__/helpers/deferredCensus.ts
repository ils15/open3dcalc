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
 * A SITE, NOT A FILE
 * ------------------
 * The unit is a site: one (background, ink) pairing at one source location.
 * This is the whole point of the module, so it is worth being explicit about
 * why a file count is the wrong instrument. A file count cannot distinguish
 *
 *   - a site that was fixed              (count falls — good)
 *   - a site that changed form           (count unchanged — BAD, hidden)
 *   - three sites in one file, one fixed (count unchanged — BAD, hidden)
 *
 * The middle case is the one that matters: migrating `bg-[var(--color-accent)]/20
 * text-[var(--color-accent)]` to a *different* broken pairing leaves the file
 * count identical, so a file-count floor reports green over a population that
 * is just as broken as before. A site count falls whenever real work happens.
 * A site count alone is still not sufficient — two sites can share a shape, so
 * deleting one does not change the set of shapes — which is why the census
 * reports both, and the caller floors the count AND pins the shape set.
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
   * The FORM, as written: `bg-[var(--color-accent)]/20 + text-[var(--color-accent)]`.
   * This is the unit that catches a site changing shape while its file count
   * stands still, so it is a first-class output rather than a debug string.
   */
  shape: string;
  /** worst ratio over every theme x backdrop, and where that worst case is */
  ratio: number;
  where: string;
}

/** Removes `/* … *\/` and `// …` without eating the `//` in `https://`. */
export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
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

/**
 * Every wash site that falls below AA in ANY theme over ANY backdrop, together
 * with the ones that clear it.
 *
 * Both are returned: the caller floors the failing count, and a separate
 * assertion uses the passing ones to prove the census is not simply reporting
 * everything as broken (which would make the floor unfalsifiable).
 */
export function censusWashes(options: {
  tokensCss: string;
  srcRoot: string;
  projectRoot: string;
}): {
  failing: DeferredSite[];
  passing: DeferredSite[];
  unresolvable: string[];
} {
  const { tokensCss, srcRoot, projectRoot } = options;
  const failing: DeferredSite[] = [];
  const passing: DeferredSite[] = [];
  const unresolvable: string[] = [];

  for (const file of walkComponents(srcRoot)) {
    const source = stripComments(readFileSync(file, "utf-8"));
    const rel = relative(projectRoot, file);

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
            unresolvable.push(`  ${rel}:${line}  ${wash} + ${ink}`);
            continue;
          }
          const site: DeferredSite = {
            file: rel,
            line,
            shape: `${wash} + ${ink}`,
            ratio: worst,
            where,
          };
          (worst < AA_NORMAL_TEXT ? failing : passing).push(site);
        }
      }
    }
  }

  const byWorst = (a: DeferredSite, b: DeferredSite): number =>
    a.ratio - b.ratio;
  return {
    failing: failing.sort(byWorst),
    passing: passing.sort(byWorst),
    unresolvable: unresolvable.sort(),
  };
}

/**
 * Every raw-palette background site below AA in either theme.
 *
 * No backdrop set is needed: a palette utility is opaque, so the pairing is
 * decided by the two colours alone. The theme still matters, because the ink
 * flips and the background does not — which is the defect.
 */
export function censusPaletteBackgrounds(options: {
  tokensCss: string;
  srcRoot: string;
  projectRoot: string;
  themeCss: string;
}): { failing: DeferredSite[]; passing: DeferredSite[] } {
  const { tokensCss, srcRoot, projectRoot, themeCss } = options;
  const palette = tailwindPaletteMap(themeCss);
  const failing: DeferredSite[] = [];
  const passing: DeferredSite[] = [];

  for (const file of walkComponents(srcRoot)) {
    const source = stripComments(readFileSync(file, "utf-8"));
    const rel = relative(projectRoot, file);

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
        // An unlisted step is NOT measured, and must not be counted as passing.
        if (!hex) continue;
        for (const ink of inks) {
          let worst = Infinity;
          let where = "";
          for (const theme of THEMES) {
            const inkHexValue = inkHex(tokensCss, ink, theme);
            if (!inkHexValue) continue;
            const ratio = contrastRatio(inkHexValue, hex);
            if (ratio < worst) {
              worst = ratio;
              where = `${inkHexValue} on ${hex} (${ink} on bg-${bg}) in ${theme} mode`;
            }
          }
          const site: DeferredSite = {
            file: rel,
            line,
            shape: `bg-${bg} + ${ink}`,
            ratio: worst,
            where,
          };
          (worst < AA_NORMAL_TEXT ? failing : passing).push(site);
        }
      }
    }
  }

  return {
    failing: failing.sort((a, b) => a.ratio - b.ratio),
    passing: passing.sort((a, b) => a.ratio - b.ratio),
  };
}
