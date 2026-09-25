import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import {
  AA_NORMAL_TEXT,
  contrastRatio,
  resolveTokenHex,
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
 *    here. Five such call sites are known to fail and are deliberately
 *    unfixed pending a design decision; this test will not flag them.
 *  - It cannot see a background or a text colour that arrives from a CSS
 *    class in styles/components.css rather than a utility in a literal.
 *  - Variant-prefixed utilities (`hover:`, `focus:`, `dark:`, `active:`) are
 *    stripped before matching, so `hover:bg-[var(--color-accent-hover)]` is
 *    measured as a real resting-state pairing. That is stricter than the
 *    rendered reality and is intentional.
 *
 * In short: this catches the regression it was written for — someone typing
 * `bg-[var(--color-accent)] text-white` or `... text-[var(--color-text-primary)]`
 * again — and it is not a WCAG conformance proof for the app.
 */

const projectRoot = resolve(__dirname, "../..", "..");
const srcRoot = resolve(projectRoot, "src");
const tokensCss = readFileSync(resolve(srcRoot, "styles/tokens.css"), "utf-8");

const THEMES = [{ name: "light" }, { name: "dark" }] as const;

/**
 * Background tokens derived from the accent hue. The list is exhaustive on
 * purpose: it spans the FOREGROUND/border tokens (--color-accent,
 * --color-primary, --accent and their -hover companions) AND the fill tokens
 * (--accent-fill, --accent-fill-hover). An unlisted accent token is skipped
 * SILENTLY, which is the main way this guard could go quiet — which is why
 * `finds the accent-background call sites it is meant to police` pins a floor
 * on the discovered population instead of trusting the regex.
 *
 * Both families are policed because both have shipped broken: the foreground
 * family put white on #818cf8 (2.98:1), and the fill family was declared but
 * had no consumers at all until this branch adopted it at the call sites.
 *
 * Names are matched WITHOUT the leading `--`, which is the form
 * resolveTokenHex() expects (it re-adds it when reading the declaration).
 */
const BG_TOKEN =
  /^(color-accent|color-primary|accent|color-accent-hover|accent-hover|accent-fill|accent-fill-hover)$/;

/** Text tokens that are legal in a class string, resolved per theme. */
const TEXT_TOKEN =
  /^(color-text-primary|text-primary|color-text-inverse|text-inverse|color-accent-text|accent-fill-fg|color-accent|accent|color-text-secondary|text-secondary|color-text-muted)$/;

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
});
