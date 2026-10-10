import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chromium } from "playwright";

const url = process.env.STUDIO_PREVIEW_URL ?? "http://127.0.0.1:3000/";
const browser = await chromium.launch({ headless: true });

after(async () => {
  await browser.close();
});

async function dismissFirstRun(page) {
  const consent = page.getByRole("button", {
    name: "Entendi e quero continuar",
  });
  if (await consent.isVisible()) await consent.click();
}

test("Classic calculator expands on ultrawide desktops without document overflow", async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const errors = [];

  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "networkidle" });
    await dismissFirstRun(page);
    await page.getByTestId("calculator-measure").waitFor();

    const desktopWidth = await page
      .getByTestId("calculator-measure")
      .evaluate((element) => element.getBoundingClientRect().width);

    await page.setViewportSize({ width: 1568, height: 900 });
    await page.waitForFunction(
      () =>
        (globalThis.document
          .querySelector('[data-testid="calculator-measure"]')
          ?.getBoundingClientRect().width ?? 0) > 1100,
    );
    const screenshotWidth = await page
      .getByTestId("calculator-measure")
      .evaluate((element) => element.getBoundingClientRect().width);

    await page.setViewportSize({ width: 2560, height: 1200 });
    await page.waitForFunction(
      () =>
        (globalThis.document
          .querySelector('[data-testid="calculator-measure"]')
          ?.getBoundingClientRect().width ?? 0) > 1700,
    );

    const wideLayout = await page.evaluate(() => ({
      viewportWidth: globalThis.window.innerWidth,
      documentWidth: globalThis.document.documentElement.scrollWidth,
      measureWidth: globalThis.document
        .querySelector('[data-testid="calculator-measure"]')
        ?.getBoundingClientRect().width,
    }));

    assert.ok(
      screenshotWidth > desktopWidth + 100,
      `Calculator should expand at 1568px: 1440px=${desktopWidth}px, 1568px=${screenshotWidth}px`,
    );
    assert.ok(
      wideLayout.measureWidth > screenshotWidth + 800,
      `Calculator should grow at 2560px: 1568px=${screenshotWidth}px, 2560px=${wideLayout.measureWidth}px`,
    );
    assert.ok(
      wideLayout.documentWidth <= wideLayout.viewportWidth,
      `2560px viewport overflow: document width=${wideLayout.documentWidth}px`,
    );
    assert.deepEqual(errors, [], "browser console and page errors");

    for (const colorScheme of ["light", "dark"]) {
      await page.emulateMedia({ colorScheme });
      await page.waitForFunction(
        (theme) =>
          globalThis.document.documentElement.classList.contains(theme),
        colorScheme,
      );
      const themedDocumentWidth = await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth,
      );
      assert.ok(
        themedDocumentWidth <= 2560,
        `${colorScheme} theme document overflow: ${themedDocumentWidth}px`,
      );
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const sidebar = globalThis.document.querySelector("aside");
      return (
        sidebar && Math.abs(sidebar.getBoundingClientRect().width - 68) < 0.5
      );
    });
    const mobileLayout = await page.evaluate(() => {
      const main = globalThis.document.querySelector("main");
      return {
        viewportWidth: globalThis.window.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        mainScrollWidth: main?.scrollWidth ?? 0,
        mainClientWidth: main?.clientWidth ?? 0,
      };
    });
    assert.ok(
      mobileLayout.documentWidth <= mobileLayout.viewportWidth,
      `390px classic calculator overflow: ${mobileLayout.documentWidth}px`,
    );
    assert.ok(
      mobileLayout.mainScrollWidth <= mobileLayout.mainClientWidth,
      `390px classic calculator content overflow: ${mobileLayout.mainScrollWidth}px > ${mobileLayout.mainClientWidth}px`,
    );
    assert.deepEqual(errors, [], "browser console and page errors");
  } finally {
    await context.close();
  }
});

test("Bento fits at 390px and the fixed dock never covers focusable content", async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
  });
  const errors = [];

  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(url, { waitUntil: "networkidle" });
    await dismissFirstRun(page);
    await page.getByRole("button", { name: "Bento", exact: true }).click();
    await page
      .getByRole("region", { name: "Calculadora em Bento Grid" })
      .waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const sidebar = globalThis.document.querySelector("aside");
      return (
        sidebar && Math.abs(sidebar.getBoundingClientRect().width - 68) < 0.5
      );
    });

    const layout = await page.evaluate(() => {
      const main = globalThis.document.querySelector("main");
      const dockButton = globalThis.document.querySelector(
        '[aria-label="Modo Foco"]',
      );
      const dock = dockButton?.parentElement?.parentElement;
      if (!main || !dock)
        throw new Error("Main content or cockpit dock missing");

      const measureOverlap = () => {
        const dockRect = dock.getBoundingClientRect();
        const overlaps = Array.from(
          main.querySelectorAll(
            'button:not(:disabled),a,input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])',
          ),
        )
          .filter((el) => {
            const rect = el.getBoundingClientRect();
            return (
              rect.width > 0 &&
              rect.height > 0 &&
              globalThis.getComputedStyle(el).visibility !== "hidden" &&
              rect.bottom > dockRect.top &&
              rect.top < dockRect.bottom &&
              rect.right > dockRect.left &&
              rect.left < dockRect.right
            );
          })
          .map((el) => el.getAttribute("aria-label") || el.textContent?.trim());
        return { dockRect: dockRect.toJSON(), overlaps };
      };

      const atTop = measureOverlap();
      main.scrollTo({ top: main.scrollHeight, behavior: "instant" });
      const atBottom = measureOverlap();

      return {
        viewportWidth: globalThis.window.innerWidth,
        documentWidth: globalThis.document.documentElement.scrollWidth,
        mainRect: main.getBoundingClientRect().toJSON(),
        mainScrollWidth: main.scrollWidth,
        mainClientWidth: main.clientWidth,
        dockPosition: globalThis.getComputedStyle(dock).position,
        dockClearanceHeight: globalThis.document
          .querySelector('[data-testid="cockpit-dock-clearance"]')
          ?.getBoundingClientRect().height,
        atTop,
        atBottom,
      };
    });

    assert.ok(
      layout.documentWidth <= layout.viewportWidth,
      `390px viewport overflow: document width=${layout.documentWidth}px`,
    );
    assert.ok(
      layout.mainScrollWidth <= layout.mainClientWidth,
      `390px calculator content overflow: main scrollWidth=${layout.mainScrollWidth}px, clientWidth=${layout.mainClientWidth}px`,
    );
    assert.ok(
      layout.mainRect.bottom <= layout.atTop.dockRect.top,
      "The main scroll viewport must end before the fixed dock starts",
    );
    if (layout.dockPosition === "fixed") {
      assert.ok(layout.dockClearanceHeight >= 96);
    } else {
      assert.ok(
        layout.mainRect.bottom <= layout.atTop.dockRect.top,
        "the in-flow mobile dock must stay outside the main scroll viewport",
      );
    }
    assert.deepEqual(
      layout.atTop.overlaps,
      [],
      "focusable content at scroll top",
    );
    assert.deepEqual(
      layout.atBottom.overlaps,
      [],
      "focusable content at scroll bottom",
    );
    assert.deepEqual(errors, [], "browser console and page errors");
  } finally {
    await context.close();
  }
});
