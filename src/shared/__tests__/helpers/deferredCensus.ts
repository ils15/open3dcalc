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
 * A SITE IS AN OWNING JSX ELEMENT
 * -------------------------------
 * The unit is a site: one (background, ink) pairing, belonging to the JSX
 * element that owns it. Three weaker keys were tried and all three were caught
 * by review, and their failure modes are why the key is an element:
 *
 *   FILE COUNT          cannot tell a site that was fixed (count falls — good)
 *                       from one that changed form (count unchanged — hidden).
 *   GLOBAL FORM SET     cannot see a site migrate to a different
 *                       already-allowlisted form: count and set both unchanged.
 *   decl#ORDINAL        survives reformatting but not SUBSTITUTION: two
 *                       elements in one declaration swap their pairings and
 *                       every ordinal is still where it was. The ordinal names a
 *                       position, not a site.
 *   SHAPE (or its hash)  two sites holding one form are indistinguishable.
 *
 * So the key is the element, resolved by a hybrid: a static `data-testid`/`id`
 * the element ALREADY carries, otherwise a source-only comment beside it. No
 * runtime attribute is added. Ownership is EXCLUSIVE — one identity names exactly
 * one element, and `identityFaults` reports a marker claimed twice, a marker that
 * owns nothing, and an id reached from two elements. Each of those leaves every
 * count and every shape multiset untouched when the two elements happen to share
 * a form, so none of them is visible to a comparison of totals.
 *
 * The census reports, per site, the `siteId` and the `shape` it currently holds.
 * The caller pins `siteId -> shapes[]`, so the pin says which site AND what it
 * is. Identity and shape are deliberately separate: the identity survives
 * reformatting because a comment stays attached to its element, and the shape is
 * the thing allowed to change.
 *
 * The pin is ONE-DIRECTIONAL, and the census is not where that is decided: a
 * site that is resolved stops being a current site and leaves its pin entry
 * behind, which is not a fault. Requiring the reverse — that a pinned form still
 * occur somewhere — would fail precisely when the policy is working.
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
import ts from "typescript";

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
   * Offset of the pairing's class-string literal, valid in the ORIGINAL source
   * because `stripComments` is length-preserving.
   *
   * Reported so identity resolves against the element that owns the literal. The
   * line number is a convenience for humans; this is what the machine needs, and
   * assuming a column is what once put a marker inside an arrow function.
   */
  offset: number;
  /**
   * The owning element's stable identity, or null when it has none.
   *
   * One identity may legitimately cover several shapes: four elements here pair
   * `bg-emerald-600` and its `hover:bg-emerald-500` with the same ink, so the pin
   * is `siteId -> shapes[]` rather than `siteId -> shape`.
   *
   * Null is a FINDING, never a skip. An element with no identity is exactly the
   * element a pin cannot protect, and letting it pass is how the population grew
   * unnoticed in the first place.
   */
  siteId: string | null;
  /** The FORM as written. The pinned VALUE for the site. */
  shape: string;
  /** worst ratio over every theme x backdrop, and where that worst case is */
  ratio: number;
  where: string;
}

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(
      /([^:])\/\/[^\n]*/g,
      (m) => m[0] + m.slice(1).replace(/[^\n]/g, " "),
    );
}

/* ------------------------------------------------------------------ *
 * SITE IDENTITY, resolved from the OWNING JSX ELEMENT
 *
 * A hybrid, in this order:
 *   1. a stable attribute the element ALREADY carries — a static
 *      `data-testid` or `id`. Adding nothing beats adding something, and an
 *      existing test id is already a promise that the element is individually
 *      addressable. One element in this tree qualifies.
 *   2. otherwise an explicit source-only comment beside the element.
 *
 * No runtime attribute is ever added for this. Both spellings of the comment
 * are source-only and emit nothing: the JSX form renders no node, and the plain
 * form is not even a JSX expression. That is why a comment is preferred over a
 * `data-*` hook added purely to satisfy a test.
 *
 * WHY IDENTITY MUST BE THE ELEMENT, NOT A POSITION
 * ------------------------------------------------
 * Two earlier schemes named a POSITION and both were blocked, correctly:
 *   line number     shifts on any edit above it.
 *   decl#ordinal    survives reformatting but not substitution: two elements in
 *                   one declaration swap their pairings and every ordinal is
 *                   unchanged, so the pin cannot see it.
 * The element is the thing that exists. A comment attached to it moves with it,
 * so identity survives line shifts, reformatting, reordering, and a change of
 * form — and the shape, which is what the pin stores as the value, is exactly
 * the thing that is allowed to change.
 * ------------------------------------------------------------------ */

/**
 * A marker, in either legal position.
 *
 *   `{/* contrast-site: id *@/`  JSX-children position, among an element's
 *                                 siblings.
 *   `/* contrast-site: id *@/`    JavaScript position, required when the element
 *                                 is the first thing inside a parenthesised
 *                                 expression — `return (`, `{x ? (`,
 *                                 `{x && (`. There the braces form is an
 *                                 object literal in an expression, not a
 *                                 comment, and the file does not parse.
 *
 * Narrow on purpose (lowercase, digits, dashes) so an id cannot smuggle
 * punctuation and prose mentioning the phrase cannot match by accident.
 */
const SITE_MARKER =
  /(?:\{\s*)?\/\*\s*contrast-site:\s*([a-z0-9][a-z0-9-]*)\s*\*\/(?:\s*\})?/g;

export interface SiteMarker {
  id: string;
  /** offset just past the marker */
  end: number;
  line: number;
}

export function siteMarkers(source: string): SiteMarker[] {
  return [...source.matchAll(SITE_MARKER)].map((m) => ({
    id: m[1],
    end: m.index! + m[0].length,
    line: source.slice(0, m.index!).split("\n").length,
  }));
}

/**
 * The offset of the `<` opening the JSX element that owns the literal at
 * `offset`: the NEAREST preceding `<` followed by a tag name.
 *
 * "Nearest" is what makes this the INNERMOST enclosing element, and it is why
 * this is a tag scan and never a line scan: several of these class strings are
 * multi-line template literals, so the literal sits lines below its tag, and a
 * backward LINE search lands inside an arrow function's JSX.
/**
 * A STATIC `data-testid` or `id` on the owning element, or null.
 *
 * Only a plain string literal counts. A template value such as a testid built
 * from an entry version is per-render and names no single source site, so it
 * cannot be identity. Localized `aria-label` values are excluded for the same
 * reason and are never consulted.
 */
export function staticAttrIdentity(tagText: string): string | null {
  for (const m of tagText.matchAll(
    /\b(data-testid|id)=(?:"([^"]*)"|'([^']*)')/g,
  )) {
    const value = (m[2] ?? m[3] ?? "").trim();
    if (value) return `${m[1]}=${value}`;
  }
  return null;
}

export interface IdentityContext {
  original: string;
  markers: SiteMarker[];
  /**
   * marker end -> the ONE element that marker may name.
   *
   * Precomputed, and that is the fix. The previous resolver picked the nearest
   * marker BEFORE a class literal, which is not the same thing: a marker whose
   * element has no deferred pairing handed its identity to whatever element came
   * next, so a site could be named by a comment sitting above a sibling. Binding
   * is instead positional and forward-only — the next JSX opening element after
   * the marker, and no other.
   */
  markerOwnerTag: Map<number, number | null>;
  /** owning-tag start -> resolved identity, so an element resolves once */
  tagIdentity: Map<number, string | null>;
  /** identity -> the distinct elements using it, for duplicate reporting */
  idOwners: Map<string, Set<number>>;
  /** marker end -> the marker that also claims the same element, if any */
  markerRival: Map<number, number>;
  /**
   * The real JSX elements in this file, in one parse. Every lookup in this
   * module is a search in here, so re-parsing per lookup would make the census
   * quadratic in file size for no benefit.
   */
  jsxStarts: number[];
  /** element `<` offset -> where that element's opening tag ends */
  jsxEnds: Map<number, number>;
}

/**
 * The real JSX opening elements in `source`: each `<` offset, and where that
 * element's tag ends. One parse, both facts.
 *
 * This replaces a regex that looked for `<` followed by a name. A regex cannot
 * tell an element from a STRING that happens to contain one, so a dangling
 * marker sitting above the literal `"<span>"` was bound to a node that does not
 * exist: the marker looked owned, the element resolved, and the census reported
 * a site backed by nothing. TypeScript already knows the difference and is
 * installed, so the question is asked of the parser instead of of a pattern.
 *
 * Both forms count, because both open a tag: `<div …>` and `<Icon />`.
 * Fragments and closing tags do not — a marker is about to open something.
 */
function jsxElements(source: string): {
  starts: number[];
  ends: Map<number, number>;
} {
  const sf = ts.createSourceFile(
    "contrast-site.tsx",
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const starts: number[] = [];
  const ends = new Map<number, number>();
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const start = node.getStart(sf);
      starts.push(start);
      ends.set(start, node.getEnd());
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  starts.sort((a, b) => a - b);
  return { starts, ends };
}

/** The `<` of the next REAL JSX element strictly after `from`, or null. */
function nextElementAfter(
  starts: readonly number[],
  from: number,
): number | null {
  for (const start of starts) {
    if (start > from) return start;
  }
  return null;
}

/**
 * The element that owns the literal at `offset`: the last real JSX element
 * opening before it whose tag has not closed yet.
 *
 * Parser-driven for the same reason as above, and it fixes the mirror-image bug
 * too: the old version took the nearest `<Name` before the offset, so a class
 * literal in a string on an earlier line could be attributed to a tag that does
 * not contain it.
 */
function owningElement(
  ctx: { jsxStarts: readonly number[]; jsxEnds: ReadonlyMap<number, number> },
  offset: number,
): number | null {
  let owner: number | null = null;
  for (const start of ctx.jsxStarts) {
    if (start >= offset) break;
    owner = start;
  }
  if (owner === null) return null;
  // The owner must still be open at `offset`: a class literal in a sibling that
  // closed earlier is not inside this one.
  const end = ctx.jsxEnds.get(owner);
  return end !== undefined && end > offset ? owner : null;
}

/**
 * The owning element's full opening tag, from its `<` to the `>` that closes it.
 *
 * The parser already knows where that is, including across wrapped attributes,
 * `onClick={() => …}` and `` className={`… ${x}`} `` — each of which contains a
 * `>` that does not close the tag, and each of which the previous hand-rolled
 * scanner had to special-case. None of that is reimplemented here.
 */
function elementText(
  source: string,
  tagStart: number,
  ends: ReadonlyMap<number, number>,
): string {
  const end = ends.get(tagStart);
  return end === undefined
    ? source.slice(tagStart)
    : source.slice(tagStart, end);
}

export function identityContext(original: string): IdentityContext {
  const markers = siteMarkers(original);
  const { starts, ends } = jsxElements(original);
  const markerOwnerTag = new Map<number, number | null>();
  // Each marker owns the next element after it. Two markers can land on the
  // same element, which is recorded rather than resolved silently.
  const markerRival = new Map<number, number>();
  const byTag = new Map<number, number>();
  for (const marker of markers) {
    const tag = nextElementAfter(starts, marker.end);
    markerOwnerTag.set(marker.end, tag);
    if (tag === null) continue;
    const prior = byTag.get(tag);
    if (prior !== undefined) {
      markerRival.set(marker.end, prior);
      markerRival.set(prior, marker.end);
    } else {
      byTag.set(tag, marker.end);
    }
  }
  return {
    original,
    markers,
    markerOwnerTag,
    markerRival,
    tagIdentity: new Map(),
    idOwners: new Map(),
    jsxStarts: starts,
    jsxEnds: ends,
  };
}

/**
 * The identity of the element owning the literal at `offset`, or null.
 *
 * Two sources. A static `data-testid`/`id` the element ALREADY carries wins,
 * because adding nothing beats adding something. Otherwise the marker whose
 * BOUND element is this one — which is not "the nearest marker before the
 * literal", because that let a marker above a non-deferred element name whatever
 * came next. Both sides of that question are now answered by the TSX parser:
 * which element owns a literal, and which element a marker owns.
 *
 */
export function resolveSiteId(
  ctx: IdentityContext,
  offset: number,
): string | null {
  const tagStart = owningElement(ctx, offset);
  if (tagStart === null) return null;
  const cached = ctx.tagIdentity.get(tagStart);
  if (cached !== undefined) return cached;

  let id = staticAttrIdentity(elementText(ctx.original, tagStart, ctx.jsxEnds));
  if (!id) {
    for (const marker of ctx.markers) {
      if (ctx.markerOwnerTag.get(marker.end) === tagStart) {
        id = marker.id;
        break;
      }
    }
  }
  if (id) {
    const owners = ctx.idOwners.get(id) ?? new Set<number>();
    owners.add(tagStart);
    ctx.idOwners.set(id, owners);
  }
  ctx.tagIdentity.set(tagStart, id);
  return id;
}

export type IdentityFaultKind =
  "orphanMarker" | "duplicateIdentity" | "ambiguousMarker";

export interface IdentityFault {
  kind: IdentityFaultKind;
  identity: string;
  detail: string;
}

/**
 * Everything wrong with the identities in ONE file, found by walking what the
 * scan actually claimed rather than by inspecting the source text.
 *
 * Each of these is a way the population can look healthy while being wrong:
 *
 *   markerClaimedByTwoElements  one comment naming two elements, so "which
 *                               site is this?" has two answers. If their shapes
 *                               match, the multiset is identical to the healthy
 *                               case and every count-based check passes.
 *   orphanMarker                a comment that names NO element — a leftover
 *                               from a deleted element, or a comment that
 *                               nothing follows. It protects nothing while
 *                               looking like protection.
 *
 *   A marker whose element exists but holds NO deferred pairing is NOT an orphan,
 *   and that distinction is the whole point. It is what a FIXED site looks like:
 *   the element was migrated to a token-backed fill, the marker stayed because
 *   the pin entry it backs stays, and the population is one smaller. Reporting
 *   that as a fault would mean the guard failed whenever a site was fixed, which
 *   is precisely what the one-directional pin exists to permit. The stale entry is
 *   the accepted cost, and the pin is the forward check.
 *   duplicateIdentity           one id reached from two different elements, by
 *                               marker or by an attribute. Same blindness as the
 *                               first: the shapes may be identical, so nothing
 *                               downstream can tell.
 *
 * An element with NO identity is not reported here — it is reported per site by
 * the guard, because an element with no identity may hold no deferred pairing at
 * all and never become a site.
 */
export function identityFaults(ctx: IdentityContext): IdentityFault[] {
  const faults: IdentityFault[] = [];
  const lineOf = (offset: number): number =>
    ctx.original.slice(0, offset).split("\n").length;

  for (const marker of ctx.markers) {
    const owner = ctx.markerOwnerTag.get(marker.end) ?? null;
    const rival = ctx.markerRival.get(marker.end);

    // One fault per contested PAIR, reported by the earlier marker, so a
    // two-marker collision is not counted twice with the same message.
    if (rival !== undefined && marker.end < rival) {
      faults.push({
        kind: "ambiguousMarker",
        identity: marker.id,
        detail:
          `  the markers at lines ${lineOf(marker.end)} and ${lineOf(rival)} ` +
          `both claim the element at line ${lineOf(owner ?? 0)}. Ownership is ` +
          `exclusive, so this element has no unambiguous name.`,
      });
      continue;
    }
    if (owner === null) {
      faults.push({
        kind: "orphanMarker",
        identity: marker.id,
        detail:
          `  the marker at line ${lineOf(marker.end)} is followed by no JSX ` +
          `element at all, so it names nothing.`,
      });
      continue;
    }
  }

  for (const [id, owners] of [...ctx.idOwners].sort()) {
    if (owners.size > 1) {
      const lines = [...owners].sort((x, y) => x - y).map((o) => lineOf(o));
      faults.push({
        kind: "duplicateIdentity",
        identity: id,
        detail:
          `  "${id}" names ${owners.size} distinct elements (lines ` +
          `${lines.join(", ")}). One identity, one element. If their shapes ` +
          `happen to match, the population is indistinguishable from healthy.`,
      });
    }
  }
  return faults;
}

/** Rendered form, for a failure message. */
export function describeIdentityFaults(faults: IdentityFault[]): string {
  return faults
    .map((f) => `  ${f.identity}  [${f.kind}]\n${f.detail}`)
    .join("\n");
}

const siteIdOf = (ctx: IdentityContext, offset: number): string =>
  resolveSiteId(ctx, offset) ?? "UNIDENTIFIED";

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
  const ctx = identityContext(options.source);

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
          census.unresolved.push(
            `  ${file}:${line}  [${siteIdOf(ctx, literal.index!)}]  ${wash} + ${ink}`,
          );
          continue;
        }
        const site: DeferredSite = {
          file,
          line,
          offset: literal.index!,
          siteId: resolveSiteId(ctx, literal.index!),
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
  const ctx = identityContext(options.source);

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
          census.unresolved.push(
            `  ${file}:${line}  [${siteIdOf(ctx, literal.index!)}]  bg-${bg} + ${ink}  — ` +
              `bg-${bg} is not in the Tailwind theme map, so the pairing cannot ` +
              `be decided (an unreadable measurement is not a passing one)`,
          );
        }
        continue;
      }
      for (const ink of inks) {
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
            `  ${file}:${line}  [${siteIdOf(ctx, literal.index!)}]  bg-${bg} + ${ink}  — ${ink} does not ` +
              `resolve in every theme, so the pairing cannot be decided`,
          );
          continue;
        }
        const site: DeferredSite = {
          file,
          line,
          offset: literal.index!,
          siteId: resolveSiteId(ctx, literal.index!),
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
