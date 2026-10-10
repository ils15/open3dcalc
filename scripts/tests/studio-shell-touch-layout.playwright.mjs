import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chromium } from "playwright";

const url =
  process.env.STUDIO_PREVIEW_URL ?? "http://127.0.0.1:4173/index.web.html";
const browser = await chromium.launch({ headless: true });

after(async () => {
  await browser.close();
});

async function openStudio(context) {
  const page = await context.newPage();
  const errors = [];
  const failedResponses = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.locator("header").waitFor();
  const consent = page.getByRole("button", {
    name: "Entendi e quero continuar",
  });
  if (await consent.isVisible()) await consent.click();
  await page.waitForTimeout(100);

  return { page, errors, failedResponses };
}

async function measureVisibleTargets(locator) {
  return locator.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = globalThis.getComputedStyle(element);
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none"
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.textContent?.trim() ||
            element.id ||
            element.tagName.toLowerCase(),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
  );
}

test("Studio and labeled-section controls provide 44px touch targets", async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  try {
    const { page, errors, failedResponses } = await openStudio(context);
    const groups = {
      header: await measureVisibleTargets(page.locator("header button")),
      subheader: await measureVisibleTargets(
        page.locator("header + div button"),
      ),
      dock: await measureVisibleTargets(
        page.locator(".fixed.inset-x-0.bottom-4 button"),
      ),
      sectionInputs: await measureVisibleTargets(
        page.locator("section[aria-label] input"),
      ),
      sectionButtons: await measureVisibleTargets(
        page.locator("section[aria-label] button"),
      ),
    };
    const undersized = Object.entries(groups).flatMap(([group, targets]) =>
      targets
        .filter((target) => target.width < 44 || target.height < 44)
        .map(
          (target) =>
            `${group}: ${target.label} ${target.width}x${target.height}`,
        ),
    );

    assert.deepEqual(undersized, [], "visible controls below a 44px target");
    assert.deepEqual(errors, [], "browser console errors");
    assert.deepEqual(failedResponses, [], "failed browser requests");
  } finally {
    await context.close();
  }
});

test("the declared favicon resolves successfully from the served app base", async () => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  try {
    const { page, errors, failedResponses } = await openStudio(context);
    const favicon = page.locator('link[rel="icon"]');
    const href = await favicon.getAttribute("href");
    assert.ok(href, "the document declares a favicon");
    const response = await page.request.get(
      new URL(href, page.url()).toString(),
    );
    assert.equal(response.status(), 200);
    assert.match(response.headers()["content-type"] ?? "", /image\/svg\+xml/);
    assert.deepEqual(errors, [], "browser console errors");
    assert.deepEqual(failedResponses, [], "failed browser requests");
  } finally {
    await context.close();
  }
});

test("desktop and mobile shells stay within the viewport in both themes", async () => {
  for (const width of [1440, 390]) {
    for (const colorScheme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 390 ? 844 : 900 },
        colorScheme,
      });
      try {
        const { page, errors, failedResponses } = await openStudio(context);
        const layout = await page.evaluate(() => ({
          scrollWidth: globalThis.document.documentElement.scrollWidth,
          layoutWidth: globalThis.document.documentElement.clientWidth,
          viewportWidth: globalThis.window.innerWidth,
          theme: globalThis.document.documentElement.classList.contains("dark")
            ? "dark"
            : "light",
        }));
        assert.ok(
          layout.scrollWidth <= layout.layoutWidth,
          `${width}px ${colorScheme}: document overflows ${layout.scrollWidth}px of ${layout.layoutWidth}px`,
        );
        assert.equal(layout.theme, colorScheme);
        assert.deepEqual(
          errors,
          [],
          `${width}px ${colorScheme} console errors`,
        );
        assert.deepEqual(
          failedResponses,
          [],
          `${width}px ${colorScheme} failed browser requests`,
        );
      } finally {
        await context.close();
      }
    }
  }
});

test("390px layout keeps header actions and scrollable tabs reachable above the dock", async () => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  });
  try {
    const { page, errors, failedResponses } = await openStudio(context);
    const headerLayout = await page.evaluate(() => {
      const header = globalThis.document.querySelector("header");
      const breadcrumb = header?.children[0]?.getBoundingClientRect();
      const actions = header?.children[2]?.getBoundingClientRect();
      const headerBox = header?.getBoundingClientRect();
      return {
        scrollWidth: globalThis.document.documentElement.scrollWidth,
        viewportWidth: globalThis.document.documentElement.clientWidth,
        headerHeight: headerBox?.height,
        justifyContent: header
          ? globalThis.getComputedStyle(header).justifyContent
          : "",
        breadcrumbRight: breadcrumb?.right,
        actionsLeft: actions?.left,
        actionsRight: actions?.right,
      };
    });
    assert.ok(
      headerLayout.scrollWidth <= headerLayout.viewportWidth,
      `document overflows: ${headerLayout.scrollWidth}px > ${headerLayout.viewportWidth}px`,
    );
    assert.equal(headerLayout.headerHeight, 48);
    assert.equal(headerLayout.justifyContent, "space-between");
    assert.ok(
      (headerLayout.breadcrumbRight ?? 0) <= (headerLayout.actionsLeft ?? 0),
      "breadcrumb overlaps the fixed-size action group",
    );
    assert.ok((headerLayout.actionsRight ?? Infinity) <= 390);

    const tabRail = page.locator("header + div > div").first();
    const railLayout = await tabRail.evaluate((rail) => ({
      clientWidth: rail.clientWidth,
      scrollWidth: rail.scrollWidth,
      overflowX: globalThis.getComputedStyle(rail).overflowX,
      tabCount: rail.querySelectorAll(":scope > button").length,
    }));
    assert.ok(railLayout.scrollWidth > railLayout.clientWidth);
    assert.equal(railLayout.overflowX, "auto");
    assert.ok(railLayout.tabCount >= 10);
    const clippedTabs = await tabRail.evaluateAll((rails) => {
      const rail = rails[0];
      return Array.from(rail.querySelectorAll("button"))
        .filter((button) => button.getBoundingClientRect().height > 0)
        .filter((button) => button.scrollWidth > button.clientWidth + 1)
        .map((button) => button.textContent?.trim());
    });
    assert.deepEqual(
      clippedTabs,
      [],
      "tab labels fit their scrollable controls",
    );
    await tabRail.evaluate((rail) => {
      rail.scrollLeft = rail.scrollWidth;
    });
    const lastTab = tabRail.locator(":scope > button").last();
    await lastTab.waitFor();
    const lastTabLayout = await lastTab.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const rail = button.parentElement?.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        railLeft: rail?.left,
        railRight: rail?.right,
      };
    });
    assert.ok(lastTabLayout.left >= (lastTabLayout.railLeft ?? Infinity));
    assert.ok(lastTabLayout.right <= (lastTabLayout.railRight ?? -Infinity));

    const dockRow = page.locator(
      ".fixed.inset-x-0.bottom-4 > div.pointer-events-auto",
    );
    const dockLayout = await dockRow.evaluate((dock) => ({
      clientWidth: dock.clientWidth,
      scrollWidth: dock.scrollWidth,
      overflowX: globalThis.getComputedStyle(dock).overflowX,
      buttonCount: dock.querySelectorAll("button").length,
    }));
    assert.equal(dockLayout.overflowX, "auto");
    assert.equal(dockLayout.buttonCount, 4);
    if (dockLayout.scrollWidth > dockLayout.clientWidth) {
      await dockRow.evaluate((dock) => {
        dock.scrollLeft = dock.scrollWidth;
      });
      const lastDockButton = dockRow.locator("button").last();
      const lastDockButtonLayout = await lastDockButton.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const row = button.parentElement?.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          rowLeft: row?.left,
          rowRight: row?.right,
        };
      });
      assert.ok(
        lastDockButtonLayout.left >= (lastDockButtonLayout.rowLeft ?? Infinity),
      );
      assert.ok(
        lastDockButtonLayout.right <=
          (lastDockButtonLayout.rowRight ?? -Infinity),
      );
    }

    assert.ok(
      await page.locator(".fixed.inset-x-0.bottom-4").count(),
      "studio dock is rendered",
    );
    await page.evaluate(() =>
      globalThis.window.scrollTo(
        0,
        globalThis.document.documentElement.scrollHeight,
      ),
    );
    const bottomLayout = await page.evaluate(() => {
      const dock = globalThis.document.querySelector(
        ".fixed.inset-x-0.bottom-4",
      );
      const main = globalThis.document.querySelector("main");
      const dockRect = dock?.getBoundingClientRect();
      const controls = Array.from(
        main?.querySelectorAll("button, a, input") ?? [],
      )
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const visibleControls = controls.filter(
        (rect) => rect.bottom > 0 && rect.top < globalThis.window.innerHeight,
      );
      const lowest = visibleControls.sort((a, b) => b.bottom - a.bottom)[0];
      const textRects = Array.from(
        main?.querySelectorAll("h1, h2, h3, label, p, span") ?? [],
      )
        .filter((element) => element.textContent?.trim())
        .map((element) => ({
          text: element.textContent?.trim(),
          rect: element.getBoundingClientRect(),
        }))
        .filter(
          ({ rect }) =>
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > (dockRect?.top ?? Infinity) &&
            rect.top < (dockRect?.bottom ?? -Infinity),
        )
        .map(({ text, rect }) => ({
          text,
          top: rect.top,
          bottom: rect.bottom,
        }));
      return {
        dockTop: dockRect?.top,
        contentBottom: lowest?.bottom ?? null,
        obscuredLabels: textRects,
        dockHeight: dockRect?.height ?? 0,
        dockBottomGap:
          globalThis.window.innerHeight -
          (dockRect?.bottom ?? globalThis.window.innerHeight),
        mainPaddingBottom: Number.parseFloat(
          globalThis.getComputedStyle(main).paddingBottom,
        ),
      };
    });
    assert.deepEqual(
      bottomLayout.obscuredLabels,
      [],
      "fixed dock covers workspace navigation or content labels",
    );
    assert.ok(
      bottomLayout.mainPaddingBottom >=
        bottomLayout.dockHeight + bottomLayout.dockBottomGap,
      "workspace scroll padding does not clear the fixed dock",
    );
    if (bottomLayout.contentBottom !== null) {
      assert.ok(
        bottomLayout.contentBottom <= (bottomLayout.dockTop ?? -Infinity),
        `dock overlaps the last visible workspace control (${bottomLayout.contentBottom}px > ${bottomLayout.dockTop}px)`,
      );
    }

    assert.ok(await page.locator("html.dark").count());
    assert.deepEqual(errors, [], "browser console errors");
    assert.deepEqual(failedResponses, [], "failed browser requests");
  } finally {
    await context.close();
  }
});
