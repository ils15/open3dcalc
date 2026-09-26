/**
 * WCAG 2.1 contrast maths, in one place.
 *
 * Extracted from tokens.test.ts (which had these as file-local functions) so
 * that the token-level guard and the call-site guard
 * (accentBackgroundContrast.test.ts) cannot drift apart. If the two files each
 * carried their own copy, a future fix to the sRGB transfer function would
 * silently apply to one guard and not the other.
 *
 * Verified against published reference pairs: #767676/#FFFFFF = 4.54,
 * #0000FF/#FFFFFF = 8.59, #FFFFFF/#000000 = 21.0.
 */

export const WHITE = "#FFFFFF";
export const AA_NORMAL_TEXT = 4.5;
export const AA_NON_TEXT = 3;

export function relativeLuminance(hex: string): number {
  const raw = hex.replace("#", "").trim();
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Reads a single declaration out of one named top-level block.
 * `[^}]*` mirrors the guard style used by layoutShell.test.ts.
 *
 * Returns null instead of asserting, so callers can distinguish "token is
 * absent" from "token has a bad value" — the call-site guard needs the former.
 */
export function tokenInBlock(
  css: string,
  block: string,
  token: string,
): string | null {
  const blockMatch = css.match(new RegExp(`${block}\\s*{([^}]*)}`, "i"));
  if (!blockMatch) return null;
  const declaration = blockMatch[1].match(
    new RegExp(`--${token}\\s*:\\s*(#[0-9a-f]{3,8})\\s*;`, "i"),
  );
  return declaration ? declaration[1] : null;
}

/**
 * The RAW right-hand side of a declaration, so `var(--x)` aliases survive.
 * `--color-accent: var(--accent)` is how the shipped tokens are wired, and a
 * resolver that only accepted literal hex would report every call site as
 * unresolvable instead of measuring it.
 */
export function tokenValueInBlock(
  css: string,
  block: string,
  token: string,
): string | null {
  const blockMatch = css.match(new RegExp(`${block}\\s*{([^}]*)}`, "i"));
  if (!blockMatch) return null;
  const declaration = blockMatch[1].match(
    new RegExp(`--${token}\\s*:\\s*([^;]+);`, "i"),
  );
  return declaration ? declaration[1].trim() : null;
}

/**
 * tokens.css is not a single pair of blocks. It has THREE top-level blocks in
 * document order:
 *
 *   :root   (line ~7)    the base palette: --accent, --accent-fill, --text-*
 *   .dark   (line ~126)  per-theme overrides of those same names
 *   :root   (line ~221)  a compatibility alias layer, --color-* -> base names
 *
 * `--color-accent: var(--accent)` therefore lives in the SECOND :root, and
 * `--color-primary: var(--color-accent)` is a two-hop alias. A resolver that
 * reads only the first `:root` reports every `--color-*` call site as
 * unresolvable, which reads as "no failures" and is worse than useless.
 *
 * The map is built in document order with later blocks winning, which is also
 * the real cascade: `.dark` and the alias `:root` both follow the base. For
 * light theme the `.dark` block is simply not applied.
 */
export type ThemeName = "light" | "dark";

function topLevelBlocks(css: string): { selector: string; body: string }[] {
  // Comments MUST be stripped before the scan. `[^{}]*` will happily match a
  // `/* ... */` comment and treat it as the selector of the block that follows
  // it, which swallows the `.dark` block and leaves the token map holding only
  // the base palette — every `--color-*` alias then resolves to null and the
  // call-site guard reports "no failures" while measuring nothing.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: { selector: string; body: string }[] = [];
  const re = /([^{}]*)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    out.push({ selector: m[1].trim(), body: m[2] });
  }
  return out;
}

/** `--name: value;` pairs in one block body, in source order. */
function declarationsIn(body: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    out.push([m[1], m[2].trim()]);
  }
  return out;
}

/** Raw (unresolved) value per token for one theme, cascade applied. */
export function themeTokenMap(
  css: string,
  theme: ThemeName,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const { selector, body } of topLevelBlocks(css)) {
    // @theme inline is Tailwind's build-time mapping, not a runtime cascade.
    if (selector.startsWith("@theme")) continue;
    const applies = selector.startsWith(".dark")
      ? theme === "dark"
      : selector.startsWith(":root");
    if (!applies) continue;
    for (const [name, value] of declarationsIn(body)) map.set(name, value);
  }
  return map;
}

/**
 * Resolves a token to a literal hex in one theme, following `var()` aliases
 * (depth-bounded so a cyclic alias cannot hang the suite). Returns null when
 * the token is undeclared or resolves to something that is not one colour
 * (color-mix(), a gradient) — which is how an undefined token like --color-bg
 * is detected.
 */
export function resolveTokenHex(
  css: string,
  theme: ThemeName,
  token: string,
  depth = 0,
): string | null {
  if (depth > 8) return null;
  const raw = themeTokenMap(css, theme).get(
    token.startsWith("--") ? token : `--${token}`,
  );
  if (raw === undefined) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  const alias = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (alias) return resolveTokenHex(css, theme, alias[1], depth + 1);
  return null;
}

/** `color-mix(...)`, gradients and friends are not resolvable to one hex. */
export function isUnresolvableValue(raw: string | null): boolean {
  return raw !== null && !/^#[0-9a-f]{3,8}$/i.test(raw) && !/^var\(/i.test(raw);
}

/**
 * A colour as LAYERS: an sRGB hex plus the alpha it is painted at. Resolves the
 * three shapes the token layer actually uses —
 *
 *   --x: #4f46e5                                -> { hex, alpha: 1 }
 *   --color-accent: var(--accent)               -> follows the alias
 *   --accent-wash: color-mix(in srgb,
 *       var(--accent-wash-hue) 12%, transparent) -> { hex: <hue>, alpha: 0.12 }
 *
 * The third shape is why this exists. `resolveTokenHex()` returns null for a
 * translucent wash by design, because a 12% wash has no single colour — but
 * that null is indistinguishable from the undefined-token null, so a guard
 * cannot tell "this token is a wash" from "--color-bg does not exist". The two
 * are different findings and need different handling, so washes resolve to
 * layers here and are composited by `compositeOver()`.
 *
 * Returns null for anything else, so an unresolvable value still reads as a
 * finding at the call site rather than silently passing.
 */
export function resolveTokenLayers(
  css: string,
  theme: ThemeName,
  token: string,
  depth = 0,
): { hex: string; alpha: number } | null {
  if (depth > 8) return null;
  const raw = themeTokenMap(css, theme).get(
    token.startsWith("--") ? token : `--${token}`,
  );
  if (raw === undefined) return null;
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return { hex: raw, alpha: 1 };

  const alias = raw.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (alias) return resolveTokenLayers(css, theme, alias[1], depth + 1);

  const mix = raw.match(
    /^color-mix\(\s*in\s+srgb\s*,\s*var\(\s*(--[a-z0-9-]+)\s*\)\s*([\d.]+)%\s*,\s*transparent\s*\)$/i,
  );
  if (mix) {
    const inner = resolveTokenLayers(css, theme, mix[1], depth + 1);
    if (!inner) return null;
    return { hex: inner.hex, alpha: (parseFloat(mix[2]) / 100) * inner.alpha };
  }
  return null;
}

/** `rgba()` string for a hex at a given alpha. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Source-over composite of a layered colour onto an opaque backdrop. */
export function compositeOver(
  layers: { hex: string; alpha: number },
  backdrop: string,
): string {
  const parse = (hex: string): [number, number, number] => {
    const h = hex.replace("#", "");
    const full =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [
      number,
      number,
      number,
    ];
  };
  const [r, g, b] = parse(layers.hex);
  const [br, bg, bb] = parse(backdrop);
  const a = layers.alpha;
  return (
    "#" +
    [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a)]
      .map((v) => Math.round(v).toString(16).padStart(2, "0"))
      .join("")
  );
}

/* ------------------------------------------------------------------ *
 * Tailwind v4 palette: oklch() -> sRGB hex
 *
 * Written because the deferred-population census has to decide whether a
 * `bg-red-600` pairing FAILS, not merely that a `bg-red-600` exists. Without a
 * decoder the palette family can only be counted, and a count cannot tell a
 * broken pairing from a fine one — so the floor would end up pinning the wrong
 * number for the right reason.
 *
 * The alternative — not decoding — is what left this family unmeasured in the
 * first place, and the cost of that is concrete rather than theoretical: the
 * census below measures `bg-red-600` behind `text-[var(--color-danger)]` at
 * 1.36:1, which is red text on a red button.
 * ------------------------------------------------------------------ */

/**
 * OKLCH -> sRGB hex.
 *
 * `L` is 0..1 (callers divide Tailwind's percentage by 100), `C` is 0..~0.4,
 * `hue` is degrees. Goes through OKLab, which is the space OKLCH is defined in,
 * so this is a conversion rather than an approximation.
 */
export function oklchToHex(L: number, C: number, hue: number): string {
  const h = (hue * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const [l, m, s] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const linear: [number, number, number] = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return (
    "#" +
    linear
      .map((v) => {
        const channel =
          v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        return Math.round(Math.min(1, Math.max(0, channel)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}

/**
 * `--color-<name>` -> sRGB hex, from a Tailwind theme.css.
 *
 * Keys are the utility suffixes (`red-600`), which is the form call sites write.
 * Steps written as literal hex or `color-mix()` are skipped rather than guessed:
 * a missing entry must read as "not measured", never as "measured and fine".
 */
export function tailwindPaletteMap(themeCss: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of themeCss.matchAll(
    /--color-([a-z]+-\d{2,3}):\s*oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)/g,
  )) {
    out.set(m[1], oklchToHex(+m[2] / 100, +m[3], +m[4]));
  }
  return out;
}

/**
 * Two conversions that are independently documented in tokens.css, and which
 * this module must reproduce or every palette number derived from it is noise.
 *
 * tokens.css records that `--danger-fill: #e7000b` is "the sRGB rendering of
 * Tailwind v4's oklch palette: red-600 = oklch(0.577 0.245 27.325) -> #e7000b"
 * and the same for amber-600 -> #e17100. Those are the only two values in the
 * repo whose palette provenance is written down, so they are the only two this
 * can be checked against — and a decoder that silently drifts from Tailwind
 * would understate every ratio it feeds.
 */
export const PALETTE_SELF_CHECK: ReadonlyArray<readonly [string, string]> = [
  ["red-600", "#e7000b"],
  ["amber-600", "#e17100"],
];
