import { chromium } from "playwright";
const EXE =
  "/home/ils15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1999, height: 1030 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
page.on(
  "console",
  (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)),
);
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(6000);
for (let i = 0; i < 4; i++) {
  const b = page
    .locator('button[aria-label*="echar"], button:has-text("Entendi")')
    .first();
  if (await b.count().catch(() => 0)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(300);
  } else break;
}
await page.locator('input[type="number"]').first().fill("50");
await page.waitForTimeout(1200);
// ROI card present in section 2
const roi = await page.evaluate(() => {
  const el = document.querySelector('[data-testid="printer-roi"]');
  return {
    present: !!el,
    text: el?.textContent?.replace(/\s+/g, " ").slice(0, 120) ?? null,
  };
});
// expand it
await page.evaluate(() =>
  document.querySelector('[data-testid="printer-roi"] button')?.click(),
);
await page.waitForTimeout(500);
const roiOpen = await page.evaluate(
  () =>
    document
      .querySelector('[data-testid="printer-roi"] [id="printer-roi-panel"]')
      ?.textContent?.replace(/\s+/g, " ")
      .slice(0, 180) ?? null,
);
await page.evaluate(() =>
  document
    .querySelector('[data-testid="printer-roi"]')
    ?.scrollIntoView({ block: "center" }),
);
await page.screenshot({ path: "/tmp/roi-open.png" });
// green proposal CTA in results
await page.evaluate(() =>
  document
    .querySelector('[data-shortcut="export"]')
    ?.scrollIntoView({ block: "center" }),
);
await page.waitForTimeout(600);
const cta = await page.evaluate(() => {
  const btn = document.querySelector('[data-shortcut="export"]');
  if (!btn) return { found: false };
  const bg = getComputedStyle(btn).backgroundColor;
  return {
    found: true,
    bg,
    label: btn.textContent?.trim().slice(0, 50),
    minH: getComputedStyle(btn).minHeight,
  };
});
console.log(
  JSON.stringify({ roi, roiOpen, cta, errors: errors.slice(0, 3) }, null, 1),
);
await browser.close();
