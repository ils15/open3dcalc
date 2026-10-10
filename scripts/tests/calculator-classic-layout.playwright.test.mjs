import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chromium } from "playwright";

const previewUrl =
  process.env.CALCULATOR_PREVIEW_URL ?? "http://127.0.0.1:3045/";
const browser = await chromium.launch({ headless: true });

after(async () => {
  await browser.close();
});

async function openIsolatedPage(width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="calculator-layout"]');
  return { context, page };
}

async function bounds(page, selector) {
  return page
    .locator(selector)
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, width: rect.width, right: rect.right };
    });
}

function closeTo(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected}±${tolerance}px, received ${actual}px`,
  );
}

test("Classic rail matches Example anchors at desktop and stays safe on mobile", async (t) => {
  const desktop = await openIsolatedPage(1440, 900);
  try {
    const { page } = desktop;
    await page.waitForSelector(
      '[data-testid="calculator-layout"][data-layout-mode="three-region"]',
    );
    assert.equal(await page.locator("#results-sidebar-panel").count(), 1);
    assert.equal(await page.locator("#pii-vault-passphrase").count(), 0);

    const sectionNav = await bounds(
      page,
      '[data-testid="calculator-section-nav"] nav:visible button',
    );
    const sectionNavRail = await bounds(
      page,
      '[data-testid="calculator-section-nav"] nav:visible',
    );
    const firstInput = await bounds(
      page,
      '[data-testid="calculator-inputs"] input.w-full',
    );
    const resultsPanel = await bounds(page, "#results-sidebar-panel");
    const materialGridColumns = await page
      .locator('#section-material .grid[class*="@form3:grid-cols-3"]')
      .first()
      .evaluate(
        (element) =>
          element.ownerDocument.defaultView
            .getComputedStyle(element)
            .gridTemplateColumns.trim()
            .split(/\s+/).length,
      );
    t.diagnostic(
      `1440x900 CSS px: section rail x=${sectionNavRail.x.toFixed(1)} w=${sectionNavRail.width.toFixed(1)}, button w=${sectionNav.width.toFixed(1)}, first input x=${firstInput.x.toFixed(1)} w=${firstInput.width.toFixed(1)}, material columns=${materialGridColumns}, results w=${resultsPanel.width.toFixed(1)}`,
    );

    closeTo(sectionNavRail.width, 112, 2, "section nav rail width");
    assert.ok(firstInput.x >= sectionNavRail.right);
    assert.equal(materialGridColumns, 3, "material fields use three columns");
    assert.ok(
      resultsPanel.width >= 400,
      "results lane remains comfortably wide",
    );
    assert.ok(resultsPanel.right <= 1440, "results rail stays in the viewport");
    const desktopOverflow = await page.evaluate(() => ({
      scrollWidth: globalThis.document.documentElement.scrollWidth,
      viewportWidth: globalThis.innerWidth,
    }));
    assert.ok(
      desktopOverflow.scrollWidth <= desktopOverflow.viewportWidth + 1,
      `desktop horizontal overflow: scrollWidth=${desktopOverflow.scrollWidth}, viewport=${desktopOverflow.viewportWidth}`,
    );

    const anchor = await page
      .locator("#section-results")
      .evaluate((element) => {
        const style =
          element.ownerDocument.defaultView.getComputedStyle(element);
        return {
          scrollMarginTop: style.scrollMarginTop,
          position: style.position,
        };
      });
    assert.equal(anchor.scrollMarginTop, "96px");
    assert.equal(anchor.position, "sticky");

    await page.locator("#section-results").evaluate((element) => {
      element.scrollIntoView({ behavior: "instant", block: "start" });
    });
    const anchorTop = await page
      .locator("#section-results")
      .evaluate((element) => element.getBoundingClientRect().top);
    assert.ok(
      anchorTop >= 76 && anchorTop <= 108,
      `results anchor should clear the sticky header; received top=${anchorTop}px`,
    );

    await page.setViewportSize({ width: 2560, height: 1200 });
    const ultraWideMaterialColumns = await page
      .locator('#section-material .grid[class*="@form4:grid-cols-4"]')
      .first()
      .evaluate(
        (element) =>
          element.ownerDocument.defaultView
            .getComputedStyle(element)
            .gridTemplateColumns.trim()
            .split(/\s+/).length,
      );
    assert.equal(
      ultraWideMaterialColumns,
      4,
      "ultrawide material form uses four columns",
    );
  } finally {
    await desktop.context.close();
  }

  const mobile = await openIsolatedPage(390, 844);
  try {
    const { page } = mobile;
    await page.waitForSelector(
      '[data-testid="calculator-layout"][data-layout-mode="inline-results"]',
    );
    assert.equal(await page.locator("#results-sidebar-panel").count(), 1);
    assert.equal(await page.locator("#pii-vault-passphrase").count(), 0);
    const overflow = await page.evaluate(() => ({
      scrollWidth: globalThis.document.documentElement.scrollWidth,
      viewportWidth: globalThis.innerWidth,
    }));
    assert.ok(
      overflow.scrollWidth <= overflow.viewportWidth + 1,
      `mobile horizontal overflow: scrollWidth=${overflow.scrollWidth}, viewport=${overflow.viewportWidth}`,
    );
    t.diagnostic(
      `390x844 CSS px: document scrollWidth=${overflow.scrollWidth}, viewport=${overflow.viewportWidth}`,
    );

    const anchor = await page
      .locator("#section-results")
      .evaluate((element) => {
        const style =
          element.ownerDocument.defaultView.getComputedStyle(element);
        return {
          scrollMarginTop: style.scrollMarginTop,
          position: style.position,
        };
      });
    assert.equal(anchor.scrollMarginTop, "96px");
    assert.notEqual(anchor.position, "sticky");
  } finally {
    await mobile.context.close();
  }
});
