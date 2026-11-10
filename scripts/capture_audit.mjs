import { chromium } from "playwright";

const artifactDir = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/56c40ddf-67b4-438c-b119-655f77ab2c78";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
    colorScheme: "dark",
  });
  const page = await context.newPage();

  await page.goto("http://127.0.0.1:3000/", { waitUntil: "networkidle" });

  // Dismiss consent if present
  const consent = page.getByRole("button", { name: "Entendi e quero continuar" });
  if (await consent.isVisible()) {
    await consent.click();
    await page.waitForTimeout(300);
  }

  // 1. Calculator view (default)
  await page.screenshot({ path: `${artifactDir}/audit_ui_01_calculator.png` });

  // 2. Switch to Bento mode
  const bentoBtn = page.getByRole("button", { name: /Bento/i });
  if (await bentoBtn.isVisible()) {
    await bentoBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/audit_ui_02_bento.png` });
  }

  // 3. Dashboard
  const dashBtn = page.getByRole("button", { name: /Dashboard/i }).first();
  if (await dashBtn.isVisible()) {
    await dashBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/audit_ui_03_dashboard.png` });
  }

  // 4. Workshop (Minha Oficina)
  const workshopBtn = page.getByRole("button", { name: /Minha Oficina|Oficina/i }).first();
  if (await workshopBtn.isVisible()) {
    await workshopBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/audit_ui_04_workshop.png` });
  }

  // 5. Quotes (Orçamentos)
  const quotesBtn = page.getByRole("button", { name: /Orçamentos/i }).first();
  if (await quotesBtn.isVisible()) {
    await quotesBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/audit_ui_05_quotes.png` });
  }

  // 6. Customers (Clientes)
  const custBtn = page.getByRole("button", { name: /Clientes/i }).first();
  if (await custBtn.isVisible()) {
    await custBtn.click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${artifactDir}/audit_ui_06_customers.png` });
  }

  await browser.close();
  console.log("Screenshots captured successfully.");
}

main().catch(console.error);
