import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import {
  AA_NORMAL_TEXT,
  contrastRatio,
  tokenInBlock,
} from "./helpers/contrast";

/** Every .ts/.tsx/.css source file under `dir`, recursively. */
function walkSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    // `__tests__` is excluded: these guards legitimately QUOTE
    // `prefers-color-scheme` in their own assertions, and a guard must not
    // fail because it names the thing it forbids.
    if (
      entry === "node_modules" ||
      entry === "Example" ||
      entry === "dist" ||
      entry === "__tests__"
    ) {
      continue;
    }
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkSources(full));
    else if (/\.(ts|tsx|css)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Source with comments removed.
 *
 * Necessary here because the fix is DOCUMENTED in comments: both tokens.css and
 * SpoolCard now explain in prose that `dark:` used to be bound to
 * `@media (prefers-color-scheme: dark)`. A raw substring scan would match the
 * explanation of the defect and report the fix as a violation.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * REGRESSION GUARD for the "modo escuro ta misturando com modo claro" report.
 *
 * The defect was structural, not a colour-picking mistake: the Studio shell
 * was token-driven while its views and overlays painted a hardcoded dark-only
 * palette, so light mode produced dark cards inside a light shell. A screenshot
 * catches that once; these assertions make it impossible to reintroduce silently.
 *
 * WHAT IS PINNED, AND WHY EACH ONE CANNOT BE SATISFIED BY ACCIDENT
 *
 *  - The shell surfaces name semantic tokens. A hex literal, a `slate-*` or a
 *    `purple-*` utility in one of these five call sites cannot resolve in light
 *    mode, so their reappearance is the failure itself.
 *  - `dark:` follows the theme CLASS. The defect was that it followed the OS
 *    instead, which is invisible in any single-theme screenshot.
 *  - `.light` has a CSS counterpart. `applyTheme()` writes the class; before
 *    this it matched nothing.
 *  - The entry HTML carries an anti-FOUC script whose CSP hash matches. A
 *    script that the CSP silently blocks still looks correct in source.
 *
 * SCOPE — READ BEFORE TREATING A RED TEST AS A BUG
 * The shell, eight Studio views, Infill panel and four Studio overlays/modals
 * use theme tokens. The shell-call-site checks below retain the earlier guard;
 * the migration checks at the end pin the expanded component set.
 */

// Two roots. `../..` from src/shared/__tests__ lands on src/, which is where
// the sibling tests in this directory read from and where every path below
// except the entry HTML lives. The two entry documents sit at the REPOSITORY
// root, one level higher.
const srcRoot = resolve(__dirname, "../..");
const repoRoot = resolve(__dirname, "../../..");
const read = (p: string) => readFileSync(resolve(srcRoot, p), "utf-8");
const readRepo = (p: string) => readFileSync(resolve(repoRoot, p), "utf-8");

const tokensCss = read("styles/tokens.css");
const webHtml = readRepo("index.web.html");
const desktopHtml = readRepo("index.desktop.html");

const STUDIO = "platform/web/components/studio";
const shell = {
  layout: read(`${STUDIO}/StudioLayout.tsx`),
  header: read(`${STUDIO}/StudioHeader.tsx`),
  subHeader: read(`${STUDIO}/StudioSubHeader.tsx`),
  sidebar: read(`${STUDIO}/StudioSidebar.tsx`),
};

/**
 * The shell's own surface call sites, as (file, marker) pairs.
 *
 * The marker is a substring unique to that element's opening tag. Matching on
 * the whole file for a bare `bg-[#080c14]` would also flag the same literal
 * somewhere it is legitimately allowed, and the point of the guard is that the
 * SHELL is tokenized — not that the string never occurs.
 */
const SHELL_SURFACES: ReadonlyArray<readonly [string, string, string]> = [
  // [label, source, marker that pins the element]
  ["StudioLayout root", shell.layout, "min-h-screen"],
  ["StudioHeader", shell.header, "sticky top-0 z-40"],
  ["StudioSubHeader", shell.subHeader, "sticky top-12 z-30"],
  [
    "StudioSidebar",
    shell.sidebar,
    "bg-surface-raised border-r border-border-subtle flex flex-col",
  ],
  ["StudioLayout focus banner", shell.layout, "Sair do Modo Foco (Esc)"],
];

/** The opening tag that carries `marker`, or "" when it cannot be found. */
function elementAround(source: string, marker: string): string {
  const at = source.indexOf(marker);
  if (at === -1) return "";
  const open = source.lastIndexOf("<", at);
  const close = source.indexOf(">", at);
  if (open === -1 || close === -1) return "";
  return source.slice(open, close + 1);
}

/* ------------------------------------------------------------------ *
 * 1. The shell paints semantic tokens, not literals.
 * ------------------------------------------------------------------ */

describe("the Studio shell cannot reintroduce a hardcoded dark-only palette", () => {
  it.each(SHELL_SURFACES)(
    "%s carries no hex literal, slate-* or purple-* colour",
    (_label, source, marker) => {
      const element = elementAround(source, marker);
      expect(
        element,
        "the marker must still locate a real element — if this fails, the shell was restructured and this guard needs re-pointing at the new call site",
      ).not.toBe("");

      // A raw hex in an arbitrary-value utility: bg-[#080c14].
      expect(
        element,
        `${_label} paints a hardcoded hex. Use a semantic token from styles/tokens.css — a literal cannot resolve in light mode.`,
      ).not.toMatch(/-\[#[0-9a-f]{3,8}\]/i);

      // A Tailwind palette family that is not theme-aware: slate-*/purple-*.
      // Tokens live in the --color-* namespace, so no palette step is correct
      // on a themed surface.
      expect(
        element,
        `${_label} paints a raw Tailwind palette step. Use a semantic token — slate-*/purple-* do not flip with the theme.`,
      ).not.toMatch(
        /\b(?:bg|text|border|from|to|via)-(?:slate|purple)-\d{2,3}\b/,
      );
    },
  );

  it.each(SHELL_SURFACES)(
    "%s names a token from the shared palette",
    (_label, source, marker) => {
      expect(elementAround(source, marker)).toMatch(
        /(?:bg|text|border|selection:bg)-\[?var\(--color-|-\b(?:surface|text|border|accent)-/,
      );
    },
  );

  it("keeps the shell root on the themed canvas and text tokens", () => {
    const root = elementAround(shell.layout, "min-h-screen");
    expect(root).toContain("bg-surface-canvas");
    expect(root).toContain("text-text-primary");
  });
});

/* ------------------------------------------------------------------ *
 * 2. `dark:` follows the app's theme class, not the OS.
 * ------------------------------------------------------------------ */

describe("Tailwind's dark: variant follows the app theme, not prefers-color-scheme", () => {
  // The notes in tokens.css DISCUSS `prefers-color-scheme` by name, which is
  // precisely why a raw text scan of the file is not a test: it would match the
  // comment explaining why the media query must not come back. Comments are
  // stripped first so this asserts what a browser would actually parse.
  const rules = tokensCss.replace(/\/\*[\s\S]*?\*\//g, "");

  it("redeclares the variant against the .dark class", () => {
    expect(rules).toMatch(
      /@custom-variant\s+dark\s*\(\s*&:where\(\s*\.dark\s*,\s*\.dark\s+\*\s*\)\s*\)\s*;/,
    );
  });

  it("declares it before @theme inline, where Tailwind resolves utilities", () => {
    const variant = rules.indexOf("@custom-variant dark");
    const theme = rules.indexOf("@theme inline");
    expect(variant).toBeGreaterThan(-1);
    expect(theme).toBeGreaterThan(-1);
    expect(
      variant,
      "@custom-variant must precede @theme inline or the utilities it binds resolve to the OS preference instead",
    ).toBeLessThan(theme);
  });

  it("does not reintroduce an OS-preference media query in the token layer", () => {
    // There is no legitimate `prefers-color-scheme` in the stylesheets: the
    // whole point is that the class is the only switch. Its return would mean
    // the OS can override the user's explicit choice again.
    expect(rules).not.toMatch(/prefers-color-scheme/);
  });

  it("keeps every dark: call site in the app pointing at the class", () => {
    // No source file may hand-roll a prefers-color-scheme query for theme.
    const offenders = walkSources(srcRoot).filter(
      (file) =>
        stripComments(readFileSync(file, "utf-8")).includes(
          "prefers-color-scheme",
        ) && !file.endsWith(`${sep}hooks${sep}useTheme.ts`),
    );

    expect(
      offenders.map((f) => f.replace(`${srcRoot}${sep}`, "")),
      "theme must be decided in ONE place (useTheme.ts). A second OS-preference " +
        "query in a component is the two-independent-switches defect again.",
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Light mode has an anchor.
 * ------------------------------------------------------------------ */

describe("light mode has a CSS anchor, not just an implicit :root fallback", () => {
  it("matches .light in the alias layer the components consume", () => {
    // `:root` alone matches every document, so a bare `:root` is not a theme.
    expect(tokensCss).toMatch(/:root,\s*\.light\s*\{/);
  });

  it("still declares the light palette on :root for pre-initTheme renders", () => {
    expect(tokensCss).toMatch(/:root\s*\{\s*\/\* Surfaces \*\//);
    expect(tokensCss).toMatch(/:root\s*\{[^}]*--surface-canvas:\s*#f6f7fb;/i);
  });

  it("keeps the dark palette on .dark", () => {
    expect(tokensCss).toMatch(/\.dark\s*\{[^}]*--surface-canvas:\s*#0a0b10;/i);
  });

  it("writes both classes from applyTheme, so neither is orphaned", () => {
    const useTheme = read("shared/hooks/useTheme.ts");
    expect(useTheme).toMatch(/classList\.add\(\s*["']dark["']\s*\)/);
    expect(useTheme).toMatch(/classList\.add\(\s*["']light["']\s*\)/);
    // Mutually exclusive: applying one must clear the other or both match.
    expect(useTheme).toMatch(/classList\.remove\(\s*["']light["']\s*\)/);
    expect(useTheme).toMatch(/classList\.remove\(\s*["']dark["']\s*\)/);
  });
});

/* ------------------------------------------------------------------ *
 * 4. No flash of the wrong theme before hydration.
 * ------------------------------------------------------------------ */

describe("the entry documents set the theme class before first paint", () => {
  const BOOT_SCRIPT =
    /(?:function[\s\S]*?)?var k = "open3dcalc_theme"[\s\S]*?\}\)\(\);/;

  it.each([
    ["index.web.html", webHtml],
    ["index.desktop.html", desktopHtml],
  ])("%s carries the anti-FOUC script", (file, html) => {
    expect(
      html,
      `${file} must set the theme class before React mounts, or the first paint uses the wrong palette`,
    ).toMatch(BOOT_SCRIPT);
  });

  it.each([
    ["index.web.html", webHtml],
    ["index.desktop.html", desktopHtml],
  ])("%s reads the same storage key as useTheme", (file, html) => {
    expect(html).toContain("open3dcalc_theme");
    const useTheme = read("shared/hooks/useTheme.ts");
    expect(
      html.includes("open3dcalc_theme") &&
        useTheme.includes('"open3dcalc_theme"'),
      `${file} and useTheme.ts must agree on the storage key or the script paints one theme and the app renders another`,
    ).toBe(true);
  });

  it.each([
    ["index.web.html", webHtml],
    ["index.desktop.html", desktopHtml],
  ])(
    "%s defaults to dark, matching useTheme's inverted query",
    (file, html) => {
      // useTheme queries `(prefers-color-scheme: light)` and inverts it, so it
      // lands on dark whenever matchMedia is missing. The script must agree or
      // the first paint and the hydrated render disagree.
      expect(html).toContain('"(prefers-color-scheme: light)"');
      expect(
        html,
        `${file} must fall back to dark, the same default useTheme.ts uses`,
      ).toMatch(/\?\s*"light"\s*:\s*"dark"/);
      expect(html).toMatch(/catch[\s\S]*?classList\.add\("dark"\)/);
    },
  );

  it.each([
    ["index.web.html", webHtml],
    ["index.desktop.html", desktopHtml],
  ])("%s ships no hardcoded theme class on <html>", (file, html) => {
    // `class="dark"` is what made the shipped web build ignore the user's
    // stored light preference until initTheme() ran.
    const htmlTag = html.match(/<html[^>]*>/i);
    expect(htmlTag, `${file} must have an <html> tag`).not.toBeNull();
    expect(
      htmlTag![0],
      `${file} hardcodes a theme class on <html>; the boot script owns the class before first paint`,
    ).not.toMatch(/\bclass\s*=\s*["'][^"']*\b(dark|light)\b/);
  });

  it.each([
    ["index.web.html", webHtml],
    ["index.desktop.html", desktopHtml],
  ])("%s authorises the boot script under its own CSP", (file, html) => {
    // `script-src 'self'` blocks inline scripts, and only DEV relaxes it (both
    // vite configs rewrite the CSP under `apply: "serve"`). So an inline boot
    // script needs a hash in the shipped policy or it silently does nothing in
    // production while still looking right in source.
    const csp = html.match(/content="default-src[^"]*script-src[^"]*"/i);
    expect(csp, `${file} must declare a CSP`).not.toBeNull();

    // Hash the script ELEMENT's text content exactly as the browser reads it,
    // which is the only byte sequence a CSP hash is defined over. Trimming or
    // re-indenting here would produce a hash the browser never sees, so this
    // deliberately extracts the element rather than matching a shape.
    const script = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(
      script,
      `${file} boot script must exist to be hashed`,
    ).not.toBeNull();

    const hash = createHash("sha256")
      .update(script![1], "utf-8")
      .digest("base64");

    expect(
      csp![0],
      `${file} blocks its own anti-FOUC script: script-src has no matching ` +
        `sha256-${hash}. Add it, or the script is dropped in production.`,
    ).toContain(`'sha256-${hash}'`);

    // A hash only constrains anything while 'unsafe-inline' is ABSENT from
    // script-src; with it present the policy accepts any inline script and the
    // hash is decorative. Scoped to script-src deliberately: 'unsafe-inline' IS
    // required by style-src here, because React sets inline styles.
    const scriptSrc = csp![0].match(/script-src\s+[^;]*;/i);
    expect(scriptSrc, `${file} must declare script-src`).not.toBeNull();
    expect(
      scriptSrc![0],
      `${file} must not widen script-src to 'unsafe-inline' for the boot script — ` +
        `that would make the hash above decorative`,
    ).not.toContain("'unsafe-inline'");

    // ORDER IS LOAD-BEARING. A CSP <meta> governs only what is parsed AFTER it,
    // so a script placed above the meta is exempt from the policy entirely —
    // which makes the hash above decorative and lets a broken policy look
    // green. Verified: with the script first, an intentionally wrong hash still
    // executed, so a hash test alone cannot catch this.
    const metaAt = html.indexOf('http-equiv="Content-Security-Policy"');
    const scriptAt = html.indexOf("<script>");
    expect(metaAt, `${file} must declare a CSP`).toBeGreaterThan(-1);
    expect(
      metaAt,
      `${file} declares its CSP AFTER the boot script. A CSP meta is not ` +
        `retroactive, so the script would be exempt from the policy and the ` +
        `sha256 entry above would authorise nothing.`,
    ).toBeLessThan(scriptAt);
  });
});

/* ------------------------------------------------------------------ *
 * 5. The scope boundary, stated so it cannot be over-read.
 * ------------------------------------------------------------------ */

describe("Studio views and overlays use theme tokens", () => {
  const MIGRATED_FILES = [
    "StudioLayout",
    "StudioDashboardView",
    "StudioCalculatorView",
    "StudioQuotesView",
    "StudioProductsView",
    "StudioSpoolView",
    "StudioHistoryView",
    "StudioCustomerView",
    "StudioPrinterView",
    "StudioMiniDashOverlay",
    "StudioShortcutsModal",
    "StudioCopilotModal",
    "StudioQuoteModal",
  ];

  it.each(MIGRATED_FILES)("%s contains no hardcoded hex color", (file) => {
    let source = stripComments(read(`${STUDIO}/${file}.tsx`));
    // Spool swatch presets are product data, not UI paint. Keep their physical
    // colors while guarding all rendered surfaces, borders, text, and chart ink.
    if (file === "StudioSpoolView") {
      source = source
        .replace(/hex:\s*"#[0-9a-f]{6}"/gi, "hex: <swatch-data>")
        .replace(
          /(?:useState|setColorHex)\("#[0-9a-f]{6}"\)/gi,
          "colorHex(<swatch-data>)",
        )
        .replace(
          /spool\.colorHex \|\| "#[0-9a-f]{6}"/gi,
          "spool.colorHex || <swatch-data>",
        );
    }
    expect(
      source,
      `${file} must use semantic theme tokens instead of hardcoded hex colors`,
    ).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(
      source,
      `${file} must not use static Tailwind color palettes`,
    ).not.toMatch(
      /\b(?:bg|text|border|ring|from|to|via|placeholder|shadow|divide)-(?:slate|gray|zinc|neutral|blue|indigo|purple|green|red|yellow|amber|orange|emerald|cyan|teal|pink|rose)-\d{2,3}\b/i,
    );
  });

  it.each(["light", "dark"])(
    "small muted text clears WCAG AA on semantic surfaces in %s mode",
    (theme) => {
      const block = theme === "dark" ? ".dark" : ":root";
      const foreground = tokenInBlock(tokensCss, block, "text-muted");
      expect(
        foreground,
        `--text-muted must resolve in ${theme} mode`,
      ).not.toBeNull();
      for (const surface of [
        "surface-canvas",
        "surface-raised",
        "surface-overlay",
        "surface-sunken",
        "surface-input",
      ]) {
        const background = tokenInBlock(tokensCss, block, surface);
        expect(
          background,
          `--${surface} must resolve in ${theme} mode`,
        ).not.toBeNull();
        expect(
          contrastRatio(foreground!, background!),
          `--text-muted on --${surface} in ${theme} mode must be >= ${AA_NORMAL_TEXT}:1`,
        ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
      }
    },
  );

  it("maps the Infill panel surface through semantic tokens", () => {
    const layout = read(`${STUDIO}/StudioLayout.tsx`);
    const calculator = read(
      "shared/components/Calculator/InfillCalculator.tsx",
    );
    expect(layout).not.toMatch(/bg-\[#/i);
    expect(layout).toContain("bg-surface-raised");
    expect(calculator).not.toMatch(
      /(?:bg|text|border)-(?:slate|blue|indigo|purple|green|red|amber|emerald|cyan|teal|rose)-\d{2,3}/i,
    );
  });

  it("lists every Studio*View component that exists, not a remembered subset", () => {
    // The omission of StudioPrinterView went unnoticed because each entry was
    // hand-written. Reading the directory makes the list self-maintaining: a
    // new view fails here until it is deliberately classified.
    const dir = resolve(srcRoot, "platform/web/components/studio");
    const onDisk = readdirSync(dir)
      .filter((f) => /^Studio.*View\.tsx$/.test(f))
      .map((f) => f.replace(/\.tsx$/, ""))
      .sort();
    expect(
      MIGRATED_FILES.filter((file) => file.endsWith("View")).sort(),
      "the migrated view list has drifted from Studio*View files on disk. A new " +
        "view must be added here so it cannot retain a hardcoded palette.",
    ).toEqual(onDisk);
  });
});
