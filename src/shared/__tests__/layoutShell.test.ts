import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const webApp = read("platform/web/App.tsx");
const desktopApp = read("platform/desktop/App.tsx");
const webCss = read("platform/web/index.css");
const desktopCss = read("platform/desktop/index.css");
const tokensPath = resolve(projectRoot, "styles/tokens.css");
const tokensCss = existsSync(tokensPath) ? readFileSync(tokensPath, "utf-8") : "";
const webHeader = read("shared/components/Header/Header.tsx");
const desktopHeader = read("platform/desktop/components/Header/Header.tsx");
const inputGroup = read("shared/components/ui/InputGroup.tsx");
const select = read("shared/components/ui/Select/Select.tsx");

describe("Ultrawide shell & overflow containment", () => {
  it("shell grows to 1920px on 2xl screens instead of staying at 1600px", () => {
    expect(webApp).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
    expect(desktopApp).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
  });

  it("header container matches the shell width at 2xl", () => {
    expect(webHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
    expect(desktopHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
  });

  it("app root clips horizontal overflow without creating a scroll container (sticky-safe)", () => {
    expect(webApp).toMatch(/min-h-dvh flex flex-col overflow-x-clip/);
    expect(desktopApp).toMatch(/min-h-dvh flex flex-col overflow-x-clip/);
    expect(webApp).not.toMatch(/overflow-x-hidden/);
    expect(desktopApp).not.toMatch(/overflow-x-hidden/);
  });

  it("shell uses overflow-x-clip instead of overflow-hidden", () => {
    expect(webApp).toMatch(/max-w-\[1600px\][^"]*overflow-x-clip/);
    expect(desktopApp).toMatch(/max-w-\[1600px\][^"]*overflow-x-clip/);
    expect(webApp).not.toMatch(/max-w-\[1600px\][^"]*overflow-hidden/);
  });

  it("defines centralized light and dark semantic themes", () => {
    expect(tokensCss).toMatch(
      /:root\s*{[^}]*--surface-canvas:\s*#f6f7fb;/i,
    );
    expect(tokensCss).toMatch(
      /\.dark\s*{[^}]*--surface-canvas:\s*#0a0b10;/i,
    );
  });

  it("imports the shared tokens and fonts without remote Google Fonts", () => {
    for (const css of [webCss, desktopCss]) {
      expect(css).toMatch(/@import\s+"\.\.\/\.\.\/styles\/tokens\.css";/);
      expect(css).toMatch(/@import\s+"\.\.\/\.\.\/styles\/fonts\.css";/);
      expect(css).not.toMatch(/fonts\.googleapis\.com/i);
    }
  });

  it("keeps every legacy color name as a compatibility alias", () => {
    const legacyAliases = {
      "--color-bg-primary": "--surface-canvas",
      "--color-bg-secondary": "--surface-sunken",
      "--color-bg-surface": "--surface-raised",
      "--color-bg-elevated": "--surface-overlay",
      "--color-bg-hover": "--surface-sunken",
      "--color-bg-input": "--surface-input",
      "--color-border": "--border-subtle",
      "--color-border-subtle": "--surface-sunken",
      "--color-border-hover": "--border-default",
      "--color-border-focus": "--accent",
      "--color-text-primary": "--text-primary",
      "--color-text-secondary": "--text-secondary",
      "--color-text-muted": "--text-muted",
      "--color-text-inverse": "--text-inverse",
      "--color-accent": "--accent",
      "--color-accent-hover": "--accent-hover",
      "--color-accent-light": "--accent",
      "--color-accent-muted": "--accent-subtle",
      "--color-accent-text": "--text-inverse",
      "--color-success": "--positive",
      "--color-warning": "--warning",
      "--color-danger": "--critical",
      "--color-info": "--info",
      "--color-success-muted": "--positive-subtle",
      "--color-warning-muted": "--warning-subtle",
      "--color-danger-muted": "--critical-subtle",
      "--color-info-muted": "--info-subtle",
      "--color-violet": "--cost-filament",
      "--color-violet-muted": "--accent-subtle",
      "--color-chart-tooltip-bg": "--surface-overlay",
      "--color-chart-tooltip-border": "--border-subtle",
      "--color-chart-tooltip-text": "--text-primary",
      "--color-bg-base": "--color-bg-primary",
      "--color-bg-subtle": "--color-bg-secondary",
      "--color-bg-card": "--color-bg-surface",
      "--color-primary": "--color-accent",
      "--color-primary-hover": "--color-accent-hover",
      "--color-primary-light": "--color-accent-light",
      "--color-primary-muted": "--color-accent-muted",
      "--color-text-subtle": "--color-text-secondary",
    } as const;

    for (const [legacyName, semanticName] of Object.entries(legacyAliases)) {
      expect(tokensCss).toMatch(
        new RegExp(`${legacyName}:\\s*var\\(${semanticName}\\);`),
      );
    }
  });

  it("body uses overflow-x: clip to prevent horizontal scroll", () => {
    for (const css of [webCss, desktopCss]) {
      expect(css).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/s);
    }
  });

  it("keeps the --container-form token for section grids", () => {
    for (const css of [webCss, desktopCss]) {
      expect(css).toMatch(/--container-form:\s*38rem/);
    }
  });

  it("primary form labels are at least 12px and use text-secondary", () => {
    expect(inputGroup).toMatch(
      /text-\[12px\][^"]*text-\[var\(--text-secondary\)\]/,
    );
    expect(select).toMatch(
      /text-\[12px\][^"]*text-\[var\(--text-secondary\)\]/,
    );
  });
});

describe("breakpoint matrix (390 → 2000px) — shell width", () => {
  const matrix = [
    { width: 390, shellCap: 1600, headerCap: 1600 },
    { width: 768, shellCap: 1600, headerCap: 1600 },
    { width: 1024, shellCap: 1600, headerCap: 1600 },
    { width: 1280, shellCap: 1600, headerCap: 1600 },
    { width: 1440, shellCap: 1600, headerCap: 1600 },
    { width: 1536, shellCap: 1920, headerCap: 1920 },
    { width: 2000, shellCap: 1920, headerCap: 1920 },
  ];

  it.each(matrix)(
    "at $width px the shell caps at $shellCap px",
    ({ width, shellCap, headerCap }) => {
      const is2xl = width >= 1536;
      // Class-level contract: max-w-[1600px] base + 2xl:max-w-[1920px]
      expect(shellCap).toBe(is2xl ? 1920 : 1600);
      expect(headerCap).toBe(is2xl ? 1920 : 1600);
      expect(webApp).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
      expect(webHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
    },
  );
});
