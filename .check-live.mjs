import { chromium } from "playwright";
const EXE =
  "/home/ils15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("https://ils15.github.io/open3dcalc/beta/", {
  waitUntil: "domcontentloaded",
});
await page.waitForTimeout(5000);
for (let i = 0; i < 3; i++) {
  const b = page
    .locator('button[aria-label*="echar"], button:has-text("Entendi")')
    .first();
  if (await b.count().catch(() => 0)) {
    await b.click().catch(() => {});
    await page.waitForTimeout(400);
  } else break;
}
const data = await page.evaluate(() => {
  const nav = [...document.querySelectorAll("aside button, aside a")]
    .map((e) => (e.textContent || "").trim())
    .filter(Boolean);
  const body = document.body.innerText;
  return {
    nav: nav.slice(0, 16),
    oldNavPresent: ["Cadastros", "Insumos", "Marketplace"].map((n) => ({
      n,
      present: nav.some((x) => x === n),
    })),
    newNavPresent: ["Minha Oficina"].map((n) => ({
      n,
      present: nav.some((x) => x === n),
    })),
    hardcodedMiniDash: /3\.737|2\/6|2 baixos/.test(body),
    workshopHubTabs: [...document.querySelectorAll('[role="tab"]')]
      .map((e) => e.textContent?.trim())
      .slice(0, 8),
  };
});
await page.screenshot({ path: "/tmp/live-beta.png" });
console.log(JSON.stringify(data, null, 1));
await browser.close();
