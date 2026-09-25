import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  AA_NON_TEXT,
  AA_NORMAL_TEXT,
  WHITE,
  contrastRatio,
} from "./helpers/contrast";

const projectRoot = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const tokensCss = read("styles/tokens.css");
const componentsCss = read("styles/components.css");
const webCss = read("platform/web/index.css");
const desktopCss = read("platform/desktop/index.css");
const platformCss = [webCss, desktopCss];

/**
 * What each platform actually renders: its entry stylesheet plus the shared
 * component layer it @imports. The component classes (.label-xs,
 * .segmented-btn.*, …) moved to styles/components.css in the CSS layer
 * consolidation, so rule-presence assertions must read the effective sheet.
 * Used with it.each so "both platforms" stays a real requirement.
 */
const effectivePlatformCss = [
  `${componentsCss}\n${webCss}`,
  `${componentsCss}\n${desktopCss}`,
];

/* ------------------------------------------------------------------ *
 * WCAG 2.1 relative luminance + contrast ratio now live in
 * ./helpers/contrast, shared with the call-site guard in
 * accentBackgroundContrast.test.ts so the two cannot drift apart.
 *
 * tokenInBlock stays local: it ASSERTS that the block and token exist, which
 * is the right behaviour for a token-level guard. The call-site guard needs
 * the non-asserting variant, because "token absent" is a finding there
 * rather than a test-setup error.
 * ------------------------------------------------------------------ */
function tokenInBlock(css: string, block: string, token: string): string {
  const blockMatch = css.match(new RegExp(`${block}\\s*{([^}]*)}`, "i"));
  expect(blockMatch, `${block} block must exist in tokens.css`).not.toBeNull();
  const declaration = blockMatch![1].match(
    new RegExp(`--${token}\\s*:\\s*(#[0-9a-f]{3,8})\\s*;`, "i"),
  );
  expect(
    declaration,
    `--${token} must be a literal hex colour inside the ${block} block`,
  ).not.toBeNull();
  return declaration![1];
}

describe("--accent-fill solid-background invariant", () => {
  /**
   * The pairing the product ACTUALLY RENDERS, not a colour nobody uses.
   * `.btn-primary` is `background: var(--accent-fill); color: var(--accent-fill-fg)`.
   * The previous guard asserted white-on-fill, which passed at 6.29:1 while the
   * app resolved the text through `--color-accent-text` -> `--text-inverse` and
   * rendered #0a0b10 on that same fill: 3.13:1, a WCAG AA failure the test
   * could not see. --accent-fill-fg exists so the asserted foreground is the
   * one that lands on the pixels.
   */
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])(
    "renders --accent-fill-fg on --accent-fill at AA text contrast in %s (%s mode)",
    (block) => {
      const fill = tokenInBlock(tokensCss, block, "accent-fill");
      const fg = tokenInBlock(tokensCss, block, "accent-fill-fg");
      const ratio = contrastRatio(fg, fill);

      expect(
        ratio,
        `${fg} on --accent-fill ${fill} (${block}) is ${ratio.toFixed(2)}:1 — .btn-primary renders this exact pair and needs >= ${AA_NORMAL_TEXT}:1 for WCAG AA normal text`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  /**
   * The hover/active companion needs its own guard: --accent-fill-hover is a
   * separate token precisely so a fill swap cannot silently inherit
   * --accent-hover, which is #a5b4fc (a foreground-weight colour) in .dark.
   */
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])(
    "renders --accent-fill-fg on --accent-fill-hover at AA text contrast in %s (%s mode)",
    (block) => {
      const fill = tokenInBlock(tokensCss, block, "accent-fill-hover");
      const fg = tokenInBlock(tokensCss, block, "accent-fill-fg");
      const ratio = contrastRatio(fg, fill);

      expect(
        ratio,
        `${fg} on --accent-fill-hover ${fill} (${block}) is ${ratio.toFixed(2)}:1 — .btn-primary:hover renders this exact pair and needs >= ${AA_NORMAL_TEXT}:1 for WCAG AA normal text`,
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    },
  );

  /**
   * WCAG 1.4.11 non-text contrast: the fill is a large filled surface, so it
   * must be distinguishable from the page canvas. This is the assertion that
   * had to hold for BOTH themes independently — the fill does not change
   * between them but the canvas does, so the dark case is the binding one.
   * Hover is deliberately not asserted here: 1.4.11 governs the resting state
   * that identifies the control, and a transient hover is not required to
   * re-establish it.
   */
  it("keeps the fill visible against the canvas in both themes (WCAG 1.4.11)", () => {
    const lightFill = tokenInBlock(tokensCss, ":root", "accent-fill");
    const lightCanvas = tokenInBlock(tokensCss, ":root", "surface-canvas");
    const darkFill = tokenInBlock(tokensCss, ".dark", "accent-fill");
    const darkCanvas = tokenInBlock(tokensCss, ".dark", "surface-canvas");

    for (const [name, fill, canvas] of [
      ["light", lightFill, lightCanvas],
      ["dark", darkFill, darkCanvas],
    ] as const) {
      const ratio = contrastRatio(fill, canvas);
      expect(
        ratio,
        `${fill} against ${name} canvas ${canvas} is ${ratio.toFixed(2)}:1 — a solid button needs >= ${AA_NON_TEXT}:1 to be distinguishable`,
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    }
  });

  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])(
    "keeps --accent-fill distinct from the %s --accent foreground",
    (block) => {
      const fill = tokenInBlock(tokensCss, block, "accent-fill");
      const accent = tokenInBlock(tokensCss, block, "accent");

      // The whole point of the token: --accent is a foreground/border colour and
      // is not dark enough to be a fill in dark mode (2.98:1 with white).
      if (block === ".dark") {
        expect(contrastRatio(WHITE, accent)).toBeLessThan(AA_NORMAL_TEXT);
        expect(fill.toLowerCase()).not.toBe(accent.toLowerCase());
      }
    },
  );

  /**
   * --accent-fill must not be a theme-flipping alias. If it ever becomes
   * `var(--accent)` again, the dark-theme value would be #818cf8 and the
   * rendered text would fall to 2.98:1 — the exact failure this file exists
   * to catch. Asserted as a literal so the alias cannot be reintroduced.
   */
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])("keeps --accent-fill a literal in %s, not a themed alias", (block) => {
    const fill = tokenInBlock(tokensCss, block, "accent-fill");
    expect(fill).toBe("#4f46e5");
  });

  /**
   * B2: the token is only meaningful if something consumes it. Before this
   * guard `--accent-fill` had 13 tests and zero references outside tokens.css.
   */
  it("gives --accent-fill, -fg and -hover a consumer in the component layer", () => {
    for (const token of [
      "--accent-fill",
      "--accent-fill-fg",
      "--accent-fill-hover",
    ]) {
      expect(
        componentsCss,
        `${token} must be consumed by the component layer, not just declared`,
      ).toMatch(new RegExp(`var\\(${token}\\)`));
    }
    // ...and .btn-primary is the consumer, in the resting and hover states.
    const btn = componentsCss.match(/\.btn-primary\s*{([^}]*)}/);
    expect(btn, ".btn-primary must exist").not.toBeNull();
    expect(btn![1]).toMatch(/background:\s*var\(--accent-fill\);/);
    expect(btn![1]).toMatch(/color:\s*var\(--accent-fill-fg\);/);
    const btnHover = componentsCss.match(/\.btn-primary:hover\s*{([^}]*)}/);
    expect(btnHover, ".btn-primary:hover must exist").not.toBeNull();
    expect(btnHover![1]).toMatch(/background:\s*var\(--accent-fill-hover\);/);
  });
});

describe("radius scale has a single source of truth", () => {
  const RADIUS_SCALE = [
    "radius-sm",
    "radius-md",
    "radius-lg",
    "radius-xl",
    "radius-2xl",
  ];

  it("defines the whole radius scale in tokens.css", () => {
    for (const token of RADIUS_SCALE) {
      expect(
        tokensCss,
        `--${token} must be defined in styles/tokens.css`,
      ).toMatch(new RegExp(`--${token}\\s*:\\s*\\d+px;`));
    }
  });

  it("no longer duplicates the radius scale in the platform stylesheets", () => {
    for (const css of [...platformCss, componentsCss]) {
      for (const token of RADIUS_SCALE) {
        expect(
          css,
          `--${token} must not be redeclared outside tokens.css`,
        ).not.toMatch(new RegExp(`--${token}\\s*:`));
      }
    }
  });

  it("aligns --radius-2xl with Tailwind's rounded-2xl (16px)", () => {
    const value = tokensCss.match(/--radius-2xl\s*:\s*(\d+)px/);
    expect(value).not.toBeNull();
    expect(Number(value![1])).toBe(16);
  });
});

describe("tinted fills are token-backed, not inlined rgba()", () => {
  it.each(effectivePlatformCss)(
    "keeps the segmented control states on wash tokens",
    (css) => {
      const block = css.match(/\.segmented-btn\.active-fdm\s*{([^}]*)}/);
      expect(block, ".segmented-btn.active-fdm must exist").not.toBeNull();
      expect(block![1]).not.toMatch(/rgba?\(/i);
      expect(block![1]).toMatch(/background:\s*var\(--info-wash\)/);
      expect(block![1]).toMatch(/border-color:\s*var\(--info-wash-strong\)/);
    },
  );

  /**
   * The wash hues are PINNED, not merely "derived from something semantic".
   *
   * These tints used to be hardcoded `rgba()` literals. Replacing them with
   * `color-mix(… var(--accent) …)` silently re-hued every rendered wash,
   * because the semantic accents are 700/800/light-400 steps while the
   * literals were 600-step. Pinning the exact hues makes that class of
   * drift a test failure instead of a silent visual change.
   */
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])("pins the %s wash hues to the original 600-step values", (block) => {
    for (const [token, expected] of [
      ["accent-wash-hue", "#4f46e5"], //  indigo-600, was rgba(79, 70, 229, …)
      ["info-wash-hue", "#2563eb"], //   blue-600,  was rgba(37, 99, 235, …)
      ["positive-wash-hue", "#059669"], // emerald-600, was rgba(5, 150, 105, …)
      ["warning-wash-hue", "#d97706"], //  amber-600,  was rgba(217, 119, 6, …)
    ] as const) {
      expect(
        tokenInBlock(tokensCss, block, token),
        `--${token} (${block}) must stay at the pre-token hue; the wash tokens are calibrated to it`,
      ).toBe(expected);
    }
  });

  it("derives every wash token from a pinned wash-hue token", () => {
    const sources = [
      ...tokensCss.matchAll(/--\w+-wash(?:-strong)?:\s*color-mix\([^;]+;/g),
    ]
      .map((match) => match[0])
      .filter((decl) => decl.includes("wash"));

    expect(sources.length).toBeGreaterThan(0);
    for (const decl of sources) {
      expect(decl).toMatch(
        /var\(--(accent|positive|warning|info)-wash-hue\) (12|30)%/,
      );
    }
  });

  /**
   * The wash hues are theme-INDEPENDENT. If they were re-derived from the
   * semantic accents they would flip with .dark and re-introduce the drift
   * this block exists to prevent.
   */
  it("keeps the wash hues identical in :root and .dark", () => {
    for (const token of [
      "accent-wash-hue",
      "info-wash-hue",
      "positive-wash-hue",
      "warning-wash-hue",
    ]) {
      expect(
        tokenInBlock(tokensCss, ".dark", token),
        `--${token} must not differ between themes; the hardcoded rgba() it replaced was theme-independent`,
      ).toBe(tokenInBlock(tokensCss, ":root", token));
    }
  });
});

describe("section label letter-spacing", () => {
  it.each(effectivePlatformCss)(
    "uses the prototype classic layout's tracking-wider value",
    (css) => {
      const label = css.match(/\.label-xs\s*{([^}]*)}/);
      expect(label, ".label-xs must exist").not.toBeNull();
      // Source: Example/src/components/EnhancedClassicLayout.tsx — the CLASSIC
      // layout this port targets, which uses `tracking-wider` at 26 label sites
      // and `tracking-widest` zero times. 0.1em came from the BENTO/WIZARD
      // layouts and is the wrong reference for this screen set.
      expect(label![1]).toMatch(/letter-spacing:\s*0\.05em;/);
      expect(label![1]).not.toMatch(/letter-spacing:\s*0\.1em;/);
    },
  );
});

/* ------------------------------------------------------------------ *
 * Structural guards for the CSS errors the pre-push BUILD cannot see.
 *
 * `npm run build:all` was added to .husky/pre-push so a CSS-only refactor
 * proves the stylesheet compiles for both platforms. Measured against nine
 * injected breakages, it catches exactly one — an unclosed brace. It does NOT
 * catch a malformed color-mix(), a misspelled @theme, an invalid @media
 * prelude, an unknown property, or a dropped/misordered @import, because
 * lightningcss passes unknown at-rules through and a custom property's value
 * is an unparsed token stream until a real property consumes it.
 *
 * These two checks close the two highest-value gaps without adding stylelint:
 * a dependency costs more than the whole defect class it would catch, and the
 * file already parses CSS.
 * ------------------------------------------------------------------ */
describe("stylesheets the build cannot reject are well-formed", () => {
  const allCss = [tokensCss, componentsCss, webCss, desktopCss];
  const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

  it("writes every color-mix() in the shape a browser can parse", () => {
    const stripped = allCss.map(stripComments);

    // 1. No near-miss function name. `colour-mix(` is not a colour function, so
    //    the declaration resolves to nothing and is dropped at computed-value
    //    time — no build error, no test failure, just a missing tint.
    for (const css of stripped) {
      const nearMisses = [
        ...new Set([...css.matchAll(/[a-z-]+mix\s*\(/g)].map((m) => m[0])),
      ].filter((name) => name !== "color-mix(");
      expect(
        nearMisses,
        `misspelled colour function(s) — the build passes them through and the browser drops the declaration: ${nearMisses.join(", ")}`,
      ).toEqual([]);
    }

    // 2. Every call spans its nested parens (`var(--x)`) and carries a mix
    //    weight before the first comma. The match is anchored to the `;` that
    //    ends the declaration rather than to the first `)`.
    const calls = stripped.flatMap((css) =>
      [...css.matchAll(/color-mix\([^;{}]*?\)(?=\s*[;}])/g)].map((m) => m[0]),
    );
    expect(
      calls.length,
      "sanity: the wash tokens use color-mix()",
    ).toBeGreaterThan(0);

    // in <colorspace>, <weight>%, <stop>  — the second stop may omit a weight.
    const wellFormed =
      /^color-mix\(\s*in\s+[a-z]+\s*,\s*[^,]*?\d*\.?\d*%\s*,\s*[^,]+\)$/;

    for (const call of calls) {
      expect(
        call,
        `malformed color-mix() — the build passes it through and the browser silently drops the declaration: ${call}`,
      ).toMatch(wellFormed);
    }
  });

  it("uses only known at-rules, so a misspelled @theme/@media cannot pass", () => {
    const KNOWN = new Set([
      "charset",
      "import",
      "media",
      "supports",
      "layer",
      "container",
      "keyframes",
      "font-face",
      "property",
      "page",
      "scope",
      // Tailwind v4
      "theme",
      "tailwind",
      "apply",
      "source",
      "plugin",
      "variant",
      "custom-variant",
      "utility",
      "reference",
      "config",
    ]);

    for (const css of allCss) {
      // At-rules only appear before `{` or after `;`; a bare `@` inside a url()
      // or an email is not an at-rule.
      const found = [
        ...stripComments(css).matchAll(/@([a-zA-Z-]+)\s*[{;]/g),
      ].map((m) => m[1].toLowerCase());
      const unknown = [...new Set(found)].filter((name) => !KNOWN.has(name));
      expect(
        unknown,
        `unknown at-rule(s) — the build passes these through as-is: ${unknown.join(", ")}`,
      ).toEqual([]);
    }
  });
});
