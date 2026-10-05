import assert from "node:assert/strict";
import { after, test } from "node:test";
import { chromium } from "playwright";

const url = process.env.STUDIO_PREVIEW_URL ?? "http://127.0.0.1:3000/";
const browser = await chromium.launch({ headless: true });

after(async () => {
  await browser.close();
});

async function openCatalog(page) {
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("header");

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

  await page.getByRole("button", { name: "Cadastros" }).first().click();
  await page.waitForFunction(() =>
    globalThis.document
      .querySelector("header")
      ?.textContent?.includes("Frota de Impressoras"),
  );
  await page.waitForTimeout(350);
}

test("StudioHeader fits the full document at mobile and desktop widths", async (t) => {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
    });
    try {
      const page = await context.newPage();
      const browserErrors = [];
      const failedResponses = [];
      page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      page.on("pageerror", (error) => browserErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) {
          failedResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      await openCatalog(page);

      for (const colorScheme of ["light", "dark"]) {
        await page.emulateMedia({ colorScheme });
        await page.waitForFunction(
          (theme) =>
            globalThis.document.documentElement.classList.contains(theme),
          colorScheme === "dark" ? "dark" : "light",
        );
        const layout = await page.evaluate(() => {
          const header = globalThis.document.querySelector("header");
          const actions = header?.children[2];
          return {
            scrollWidth: globalThis.document.documentElement.scrollWidth,
            viewportWidth: globalThis.window.innerWidth,
            actionGap: actions
              ? globalThis.getComputedStyle(actions).columnGap
              : null,
            theme: globalThis.document.documentElement.classList.contains(
              "dark",
            )
              ? "dark"
              : "light",
          };
        });

        assert.ok(
          layout.scrollWidth <= width,
          `${width}px ${colorScheme} viewport overflow: document scrollWidth=${layout.scrollWidth}`,
        );
        assert.equal(layout.theme, colorScheme);
        if (width >= 640) assert.equal(layout.actionGap, "8px");
        t.diagnostic(
          `${width}px ${colorScheme}: document=${layout.scrollWidth}px, viewport=${layout.viewportWidth}px, action gap=${layout.actionGap}`,
        );
      }
      assert.deepEqual(browserErrors, [], `${width}px console errors`);
      assert.deepEqual(failedResponses, [], `${width}px failed HTTP responses`);
    } finally {
      await context.close();
    }
  }
});

test("localized Cadastros tabs, keyboard search, and CRUD work in the browser", async (t) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
  });
  const browserErrors = [];
  const failedResponses = [];
  try {
    const page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    await openCatalog(page);
    const main = page.getByRole("main");

    assert.match(await main.innerText(), /Cadastros Gerais da Oficina/);
    await main.getByRole("tab", { name: "Materiais" }).click();
    const materialSearch = main.getByRole("searchbox", {
      name: "Buscar materiais por nome",
    });
    await materialSearch.fill("no-such-material");
    const clearSearch = main.getByRole("button", { name: "Limpar busca" });
    await materialSearch.focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await clearSearch.evaluate(
        (button) => button === globalThis.document.activeElement,
      ),
      true,
    );
    assert.match(
      await clearSearch.getAttribute("class"),
      /focus-visible:ring-2/,
    );
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () =>
        globalThis.document.querySelector('main input[type="search"]')
          ?.value === "",
    );

    await main.getByLabel("Nome do material").fill("Playwright Material");
    await main.getByLabel("Densidade").fill("1.25");
    await main.getByLabel("Preço médio").fill("120");
    await main.getByRole("button", { name: "Salvar", exact: true }).click();
    const materialCard = main.getByRole("article", {
      name: /Playwright Material/,
    });
    await materialCard.waitFor();
    await materialCard.getByRole("button", { name: "Remover" }).click();
    await materialCard.waitFor({ state: "detached" });

    await main.getByRole("tab", { name: "Taxas e Canais" }).click();
    await main.getByLabel("Nome da loja").fill("Playwright Marketplace");
    await main.getByLabel("Taxa %").fill("8");
    await main.getByLabel("Taxa fixa").fill("1.5");
    await main.getByRole("button", { name: "Salvar", exact: true }).click();
    const marketplaceCard = main.getByRole("article", {
      name: /Playwright Marketplace/,
    });
    await marketplaceCard.waitFor();
    await marketplaceCard.getByRole("button", { name: "Remover" }).click();
    await marketplaceCard.waitFor({ state: "detached" });

    await main.getByRole("tab", { name: "Impressoras" }).click();
    const printerSearch = main.getByRole("searchbox", {
      name: "Buscar impressora por nome ou marca",
    });
    await printerSearch.fill("A1 Mini");
    const printerCard = main.getByRole("article", { name: /A1 Mini/ }).first();
    await printerCard
      .getByRole("button", { name: "Editar Impressora" })
      .click();
    const editor = page.getByRole("dialog", { name: "Editar Impressora" });
    await editor.getByLabel("Nome").fill("A1 Mini Playwright");
    await editor.getByRole("button", { name: "Salvar Alterações" }).click();
    await main.getByRole("article", { name: /A1 Mini Playwright/ }).waitFor();

    assert.deepEqual(
      browserErrors,
      [],
      "browser console errors during catalog flow",
    );
    assert.deepEqual(
      failedResponses,
      [],
      "failed HTTP responses during catalog flow",
    );
    t.diagnostic(
      "pt-BR tabs, search clear keyboard focus, material/fees-and-channels create-delete, and printer edit passed",
    );
  } finally {
    await context.close();
  }
});
