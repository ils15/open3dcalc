// Generates the 25 dangling printer brand-card PNGs as ORIGINAL artwork:
// flat brand-color band + wordmark + model name (no manufacturer logos).
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const src = readFileSync("src/shared/lib/printers.ts", "utf-8");
const entries = [
  ...src.matchAll(
    /id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*brand:\s*"([^"]+)",[\s\S]*?image:\s*"([^"]+)",[\s\S]*?technology:\s*"([^"]+)"/,
  ),
]
  .map((m) => ({ id: m[1], name: m[2], brand: m[3], image: m[4], tech: m[5] }))
  .filter((e) => e.image.includes("/brands/"));

const BRAND_COLORS = {
  "Bambu Lab": "#00AE42",
  Creality: "#E60012",
  Anycubic: "#0057A8",
  Prusa: "#FF6A1F",
  Elegoo: "#0ABF8F",
  Flashforge: "#1B6BD6",
  Sovol: "#2F7DF6",
};

const cards = entries.map((e) => {
  const color = BRAND_COLORS[e.brand] ?? "#334155";
  const slug = e.image;
  return { ...e, color, slug };
});

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; background: #1a1c24; padding: 24px; }
  .card {
    width: 600px; height: 420px; margin: 0 24px 24px 0; display: inline-block;
    vertical-align: top; background: #f8fafc; border-radius: 10px; overflow: hidden;
    border: 1px solid #cbd5e1; position: relative;
  }
  .band { height: 132px; background: var(--c); display: flex; align-items: center; padding: 0 28px; }
  .brand { color: #fff; font-size: 34px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }
  .body { padding: 24px 28px; }
  .model { font-size: 38px; font-weight: 800; color: #0f172a; line-height: 1.15; word-break: break-word; }
  .chip { display: inline-block; margin-top: 14px; padding: 4px 12px; border-radius: 4px;
          background: #e2e8f0; color: #334155; font-size: 18px; font-weight: 700; }
  .glyph { position: absolute; right: 24px; bottom: 20px; width: 96px; height: 72px;
           border: 3px solid #cbd5e1; border-radius: 6px; }
  .glyph::before { content: ""; position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
           width: 40px; height: 10px; background: #cbd5e1; border-radius: 2px; }
  .glyph::after { content: ""; position: absolute; top: 26px; left: 14px; right: 14px; height: 30px;
           background: #e2e8f0; border-radius: 4px; }
  .foot { position: absolute; left: 28px; bottom: 18px; font-size: 15px; color: #94a3b8; font-weight: 600; }
</style></head><body>
${cards
  .map(
    (c) => `<div class="card" id="${c.slug}" style="--c: ${c.color}">
      <div class="band"><span class="brand">${c.brand}</span></div>
      <div class="body">
        <div class="model">${c.name}</div>
        <span class="chip">${c.tech.toUpperCase()}</span>
      </div>
      <div class="glyph"></div>
      <div class="foot">Open3DCalc · arte original</div>
    </div>`,
  )
  .join("\n")}
</body></html>`;

const browser = await chromium.launch({
  executablePath:
    "/home/ils15/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });

for (const c of cards) {
  const path = "public" + c.slug;
  mkdirSync(dirname(path), { recursive: true });
  await page.locator(`#${CSS.escape(c.slug.replace(/\//g, ""))}`).screenshot({
    path,
    type: "png",
  });
  console.log("ok", path);
}
await browser.close();
