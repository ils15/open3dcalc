import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ptBR from "@/shared/i18n/locales/pt-BR.json";
import enUS from "@/shared/i18n/locales/en-US.json";

const projectRoot = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const webApp = read("platform/web/App.tsx");
const desktopApp = read("platform/desktop/App.tsx");
// The Studio rewrite (#260) reduced `platform/web/App.tsx` to a provider pair
// wrapping `<StudioLayout />`, so the web shell is declared in the Studio layout
// rather than in the App. Reading it is what lets the shell contracts below be
// asserted against the module that actually carries them.
const webStudio = read("platform/web/components/studio/StudioLayout.tsx");
const webCss = read("platform/web/index.css");
const desktopCss = read("platform/desktop/index.css");
const tokensPath = resolve(projectRoot, "styles/tokens.css");
const tokensCss = existsSync(tokensPath)
  ? readFileSync(tokensPath, "utf-8")
  : "";
const webHeader = read("shared/components/Header/Header.tsx");
const desktopHeader = read("platform/desktop/components/Header/Header.tsx");
const inputGroup = read("shared/components/ui/InputGroup.tsx");
const select = read("shared/components/ui/Select/Select.tsx");

describe("Classic-only tutorial locale", () => {
  it("keeps launcher translations in sync between pt-BR and en-US", () => {
    expect(Object.keys(ptBR.tutorial.launcher)).toEqual(
      Object.keys(enUS.tutorial.launcher),
    );
    expect(ptBR.tutorial.launcher.classicOnly).toBe(
      "Disponível apenas no layout Clássico",
    );
    expect(enUS.tutorial.launcher.classicOnly).toBe(
      "Available only in the Classic layout",
    );
  });
});

/**
 * THE WEB ROW OF THIS BLOCK IS RED ON PURPOSE — REPORTED PRODUCT BUG
 * -----------------------------------------------------------------
 * Do not "fix" this by retargeting web at `StudioLayout` or by loosening the
 * assertion. Both would encode a defect as the contract. Desktop passes; web
 * does not, and here is why.
 *
 * `useAppInit` — shared, and called by the web Studio at
 * `platform/web/components/studio/StudioLayout.tsx` — auto-starts the tutorial
 * on first visit:
 *
 *     if (layoutMode !== "classic") return;
 *     setTimeout(() => {
 *       if (useLayoutStore.getState().layoutMode !== "classic") return;
 *       if (!guardedStorage.getItem("open3dcalc_onboarded")) return;
 *       const store = useTutorialStore.getState();
 *       if (!store.isCompleted && !store.isActive) store.startTutorial();
 *     }, 1500);
 *
 * On web that timer always fires: `StudioLayout` keeps `layoutMode` in LOCAL
 * `useState` (line 39) and never writes it to `useLayoutStore`, so the store
 * still reads its `"classic"` default and neither guard can reject. But nothing
 * in the web tree mounts `<Tutorial />` — the only mount left in production is
 * `platform/desktop/App.tsx`. So on the web platform the first-run tutorial
 * starts, sets the transient `isActive: true`, renders nothing, and the
 * `!store.isActive` guard above then prevents it from ever firing again for the
 * session. A silent no-op that leaves the store claiming a tour is running.
 *
 * The same divergence strands the layout preference itself: the only other web
 * tutorial entry point, the Tutorial item in `platform/web/components/
 * MobileSettingsSheet.tsx`, reads `isClassicLayout` off `useLayoutStore` — a
 * value the web user can no longer change — and that sheet is in any case no
 * longer mounted by any production module.
 *
 * One of two things is correct, and the choice is a product decision, not a
 * test decision: either the web Studio mounts `<Tutorial />` and sources
 * `layoutMode` from `useLayoutStore`, or web stops auto-starting the tutorial.
 * Until then this row stays red.
 */
describe("Classic-only tutorial mount points", () => {
  it.each([
    ["web", webApp],
    ["desktop", desktopApp],
  ])("mounts the tutorial only in the %s Classic layout", (_name, app) => {
    expect(app).toMatch(/layoutMode === ["']classic["'] && <Tutorial \/>/);
    expect(app).toMatch(/useLayoutStore/);
  });
});

/**
 * THE CAPPED SHELL IS A DESKTOP CONTRACT NOW
 * -------------------------------------------
 * These three assertions used to be `expect(webApp)` + `expect(desktopApp)`
 * pairs, on the assumption that both platforms wrapped their content in the
 * same capped shell. #260 ended that: the web `App` is now a provider pair
 * around `<StudioLayout />`, and the Studio root is
 * `min-h-screen bg-[#080c14] … flex flex-col` — full-bleed, with no
 * `max-w-[1600px] 2xl:max-w-[1920px]` and no `overflow-x-clip` on the root div.
 *
 * So the ultrawide contract below is asserted where it is still live (the
 * desktop shell, and the shared header both shells size against), and the web
 * side is pinned to what actually guarantees the SAME user-visible property on
 * web: horizontal-overflow containment. That moved to the shared stylesheet —
 * `body { overflow-x: clip }` in src/styles/components.css, which the web
 * platform imports — and it is asserted as such by "body uses overflow-x: clip
 * to prevent horizontal scroll" further down. Asserting it again on a div the
 * Studio no longer has could only pass vacuously.
 *
 * REPORTED, NOT DECIDED HERE: web losing the 1600/1920 cap is a product
 * question, not a test decision. Nothing in the tree re-imposes an ultrawide
 * clamp on web, so at 2560px the Studio stretches edge to edge while the
 * desktop shell stops at 1920px. That may be the intended Studio design; this
 * file only stops claiming the opposite.
 */
describe("Ultrawide shell & overflow containment", () => {
  it("shell grows to 1920px on 2xl screens instead of staying at 1600px", () => {
    expect(desktopApp).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
  });

  it("header container matches the shell width at 2xl", () => {
    expect(webHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
    expect(desktopHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
  });

  it("app root clips horizontal overflow without creating a scroll container (sticky-safe)", () => {
    expect(desktopApp).toMatch(/min-h-dvh flex flex-col overflow-x-clip/);
    expect(desktopApp).not.toMatch(/overflow-x-hidden/);
    // Web: the guarantee is the shared body rule, asserted at its own source by
    // the "body uses overflow-x: clip" test. Pinned here too, because "the web
    // App no longer carries it" is only true while that import survives.
    expect(webCss).toMatch(/@import\s+"\.\.\/\.\.\/styles\/components\.css";/);
    // The Studio root must not reintroduce a scroll container, which is the
    // failure mode `overflow-x-hidden` would cause and the reason the rule is
    // `clip`. `min-h-screen` is the Studio's own root sizing, not this concern.
    expect(webStudio).not.toMatch(/overflow-x-hidden/);
    expect(webApp).not.toMatch(/overflow-x-hidden/);
  });

  it("shell uses overflow-x-clip instead of overflow-hidden", () => {
    expect(desktopApp).toMatch(/max-w-\[1600px\][^"]*overflow-x-clip/);
    expect(desktopApp).not.toMatch(/max-w-\[1600px\][^"]*overflow-hidden/);
  });

  it("defines centralized light and dark semantic themes", () => {
    expect(tokensCss).toMatch(/:root\s*{[^}]*--surface-canvas:\s*#f6f7fb;/i);
    expect(tokensCss).toMatch(/\.dark\s*{[^}]*--surface-canvas:\s*#0a0b10;/i);
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
    // `body` now lives in the shared component layer, which BOTH platforms
    // import, so the rule is asserted once at its single source and each
    // platform's import of that source is asserted separately — together these
    // are equivalent to (and stricter than) the old per-platform check.
    const componentsPath = resolve(projectRoot, "styles/components.css");
    const componentsCss = existsSync(componentsPath)
      ? readFileSync(componentsPath, "utf-8")
      : "";
    expect(
      componentsCss,
      "styles/components.css must set overflow-x: clip on body",
    ).toMatch(/body\s*\{[^}]*overflow-x:\s*clip/s);
    for (const css of [webCss, desktopCss]) {
      expect(
        css,
        "each platform must import the shared component layer to get the body rule",
      ).toMatch(/@import\s+"\.\.\/\.\.\/styles\/components\.css";/);
    }
  });

  it("keeps the --container-form token for section grids", () => {
    // Single source of truth: the token lives in the shared component layer.
    // Both platforms inherit it from the same @import, so pinning it twice
    // would only enforce the duplication this consolidation removed.
    const componentsPath = resolve(projectRoot, "styles/components.css");
    const componentsCss = existsSync(componentsPath)
      ? readFileSync(componentsPath, "utf-8")
      : "";
    expect(componentsCss).toMatch(/--container-form:\s*38rem/);
    // Drift guard: neither platform may redeclare it locally.
    for (const css of [webCss, desktopCss]) {
      expect(css).not.toMatch(/--container-form:/);
    }
  });

  it("keeps --container-form3 beside --container-form for wide field groups", () => {
    // The three-column breakpoint is a SECOND, wider token. It must not be
    // implemented by raising --container-form: that value drives the 1<->2
    // transition of every section grid, so widening it would collapse the
    // 608..864px band to one column. Hence both assertions below: the new
    // token exists AND the old one is untouched.
    const componentsPath = resolve(projectRoot, "styles/components.css");
    const componentsCss = existsSync(componentsPath)
      ? readFileSync(componentsPath, "utf-8")
      : "";
    expect(componentsCss).toMatch(/--container-form3:\s*56\.25rem/);
    expect(componentsCss).toMatch(/--container-form:\s*38rem/);
    // Both tokens live in the SAME @theme block — a second @theme inline
    // would make sharedComponentLayer.test.ts report "declared 2x".
    const themeBlocks = componentsCss.match(/@theme\s+inline\s*\{/g) ?? [];
    expect(themeBlocks).toHaveLength(1);
    // Drift guard, same as for --container-form.
    for (const css of [webCss, desktopCss]) {
      expect(css).not.toMatch(/--container-form3:/);
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

/**
 * The matrix walks the seven widths and re-derives the cap each one must resolve
 * to, so a change to the 2xl threshold (Tailwind's `2xl` is 1536px) fails here
 * rather than only in the class string above.
 *
 * `shellCap` is asserted against the DESKTOP shell: that is the surface the cap
 * lives on. The header column is still asserted on both, because
 * `shared/components/Header/Header.tsx` keeps the pair and is what the web
 * header resolves to as well. See the block comment at the top of
 * "Ultrawide shell & overflow containment" for why the web App no longer
 * carries a cap to assert.
 */
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
      expect(desktopApp).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
      expect(webHeader).toMatch(/max-w-\[1600px\] 2xl:max-w-\[1920px\]/);
    },
  );
});
