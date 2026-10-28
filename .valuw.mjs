import { chromium } from "playwright";
const EXE =
  "/home/ils15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const browser = await chromium.launch({
  executablePath: EXE,
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 3440, height: 840 } });
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
// main content width vs viewport (cap working?)
const calc = await page.evaluate(() => {
  const main = document.querySelector("main");
  const r = main?.getBoundingClientRect();
  return {
    viewport: 3440,
    mainWidth: Math.round(r?.width ?? 0),
    centered: main ? Math.abs((r.left + r.right) / 2 - 3440 / 2) < 4 : null,
  };
});
await page.screenshot({ path: "/tmp/uw-calc.png" });
// workshop: collections toggles
await page.evaluate(() => {
  [...document.querySelectorAll("aside button, aside a")]
    .find((b) => /Minha Oficina/i.test(b.textContent || ""))
    ?.click();
});
await page.waitForTimeout(1500);
await page.evaluate(() => {
  [...document.querySelectorAll('[role="tab"]')]
    .find((b) => /Materiais/.test(b.textContent || ""))
    ?.click();
});
await page.waitForTimeout(1500);
const materials = await page.evaluate(() => {
  const txt = document.querySelector("main")?.innerText ?? "";
  return {
    toggle: /Meus materiais/.test(txt) && /Biblioteca de materiais/.test(txt),
    counts: /\(\d+\)/.test(txt),
  };
});
await page.screenshot({ path: "/tmp/uw-materials.png" });
await page.evaluate(() => {
  [...document.querySelectorAll('[role="tab"]')]
    .find((b) => /Lojas e canais/.test(b.textContent || ""))
    ?.click();
});
await page.waitForTimeout(1500);
const marketplaces = await page.evaluate(() => {
  const txt = document.querySelector("main")?.innerText ?? "";
  return { toggle: /Meus canais/.test(txt) && /Modelos do catálogo/.test(txt) };
});
await page.screenshot({ path: "/tmp/uw-marketplaces.png" });
console.log(
  JSON.stringify(
    { calc, materials, marketplaces, errors: errors.slice(0, 3) },
    null,
    1,
  ),
);
await browser.close();
