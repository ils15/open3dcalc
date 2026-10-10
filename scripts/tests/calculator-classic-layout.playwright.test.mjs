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
    const firstInput = await bounds(
      page,
      '[data-testid="calculator-inputs"] input.w-full',
    );
    const resultsPanel = await bounds(page, "#results-sidebar-panel");
    t.diagnostic(
      `1440x900 CSS px: section-nav button x=${sectionNav.x.toFixed(1)} w=${sectionNav.width.toFixed(1)}, first input x=${firstInput.x.toFixed(1)} w=${firstInput.width.toFixed(1)}, results x=${resultsPanel.x.toFixed(1)} w=${resultsPanel.width.toFixed(1)}`,
    );

    closeTo(sectionNav.x, 234, 8, "section nav x");
    closeTo(sectionNav.width, 123, 6, "section nav width");
    closeTo(firstInput.x, 401, 8, "first form input x");
    closeTo(firstInput.width, 499, 25, "first form input width");
    closeTo(resultsPanel.x, 954, 8, "results panel x");
    closeTo(resultsPanel.width, 320, 16, "results panel width");
    assert.ok(
      resultsPanel.right <= 1274 + 8,
      "results rail stays in its content lane",
    );
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
