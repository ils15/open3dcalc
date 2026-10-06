import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

/**
 * EVERY token-driven colour utility must actually GENERATE CSS.
 *
 * WHY THIS EXISTS
 * `bg-accent-fill`, `text-accent-fill-fg` and `selection:text-accent-fill-fg`
 * were written as BARE utilities in the Studio shell. Tailwind can only
 * synthesise a bare colour utility from a `@theme` entry, and
 * `--color-accent-fill` / `--color-accent-fill-fg` are declared ONLY in the
 * runtime alias layer of tokens.css — never in `@theme inline`. So all three
 * compiled to NOTHING: the focus-mode exit button silently lost its purple
 * fill, and `selection:text-accent-fill-fg` left selected text inheriting
 * `--color-text-primary`, which measured 2.82:1 in light mode.
 *
 * Nothing caught it. The shell guard's "names a token" regex matched the
 * substring `-accent-` inside `bg-accent-fill`, so a class that emits nothing
 * satisfied it; and every behavioural test in the suite renders in jsdom, which
 * does not compile CSS at all. Only the BUILT bundle shows the absence.
 *
 * The rule this encodes is the deterministic one: a bare colour utility
 * generates IFF its colour name is a `@theme` entry or a Tailwind built-in
 * palette step. Anything else must be written in the arbitrary-value form,
 * `bg-[var(--color-accent-fill)]`, which Tailwind passes through verbatim.
 *
 * Note this checks the TOKEN LAYER, not the bundle — a bundle grep cannot run
 * in a unit test, and the token layer is the actual precondition. The built
 * artefact is verified separately in the PR verification.
 *
 * SCOPE: every `.ts` and `.tsx` file under `src/`, excluding `__tests__`. Both
 * extensions matter — a colour utility can be assembled in a plain module and
 * exported as a string, and a `.tsx`-only walk reported green on exactly the
 * shape of C1 when that was injected into `src/utils/deadColor.ts`. The
 * `__tests__` exclusion is deliberate and necessary: these guards quote
 * non-generating class names on purpose, so scanning a test for them finds only
 * the test.
 */

const projectRoot = resolve(__dirname, "../..");
const repoRoot = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------------ *
 * The set of colour names Tailwind can generate a bare utility from.
 * ------------------------------------------------------------------ */

/** Declared by any `@theme` block in the project's own token layer. */
const THEME_COLORS: ReadonlySet<string> = new Set(
  ["styles/tokens.css", "styles/components.css"]
    .flatMap((f) => [...read(f).matchAll(/@theme[^{]*\{([^}]*)\}/g)])
    .flatMap((block) => [...block[1].matchAll(/--color-([a-z0-9-]+)\s*:/g)])
    .map((m) => m[1]),
);

/** Tailwind v4's own palette, read from the installed package. */
const BUILTIN_COLORS: ReadonlySet<string> = new Set(
  [
    ...readFileSync(
      resolve(repoRoot, "node_modules/tailwindcss/theme.css"),
      "utf-8",
    ).matchAll(/--color-([a-z]+-\d{2,3}):/g),
  ].map((m) => m[1]),
);

/**
 * Colour-name candidates from a `class` string.
 *
 * Deliberately narrow: it must not flag `text-xs`, `border-b`, `outline-none`
 * or `bg-gradient-to-r`, which share the prefixes but are not colours. A name is
 * a colour candidate when its first segment is a palette family, or when it is
 * a hyphenated token-style name that is not a Tailwind layout keyword.
 */
const COLOR_PREFIX =
  "(?:bg|text|border|ring|fill|stroke|from|via|to|divide|outline|decoration|accent|caret|placeholder)";

const FAMILIES = new Set([
  "slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber",
  "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue",
  "indigo", "violet", "purple", "fuchsia", "pink", "rose",
]);

/** First segments that make a hyphenated name a layout/size utility, not a colour. */
const KEYWORD_HEADS = new Set([
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl",
  "8xl", "9xl", "left", "center", "right", "justify", "start", "end", "wrap",
  "nowrap", "balance", "pretty", "ellipsis", "clip", "uppercase", "lowercase",
  "capitalize", "normal", "none", "b", "t", "l", "r", "x", "y", "s", "e",
  "solid", "dashed", "dotted", "double", "hidden", "collapse", "separate",
  "fixed", "sticky", "static", "relative", "absolute", "full", "screen",
  "auto", "px", "min", "max", "fit", "line", "square", "circle", "col", "row",
  "reverse", "around", "between", "evenly", "stretch", "baseline", "top",
  "middle", "bottom", "object", "contain", "cover", "scale", "z", "order",
  "grow", "shrink", "basis", "gap", "p", "m", "w", "h", "italic", "not",
  "underline", "no", "truncate", "sr", "upper", "thin", "medium",
  "extralight", "light", "semibold", "bold", "extrabold", "black", "reset",
  "gradient", "gradient", "to", "ring", "offset",
]);

const UTIL_RE = new RegExp(
  "(?:^|[\\s\"'`])((?:[a-z-]+:)*)(" +
    COLOR_PREFIX +
    ")-([a-z][a-z0-9-]*)(?:/([0-9]{1,3}))?(?=[\\s\"'`/])",
  "g",
);

/**
 * True when this name is plausibly a COLOUR, i.e. it is worth checking.
 * `text-xs`, `border-b`, `outline-none`, `bg-gradient-to-r` and
 * `focus-visible:ring-offset-2` share the prefixes but are not colours and must
 * never be reported.
 */
function isColourCandidate(name: string): boolean {
  if (name.startsWith("[")) return false; // arbitrary value, always fine
  const head = name.split("-")[0];
  if (FAMILIES.has(head)) return true;
  if (KEYWORD_HEADS.has(head)) return false;
  return name.includes("-");
}

/** True when a bare utility of this class would emit CSS. */
export function generatesCss(cls: string): boolean {
  const m = cls.match(
    new RegExp(
      "^(?:[a-z-]+:)*(?:" + COLOR_PREFIX + ")-([a-z][a-z0-9-]*)(?:/[0-9]{1,3})?$",
    ),
  );
  if (!m) return true; // not a colour-shaped utility at all
  const name = m[1];
  if (!isColourCandidate(name)) return true; // size/width/keyword utility
  return THEME_COLORS.has(name) || BUILTIN_COLORS.has(name);
}

/** Every non-generating colour utility in a source file, as `class @ file:line`. */
function deadUtilities(source: string, file: string): string[] {
  const src = stripComments(source);
  const out: string[] = [];
  UTIL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = UTIL_RE.exec(src)) !== null) {
    const [, variant, prefix, name, op] = m;
    if (!isColourCandidate(name)) continue;
    const cls = `${variant}${prefix}-${name}${op ? "/" + op : ""}`;
    if (generatesCss(cls)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    out.push(`${cls} @ ${file}:${line}`);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(resolve(repoRoot, dir))) {
    // `__tests__` is excluded because these guards legitimately QUOTE
    // non-generating class names in their own assertions — the self-check above
    // lists `bg-accent-fill` precisely so the resolver rejects it. Scanning a
    // test for the thing it is testing finds only the test.
    //
    // Note this exclusion was LATENT until the walk was widened to `.ts`:
    // `.tsx` test files happened not to carry these strings, so the narrower
    // walk masked the missing filter rather than proving it unnecessary.
    if (
      ["node_modules", "dist", "dist-web", "Example", "__tests__"].includes(
        entry,
      )
    ) {
      continue;
    }
    const rel = `${dir}/${entry}`;
    if (statSync(resolve(repoRoot, rel)).isDirectory()) walk(rel, out);
    // `.ts` as well as `.tsx`. A colour utility can be built in a plain module
    // and exported as a string — `export const DEAD = "bg-accent-fill"` — and a
    // guard that skipped `.ts` reported green on exactly the shape of C1. The
    // cost of including it is zero today (no `.ts` file under src/ contains
    // `className=`), so there is no reason to keep the narrower walk.
    else if (/\.tsx?$/.test(entry)) out.push(rel);
  }
  return out;
}

describe("token-driven colour utilities actually generate CSS", () => {
  it("reads a non-empty theme and palette", () => {
    // A silently empty set would make every test below vacuously pass.
    expect(THEME_COLORS.size).toBeGreaterThan(40);
    expect(BUILTIN_COLORS.size).toBeGreaterThan(200);
    expect(THEME_COLORS.has("accent-fill")).toBe(false);
    expect(THEME_COLORS.has("accent")).toBe(true);
    expect(THEME_COLORS.has("surface-canvas")).toBe(true);
  });

  it.each([
    // The exact C1 regression: rejected because the name is not in @theme.
    ["bg-accent-fill", false],
    ["text-accent-fill-fg", false],
    ["selection:text-accent-fill-fg", false],
    ["hover:bg-danger-fill-hover", false],
    // The fixes: arbitrary values are passed through.
    ["bg-[var(--color-accent-fill)]", true],
    ["text-[var(--color-accent-fill-fg)]", true],
    ["selection:text-[var(--color-accent-fill-fg)]", true],
    // Theme-declared names.
    ["bg-surface-canvas", true],
    ["text-text-primary", true],
    ["bg-accent-subtle", true],
    ["text-accent", true],
    ["selection:bg-accent", true],
    ["border-accent/40", true],
    ["hover:ring-accent/40", true],
    ["border-border-subtle", true],
    // Built-in palette.
    ["bg-blue-600", true],
    ["text-emerald-800", true],
    ["dark:text-amber-300", true],
    // Not colour utilities: must never be flagged.
    ["text-xs", true],
    ["border-b", true],
    ["outline-none", true],
    ["bg-gradient-to-r", true],
    ["focus-visible:ring-offset-2", true],
  ])("classifies %s as generating=%s", (cls, expected) => {
    expect(generatesCss(cls)).toBe(expected);
  });

  it("has no dead colour utility anywhere in src/", () => {
    const dead: string[] = [];
    for (const rel of walk("src"))
      dead.push(...deadUtilities(readFileSync(resolve(repoRoot, rel), "utf-8"), rel));
    expect(
      dead.length === 0 ? "none" : dead.join("\n"),
      "these bare colour utilities generate NO CSS, because their colour name is " +
        "not a @theme entry nor a Tailwind palette step. Tailwind emits nothing " +
        "for them, so the element silently falls back to an inherited colour. " +
        "Write the arbitrary-value form instead: bg-[var(--color-<name>)].",
    ).toBe("none");
  });
});