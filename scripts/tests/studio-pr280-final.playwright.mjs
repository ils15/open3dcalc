import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { after, test } from "node:test";
import { chromium } from "playwright";

const url = process.env.STUDIO_PREVIEW_URL ?? "http://127.0.0.1:3000/";
const screenshotDir = "/tmp/opencode/pr280-final";
const browser = await chromium.launch({ headless: true });
mkdirSync(screenshotDir, { recursive: true });

after(async () => {
  await browser.close();
});

async function dismissFirstRun(page) {
  const consent = page.getByRole("button", {
    name: "Entendi e quero continuar",
  });
  if (await consent.isVisible()) await consent.click();

  const passphrase = page.locator("#pii-vault-passphrase");
  if (await passphrase.isVisible()) {
    await passphrase.fill("Playwright-only-123!");
    await page
      .locator("#pii-vault-passphrase-confirm")
      .fill("Playwright-only-123!");
    await page.getByRole("button", { name: "Criar e desbloquear" }).click();
  }
}

test("Studio PR #280 layout, theme, currency and mode behavior", async () => {
  const themeSurfaces = new Map();

  for (const theme of ["light", "dark"]) {
    for (const width of [1920, 1440, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme: theme,
      });
      await context.addInitScript((storedTheme) => {
        globalThis.localStorage.setItem("open3dcalc_theme", storedTheme);
      }, theme);

      const errors = [];
      try {
        const page = await context.newPage();
        page.on("console", (message) => {
          if (message.type() === "error") errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(error.message));

        await page.goto(url, { waitUntil: "networkidle" });
        await dismissFirstRun(page);

        const modeGroup = page.getByRole("group", {
          name: "Modo da calculadora",
        });
        await modeGroup.waitFor();
        assert.equal(
          await page
            .locator("header [aria-label='Modo da calculadora']")
            .count(),
          0,
        );

        await modeGroup.getByRole("button", { name: "Guiado" }).click();
        assert.equal(
          await modeGroup
            .getByRole("button", { name: "Guiado" })
            .getAttribute("aria-pressed"),
          "true",
        );
        await modeGroup.getByRole("button", { name: "Clássico" }).click();

        const complexityGroup = page.getByRole("group", {
          name: "Nível de cálculo",
        });
        const quickMode = complexityGroup.getByRole("button", {
          name: "Rápido",
        });
        const detailedMode = complexityGroup.getByRole("button", {
          name: "Detalhado",
        });
        const proMode = complexityGroup.getByRole("button", {
          name: "Avançado / Pro",
        });
        await detailedMode.click();
        assert.equal(await detailedMode.getAttribute("aria-pressed"), "true");
        assert.equal(await quickMode.getAttribute("aria-pressed"), "false");
        await proMode.click();
        assert.equal(await proMode.getAttribute("aria-pressed"), "true");
        await quickMode.click();
        assert.equal(await quickMode.getAttribute("aria-pressed"), "true");

        const currency = page.getByRole("combobox", { name: "Moeda base" });
        await currency.selectOption("USD");
        await page.waitForFunction(() => {
          const raw = globalThis.localStorage.getItem("open3dcalc_settings_v2");
          return raw !== null && JSON.parse(raw).currency === "USD";
        });
        await page.reload({ waitUntil: "networkidle" });
        await dismissFirstRun(page);
        assert.equal(
          await page.getByRole("combobox", { name: "Moeda base" }).inputValue(),
          "USD",
          "currency preference must survive a full reload",
        );
        await page
          .getByRole("combobox", { name: "Moeda base" })
          .selectOption("BRL");

        const metrics = await page.evaluate(() => {
          const mainElement = globalThis.document.querySelector("main");
          if (!mainElement) throw new Error("Main calculator content missing");
          const grid = Array.from(mainElement.querySelectorAll("div")).find(
            (element) =>
              element.classList.contains("max-w-7xl") &&
              element.classList.contains("mx-auto") &&
              element.classList.contains("lg:flex-row"),
          );
          if (!grid) throw new Error("Centered calculator grid missing");
          const modeSelector = mainElement
            .querySelector('[aria-label="Modo da calculadora"]')
            ?.closest("section");
          if (!(modeSelector instanceof globalThis.HTMLElement)) {
            throw new Error("Calculator mode selector missing");
          }

          const mainRect = mainElement.getBoundingClientRect();
          const gridRect = grid.getBoundingClientRect();
          const modeRect = modeSelector.getBoundingClientRect();
          const style = globalThis.getComputedStyle(mainElement);
          const paddingLeft = Number.parseFloat(style.paddingLeft);
          const paddingRight = Number.parseFloat(style.paddingRight);
          const contentLeft = mainRect.left + paddingLeft;
          const contentWidth =
            mainElement.clientWidth - paddingLeft - paddingRight;
          const contentCenter = contentLeft + contentWidth / 2;

          return {
            viewportWidth: globalThis.window.innerWidth,
            documentWidth: globalThis.document.documentElement.scrollWidth,
            centeredDelta: Math.abs(
              gridRect.left + gridRect.width / 2 - contentCenter,
            ),
            gridWidth: gridRect.width,
            modeSelectorWidth: modeRect.width,
            calculatorModeWidthDelta: Math.abs(gridRect.width - modeRect.width),
            headerBackground: globalThis.getComputedStyle(
              globalThis.document.querySelector("header"),
            ).backgroundColor,
            themeClass: globalThis.document.documentElement.classList.contains(
              "dark",
            )
              ? "dark"
              : "light",
            modeInsideMain:
              mainElement.querySelector(
                '[aria-label="Modo da calculadora"]',
              ) !== null,
          };
        });

        assert.equal(metrics.viewportWidth, width);
        assert.ok(
          metrics.documentWidth <= width,
          `${width}px ${theme} document overflow: ${metrics.documentWidth}px`,
        );
        assert.ok(metrics.gridWidth > 0, "calculator grid is visible");
        assert.ok(
          metrics.gridWidth <= 1280,
          `calculator exceeded 7xl max width: ${metrics.gridWidth}px`,
        );
        assert.ok(
          metrics.calculatorModeWidthDelta <= 2,
          `mode selector and calculator widths differ by ${metrics.calculatorModeWidthDelta}px`,
        );
        assert.ok(
          metrics.centeredDelta <= 2,
          `grid is off-center by ${metrics.centeredDelta}px`,
        );
        assert.equal(metrics.modeInsideMain, true);
        assert.equal(metrics.themeClass, theme);
        themeSurfaces.set(theme, metrics.headerBackground);

        if (width === 1920) {
          await page.getByRole("button", { name: "Modo Foco" }).click();
          const focusWidth = await page.evaluate(() => {
            const mainElement = globalThis.document.querySelector("main");
            const grid = Array.from(
              mainElement?.querySelectorAll("div") ?? [],
            ).find(
              (element) =>
                element.classList.contains("max-w-7xl") &&
                element.classList.contains("lg:flex-row"),
            );
            return grid?.getBoundingClientRect().width ?? 0;
          });
          assert.ok(
            focusWidth > 1152 && focusWidth <= 1280,
            `1920px focus-mode calculator width should use the wider 7xl lane, got ${focusWidth}px`,
          );
          await page
            .getByRole("button", { name: "Sair do Modo Foco (Esc)" })
            .click();
        }

        await page.screenshot({
          path: `${screenshotDir}/studio-${width}-${theme}.png`,
          fullPage: true,
        });
        assert.deepEqual(errors, [], `${width}px ${theme} browser errors`);
      } finally {
        await context.close();
      }
    }
  }

  assert.notEqual(
    themeSurfaces.get("light"),
    themeSurfaces.get("dark"),
    "semantic shell surface must resolve differently in light and dark themes",
  );
});
