import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
 * WCAG 2.1 relative luminance + contrast ratio.
 * Verified against published reference pairs: #767676/#FFFFFF = 4.54,
 * #0000FF/#FFFFFF = 8.59, #FFFFFF/#000000 = 21.0.
 * ------------------------------------------------------------------ */
function relativeLuminance(hex: string): number {
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

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Reads a single declaration out of one named top-level block.
 * `[^}]*` mirrors the guard style used by layoutShell.test.ts.
 */
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

const WHITE = "#FFFFFF";
const AA_NORMAL_TEXT = 4.5;

describe("--accent-fill solid-background invariant", () => {
  it.each([
    [":root", "light"],
    [".dark", "dark"],
  ])("keeps white text readable on --accent-fill in %s (%s mode)", (block) => {
    const fill = tokenInBlock(tokensCss, block, "accent-fill");
    const ratio = contrastRatio(WHITE, fill);

    expect(
      ratio,
      `white on ${fill} (${block}) is ${ratio.toFixed(2)}:1 — needs >= ${AA_NORMAL_TEXT}:1 for WCAG AA normal text`,
    ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
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
        `${fill} against ${name} canvas ${canvas} is ${ratio.toFixed(2)}:1 — a solid button needs >= 3:1 to be distinguishable`,
      ).toBeGreaterThanOrEqual(3);
    }
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

  it("derives every wash token from an existing semantic hue (no new hues)", () => {
    const sources = [
      ...tokensCss.matchAll(/--\w+-wash(?:-strong)?:\s*color-mix\([^;]+;/g),
    ]
      .map((match) => match[0])
      .filter((decl) => decl.includes("wash"));

    expect(sources.length).toBeGreaterThan(0);
    for (const decl of sources) {
      expect(decl).toMatch(/var\(--(accent|positive|warning|info)\)/);
    }
  });
});

describe("section label letter-spacing", () => {
  it.each(effectivePlatformCss)(
    "uses the prototype's tracking-widest value",
    (css) => {
      const label = css.match(/\.label-xs\s*{([^}]*)}/);
      expect(label, ".label-xs must exist").not.toBeNull();
      expect(label![1]).toMatch(/letter-spacing:\s*0\.1em;/);
      expect(label![1]).not.toMatch(/letter-spacing:\s*0\.08em;/);
    },
  );
});
