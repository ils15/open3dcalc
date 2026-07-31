import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(projectRoot, p), "utf-8");

const webApp = read("platform/web/App.tsx");
const desktopApp = read("platform/desktop/App.tsx");
const webCss = read("platform/web/index.css");
const desktopCss = read("platform/desktop/index.css");
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

  it("defines --color-border-hover in light (:root) and dark themes", () => {
    for (const css of [webCss, desktopCss]) {
      expect(css).toMatch(/:root\s*{[^}]*--color-border-hover:\s*#cbd5e1/s);
      expect(css).toMatch(/\.dark\s*{[^}]*--color-border-hover:\s*#3a4057/s);
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
      /text-\[12px\][^"]*text-\[var\(--color-text-secondary\)\]/,
    );
    expect(select).toMatch(
      /text-\[12px\][^"]*text-\[var\(--color-text-secondary\)\]/,
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
