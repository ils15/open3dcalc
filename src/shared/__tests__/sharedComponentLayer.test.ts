import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Neutrality guard for the shared component class layer.
 *
 * The web and desktop entry stylesheets used to carry a byte-identical copy of
 * every component class (.card, .label-xs, .btn-primary, .badge, .toggle-*, …).
 * They now import one shared file instead, so a visual change is made once.
 *
 * A CSS refactor fails silently: moving a rule changes cascade order, cascade
 * order changes computed styles, and no unit test notices. So this file PINS
 * the effective declaration body of every shared selector, taken from the
 * EFFECTIVE stylesheet (shared + platform). The pinned values were recorded
 * from the pre-consolidation state; the table passing unchanged afterwards is
 * the proof that the extraction was neutral.
 */

const projectRoot = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const sharedCssPath = "styles/components.css";
const webCssPath = "platform/web/index.css";
const desktopCssPath = "platform/desktop/index.css";

const sharedCss = existsSync(resolve(projectRoot, sharedCssPath))
  ? read(sharedCssPath)
  : "";
const webCss = read(webCssPath);
const desktopCss = read(desktopCssPath);

/* -------------------------------------------------------------------------- */
/* Minimal CSS rule reader (text-based, matching the layoutShell.test.ts style) */
/* -------------------------------------------------------------------------- */

/** Strips comments and normalises whitespace so bodies compare structurally. */
const normalize = (raw: string): string =>
  raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "; ")
    .trim()
    .replace(/;$/, "");

/**
 * Flattens a stylesheet into `[selector, body]` pairs in source order. Recurses
 * into @media / @supports / @layer and records @keyframes / @theme as units, so
 * `select` and `@media print select` never collide.
 */
const readRules = (css: string): Array<[string, string]> => {
  const out: Array<[string, string]> = [];
  // `@import`/`@charset` are statements, not rules, and they cannot contain a
  // brace. Comments MUST be stripped first: prose in a comment may mention
  // "@import." and a naive statement strip would then swallow real CSS from
  // that word up to the next semicolon.
  const source = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/@(?:import|charset)\b[^;]*;/g, "");
  let i = 0;
  while (i < source.length) {
    const braceStart = source.indexOf("{", i);
    if (braceStart === -1) break;
    const prelude = normalize(source.slice(i, braceStart));
    let depth = 1;
    let j = braceStart + 1;
    while (j < source.length && depth > 0) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      j++;
    }
    const body = source.slice(braceStart + 1, j - 1);

    if (/^@(media|supports|container|layer)\b/.test(prelude)) {
      out.push(
        ...readRules(body).map(([sel, b]): [string, string] => [
          `${prelude} ${sel}`,
          b,
        ]),
      );
    } else if (/^@keyframes\s/.test(prelude)) {
      out.push([
        `@keyframes ${prelude.slice("@keyframes".length).trim()}`,
        normalize(body),
      ]);
    } else if (/^@theme\b/.test(prelude)) {
      out.push([
        `@theme ${prelude.slice("@theme".length).trim()}`.trim(),
        normalize(body),
      ]);
    } else if (!/^@tailwind\b/.test(prelude)) {
      out.push([prelude, normalize(body)]);
    }
    i = j;
  }
  return out;
};

/** Effective rule set for a platform: shared layer first, then the platform's own. */
const effectiveRules = (platformCss: string): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  for (const [selector, body] of [
    ...readRules(sharedCss),
    ...readRules(platformCss),
  ]) {
    const list = map.get(selector) ?? [];
    list.push(body);
    map.set(selector, list);
  }
  return map;
};

const webRules = effectiveRules(webCss);
const desktopRules = effectiveRules(desktopCss);

/* -------------------------------------------------------------------------- */
/* The pinned baseline — recorded from the pre-consolidation stylesheets.      */
/* -------------------------------------------------------------------------- */

const PINNED_SHARED_LAYER: ReadonlyArray<readonly [string, string]> = [
  ["@theme inline", "--container-form: 38rem"],
  [
    "body",
    "font-family: var(--font-sans); font-size: var(--type-body-size); line-height: var(--type-body-line-height); background-color: var(--color-bg-primary); color: var(--color-text-primary); min-height: 100dvh; overflow-x: clip; transition: background-color 0.2s ease, color 0.2s ease",
  ],
  ["::-webkit-scrollbar", "width: 4px; height: 4px"],
  ["::-webkit-scrollbar-track", "background: transparent"],
  [
    "::-webkit-scrollbar-thumb",
    "background: var(--color-border); border-radius: 9999px",
  ],
  ["::-webkit-scrollbar-thumb:hover", "background: var(--color-text-muted)"],
  [
    ".surface",
    "background: var(--color-bg-surface); border: 1px solid var(--color-border); box-shadow: var(--shadow-xs)",
  ],
  [
    ".surface-elevated",
    "background: var(--color-bg-elevated); border: 1px solid var(--color-border); box-shadow: var(--shadow-sm)",
  ],
  [
    ".card",
    "background: var(--color-bg-surface); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 16px",
  ],
  [".card-hover", "transition: border-color 0.18s ease"],
  [".card-hover:hover", "border-color: var(--color-accent)"],
  [
    ".gradient-text",
    "color: var(--color-accent); font-weight: 800; background: none; -webkit-text-fill-color: var(--color-accent)",
  ],
  [
    ".gradient-text-brand",
    "color: var(--color-accent); font-weight: 800; background: none; -webkit-text-fill-color: var(--color-accent)",
  ],
  [
    ".label-xs",
    "font-size: var(--type-micro-label-size); line-height: var(--type-micro-label-line-height); font-weight: var(--type-micro-label-weight); letter-spacing: 0.1em; text-transform: uppercase; color: var(--color-text-muted)",
  ],
  [
    ".btn-primary",
    "background: var(--color-accent); color: var(--color-accent-text); border: 1px solid transparent; border-radius: var(--radius-md); padding: 10px 20px; font-weight: 600; font-size: 0.875rem; transition: background 0.15s ease, transform 0.1s ease; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px",
  ],
  [".btn-primary:hover", "background: var(--color-accent-hover)"],
  [".btn-primary:active", "transform: scale(0.98)"],
  [
    ".nav-item",
    "display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-md); font-size: 0.9375rem; font-weight: 500; color: var(--color-text-muted); cursor: pointer; transition: background 0.15s ease, color 0.15s ease; border: 1px solid transparent; white-space: nowrap",
  ],
  [
    ".nav-item:hover",
    "background: var(--color-bg-hover); color: var(--color-text-secondary)",
  ],
  [
    ".nav-item.active",
    "background: var(--color-accent-muted); border-color: transparent; color: var(--color-accent-light)",
  ],
  [".nav-item.active svg", "color: var(--color-accent)"],
  [
    ".segmented-control",
    "background: var(--color-bg-secondary); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 4px; display: flex; gap: 4px",
  ],
  [
    ".segmented-btn",
    "flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 20px; border-radius: var(--radius-md); font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s ease; border: 1px solid transparent; color: var(--color-text-muted)",
  ],
  [".segmented-btn:hover", "color: var(--color-text-secondary)"],
  [
    ".segmented-btn.active-fdm",
    "background: var(--info-wash); border-color: var(--info-wash-strong); color: var(--color-info)",
  ],
  [
    ".segmented-btn.active-resin",
    "background: var(--accent-wash); border-color: var(--accent-wash-strong); color: var(--color-accent)",
  ],
  [
    ".segmented-btn.active-basic",
    "background: var(--positive-wash); border-color: var(--positive-wash-strong); color: var(--color-success)",
  ],
  [
    ".segmented-btn.active-intermediate",
    "background: var(--warning-wash); border-color: var(--warning-wash-strong); color: var(--color-warning)",
  ],
  [
    ".segmented-btn.active-advanced",
    "background: var(--accent-wash); border-color: var(--accent-wash-strong); color: var(--color-accent)",
  ],
  [
    ".result-hero",
    "background: var(--color-success-muted); border: 1px solid var(--color-success); border-radius: var(--radius-lg); padding: 24px",
  ],
  [
    ".badge",
    "display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase",
  ],
  [
    ".badge-indigo",
    "background: var(--color-accent-muted); color: var(--color-accent-light); border: 1px solid var(--color-accent)",
  ],
  [
    ".badge-violet",
    "background: var(--color-violet-muted); color: var(--color-violet); border: 1px solid var(--color-violet)",
  ],
  [
    ".badge-emerald",
    "background: var(--color-success-muted); color: var(--color-success); border: 1px solid var(--color-success)",
  ],
  [
    ".badge-sky",
    "background: var(--color-info-muted); color: var(--color-info); border: 1px solid var(--color-info)",
  ],
  [
    ".badge-amber",
    "background: var(--color-warning-muted); color: var(--color-warning); border: 1px solid var(--color-warning)",
  ],
  [
    ".badge-red",
    "background: var(--color-danger-muted); color: var(--color-danger); border: 1px solid var(--color-danger)",
  ],
  [
    ".toggle-track",
    "position: relative; width: 44px; height: 24px; border-radius: 9999px; cursor: pointer; transition: background 0.25s ease; border: 1px solid var(--color-border)",
  ],
  [".toggle-track.on", "background: var(--color-accent)"],
  [".toggle-track.off", "background: var(--color-bg-secondary)"],
  [
    ".toggle-thumb",
    "position: absolute; top: 2px; width: 18px; height: 18px; border-radius: 9999px; background: white; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3); transition: left 0.22s cubic-bezier(0.4, 0, 0.2, 1), width 0.15s ease",
  ],
  [".toggle-track.on .toggle-thumb", "left: 22px"],
  [".toggle-track.off .toggle-thumb", "left: 2px"],
  [".divider", "height: 1px; background: var(--color-border); margin: 0"],
  [
    ".input-primary .input-group-label",
    "color: var(--color-text-primary); font-weight: 700; font-size: 0.8125rem",
  ],
  [".input-primary input", "border-color: var(--color-accent)"],
  [
    ".input-secondary .input-group-label",
    "color: var(--color-text-secondary); font-size: 0.75rem",
  ],
  [".input-compact input", "padding: 6px 10px; font-size: 0.8125rem"],
  [
    "@keyframes fadeUp",
    "from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); }",
  ],
  [
    "@keyframes scaleIn",
    "from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); }",
  ],
  [
    "@keyframes slideInLeft",
    "from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); }",
  ],
  [
    "@keyframes shimmer",
    "from { background-position: -200% 0; } to { background-position: 200% 0; }",
  ],
  [".animate-fade-up", "animation: fadeUp 0.25s ease-out"],
  [".animate-fade-in", "animation: fadeUp 0.25s ease-out"],
  [".animate-scale-in", "animation: scaleIn 0.2s ease-out"],
  [".animate-slide-left", "animation: slideInLeft 0.2s ease-out"],
  [
    ".animate-shimmer",
    "background: linear-gradient( 90deg, var(--color-bg-hover) 25%, var(--color-bg-secondary) 50%, var(--color-bg-hover) 75% ); background-size: 200% 100%; animation: shimmer 1.5s infinite",
  ],
  [
    "@keyframes wizardStepEnter",
    "from { opacity: 0; transform: translateX(var(--wizard-enter-from, 8px)); } to { opacity: 1; transform: translateX(0); }",
  ],
  [
    ".wizard-step-enter",
    "--wizard-enter-from: 8px; animation: wizardStepEnter 0.22s ease-out",
  ],
  [
    "@media (prefers-reduced-motion: reduce) *, *::before, *::after",
    "animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important",
  ],
  [
    "@media (prefers-reduced-motion: reduce) .animate-fade-up, .animate-fade-in, .animate-scale-in, .animate-slide-left, .wizard-step-enter, .animate-shimmer",
    "animation: none !important",
  ],
  [
    "@media print body",
    "background: white !important; color: black !important",
  ],
  [
    "@media print .surface, .surface-elevated",
    "background: white !important; backdrop-filter: none !important; border: 1px solid #ddd !important; box-shadow: none !important",
  ],
  [
    "@media print header, nav, .fixed, footer, button, .animate-fade-up",
    "display: none !important",
  ],
  ["@media print main", "padding: 0 !important; max-width: 100% !important"],
  [
    "@media print .gradient-text",
    "color: black !important; -webkit-text-fill-color: black !important",
  ],
  [
    "@media print .result-hero",
    "border: 2px solid #059669 !important; break-inside: avoid",
  ],
  [
    "*",
    "scrollbar-width: thin; scrollbar-color: var(--color-border) transparent",
  ],
];

/* -------------------------------------------------------------------------- */

describe("shared component class layer", () => {
  it("has a non-empty shared stylesheet that both platforms import", () => {
    expect(
      sharedCss,
      `${sharedCssPath} must exist — it is the single source of the component class layer`,
    ).not.toBe("");
    for (const [platform, css] of [
      ["web", webCss],
      ["desktop", desktopCss],
    ] as const) {
      expect(
        css,
        `${platform} entry stylesheet must import the shared component layer`,
      ).toMatch(/@import\s+"\.\.\/\.\.\/styles\/components\.css";/);
    }
  });

  it("imports the shared layer after tailwind so unlayered rules still win", () => {
    for (const [platform, css] of [
      ["web", webCss],
      ["desktop", desktopCss],
    ] as const) {
      // Compare LINE numbers in one coordinate space. Comments may legally
      // precede @import, so they are stripped before locating anything.
      const lines = css
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n")
        .map((l) => l.trim());
      const lineOf = (needle: string) => {
        const i = lines.findIndex((l) => l === needle);
        expect(i, `${platform}: ${needle} not found`).toBeGreaterThanOrEqual(0);
        return i;
      };
      // First line that is a style rule rather than a statement or blank.
      const firstRule = lines.findIndex(
        (l) =>
          l !== "" && !l.startsWith("@import") && !l.startsWith("@charset"),
      );

      const tailwindAt = lineOf('@import "tailwindcss";');
      const sharedAt = lineOf('@import "../../styles/components.css";');

      expect(
        sharedAt,
        `${platform}: shared layer must load after tailwind so its unlayered rules outrank @layer utilities`,
      ).toBeGreaterThan(tailwindAt);
      expect(
        sharedAt,
        `${platform}: @import must come before the first style rule`,
      ).toBeLessThan(firstRule);
    }
  });

  it.each([
    ["web", webRules],
    ["desktop", desktopRules],
  ])(
    "%s resolves every shared selector to the pinned declaration body",
    (platform, rules) => {
      const mismatches: string[] = [];
      for (const [selector, expected] of PINNED_SHARED_LAYER) {
        const bodies = rules.get(selector);
        if (!bodies) {
          mismatches.push(`${selector} — MISSING`);
          continue;
        }
        if (bodies.length !== 1) {
          mismatches.push(
            `${selector} — declared ${bodies.length}× (must be exactly one source): ${bodies.join(" || ")}`,
          );
          continue;
        }
        if (bodies[0] !== expected) {
          mismatches.push(
            `${selector}\n  expected: ${expected}\n  actual:   ${bodies[0]}`,
          );
        }
      }
      expect(
        mismatches,
        `${platform}: shared component layer drifted from the pinned baseline`,
      ).toEqual([]);
    },
  );

  it("declares each shared selector exactly once across the whole cascade", () => {
    // A selector declared in both the shared file and a platform file is the
    // exact drift trap this consolidation exists to prevent.
    const sharedSelectors = new Set(
      readRules(sharedCss).map(([selector]) => selector),
    );
    expect(sharedSelectors.size).toBeGreaterThan(0);

    for (const [platform, css] of [
      ["web", webCss],
      ["desktop", desktopCss],
    ] as const) {
      const redeclared = readRules(css)
        .map(([selector]) => selector)
        .filter((selector) => sharedSelectors.has(selector));
      expect(
        redeclared,
        `${platform} re-declares selectors owned by the shared layer: ${redeclared.join(", ")}`,
      ).toEqual([]);
    }
  });

  it("keeps web and desktop effective declarations identical for the shared layer", () => {
    const webBodies = PINNED_SHARED_LAYER.map(
      ([s]) => `${s} => ${webRules.get(s)?.join(" || ")}`,
    );
    const desktopBodies = PINNED_SHARED_LAYER.map(
      ([s]) => `${s} => ${desktopRules.get(s)?.join(" || ")}`,
    );
    expect(webBodies).toEqual(desktopBodies);
  });

  it("preserves the shared layer's internal cascade order", () => {
    const order = readRules(sharedCss).map(([selector]) => selector);
    const at = (selector: string) => order.indexOf(selector);

    // .card redefines `background`/`border`; it must win over .surface on an
    // element carrying both, exactly as it did when both lived in one file.
    expect(at(".surface")).toBeGreaterThanOrEqual(0);
    expect(at(".card")).toBeGreaterThan(at(".surface"));

    // Badge variants layer on top of the shared .badge base.
    expect(at(".badge")).toBeGreaterThanOrEqual(0);
    for (const variant of [
      ".badge-indigo",
      ".badge-violet",
      ".badge-emerald",
      ".badge-sky",
      ".badge-amber",
      ".badge-red",
    ]) {
      expect(at(variant), `${variant} must follow .badge`).toBeGreaterThan(
        at(".badge"),
      );
    }

    // Toggle state rules must follow the base track/thumb they modify.
    for (const state of [".toggle-track.on", ".toggle-track.off"]) {
      expect(at(state)).toBeGreaterThan(at(".toggle-track"));
    }
    for (const state of [
      ".toggle-track.on .toggle-thumb",
      ".toggle-track.off .toggle-thumb",
    ]) {
      expect(at(state)).toBeGreaterThan(at(".toggle-thumb"));
    }

    // Reduced-motion and print overrides come after the animations they kill.
    const reducedMotion = at(
      "@media (prefers-reduced-motion: reduce) .animate-fade-up, .animate-fade-in, .animate-scale-in, .animate-slide-left, .wizard-step-enter, .animate-shimmer",
    );
    expect(reducedMotion).toBeGreaterThan(at(".animate-shimmer"));
    expect(at("@media print .result-hero")).toBeGreaterThan(at(".result-hero"));
  });
});

/* -------------------------------------------------------------------------- */
/* The platform split — rules that legitimately differ and must NOT be merged. */
/* -------------------------------------------------------------------------- */

describe("platform-specific rules stay in their platform", () => {
  it("keeps the skip link on web only", () => {
    expect(webRules.get(".skip-link")).toHaveLength(1);
    expect(desktopRules.get(".skip-link")).toBeUndefined();
  });

  it("keeps .surface-secondary on desktop only", () => {
    expect(desktopRules.get(".surface-secondary")).toEqual([
      "background: var(--color-bg-secondary); border: 1px solid var(--color-border-subtle)",
    ]);
    expect(webRules.get(".surface-secondary")).toBeUndefined();
  });

  it("keeps the form-element padding difference platform-specific", () => {
    // desktop pads native form controls; web relies on component classes.
    expect(webRules.get("input, select, textarea")).toEqual([
      "font-family: var(--font-sans); font-size: 1rem; color: var(--color-text-primary); background: var(--color-bg-input); border: 1px solid var(--color-border); border-radius: var(--radius-md); transition: border-color 0.15s ease, box-shadow 0.15s ease",
    ]);
    expect(desktopRules.get("input, select, textarea")).toEqual([
      "font-family: var(--font-sans); font-size: 1rem; color: var(--color-text-primary); background: var(--color-bg-input); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 10px 14px; transition: border-color 0.15s ease, box-shadow 0.15s ease",
    ]);
  });

  it("keeps the select arrow padding AFTER the form-element base rule", () => {
    // Both are specificity (0,0,1), so source order decides. desktop's
    // `padding: 10px 14px` shorthand must NOT come after `padding-right: 36px`,
    // or the custom select arrow loses its gutter.
    for (const [platform, rules] of [
      ["web", readRules(webCss)],
      ["desktop", readRules(desktopCss)],
    ] as const) {
      const baseAt = rules.findIndex(([s]) => s === "input, select, textarea");
      const selectAt = rules.findIndex(([s]) => s === "select");
      expect(
        baseAt,
        `${platform}: form-element base rule missing`,
      ).toBeGreaterThanOrEqual(0);
      expect(selectAt, `${platform}: select rule missing`).toBeGreaterThan(
        baseAt,
      );
      expect(rules[selectAt][1], `${platform}: select arrow gutter`).toContain(
        "padding-right: 36px",
      );
      expect(
        rules[selectAt][1],
        `${platform}: select must reset appearance`,
      ).toContain("appearance: none");
    }
  });

  it("keeps the web-only smooth scroll behaviour", () => {
    expect(webRules.get("@layer base html")?.[0]).toContain(
      "scroll-behavior: smooth",
    );
    expect(desktopRules.get("@layer base html")?.[0]).not.toContain(
      "scroll-behavior",
    );
  });

  it("does not consolidate the toggle-thumb rgba() deferred last wave", () => {
    for (const rules of [webRules, desktopRules]) {
      expect(rules.get(".toggle-thumb")?.[0]).toContain(
        "box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3)",
      );
    }
  });
});
