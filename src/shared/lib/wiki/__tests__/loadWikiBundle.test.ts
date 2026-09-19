import { beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/shared/i18n/i18n";
import { loadWikiBundle } from "../loadWikiBundle";
import { wikiArticles } from "../wikiArticles";

// The glob seam is mocked, not the pipeline: these tests exercise the
// filter / sort / fallback / reshape logic of loadWikiBundle against a
// controlled record, while wikiArticles.test.ts covers the real glob.
//
// Orders are deliberately shuffled vs. the key order (and vs. the seeds) so a
// passing sort cannot be confused with glob ordering.
vi.mock("@/shared/lib/wiki/wikiArticles", () => ({
  wikiArticles: {
    "/docs/wiki/pt-BR/calculadora.md": vi.fn(() =>
      Promise.resolve({
        slug: "calculadora",
        locale: "pt-BR",
        frontmatter: { title: "Calculadora", order: 3 },
        toc: [{ depth: 1, text: "Calculadora", slug: "user-content-calculadora" }],
        html: "<h1>Calculadora</h1>",
      }),
    ),
    "/docs/wiki/pt-BR/inventario.md": vi.fn(() =>
      Promise.resolve({
        slug: "inventario",
        locale: "pt-BR",
        frontmatter: { title: "Inventário", order: 1 },
        toc: [{ depth: 1, text: "Inventário", slug: "user-content-inventario" }],
        html: "<h1>Inventário</h1>",
      }),
    ),
    "/docs/wiki/pt-BR/orcamentos.md": vi.fn(() =>
      Promise.resolve({
        slug: "orcamentos",
        locale: "pt-BR",
        frontmatter: { title: "Orçamentos", order: 2 },
        toc: [{ depth: 1, text: "Orçamentos", slug: "user-content-orcamentos" }],
        html: "<h1>Orçamentos</h1>",
      }),
    ),
    "/docs/wiki/en-US/calculadora.md": vi.fn(() =>
      Promise.resolve({
        slug: "calculadora",
        locale: "en-US",
        frontmatter: { title: "Calculator", order: 2 },
        toc: [{ depth: 1, text: "Calculator", slug: "user-content-calculator" }],
        html: "<h1>Calculator</h1>",
      }),
    ),
    "/docs/wiki/en-US/inventario.md": vi.fn(() =>
      Promise.resolve({
        slug: "inventario",
        locale: "en-US",
        frontmatter: { title: "Inventory", order: 3 },
        toc: [{ depth: 1, text: "Inventory", slug: "user-content-inventory" }],
        html: "<h1>Inventory</h1>",
      }),
    ),
    "/docs/wiki/en-US/orcamentos.md": vi.fn(() =>
      Promise.resolve({
        slug: "orcamentos",
        locale: "en-US",
        frontmatter: { title: "Quotes", order: 1 },
        toc: [{ depth: 1, text: "Quotes", slug: "user-content-quotes" }],
        html: "<h1>Quotes</h1>",
      }),
    ),
  },
}));

// Same fixture, keyed by path, so a test can assert which locale was fetched.
const loaders = wikiArticles;

describe("loadWikiBundle", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // The fallback reads i18n.resolvedLanguage; pin it per test. pt-BR is the
    // app default and the app's fallbackLng.
    await i18n.changeLanguage("pt-BR");
  });

  it("returns only the requested locale's articles", async () => {
    const bundle = await loadWikiBundle("pt-BR");

    expect(Object.keys(bundle).sort()).toEqual([
      "calculadora",
      "inventario",
      "orcamentos",
    ]);
  });

  it("sorts articles by frontmatter.order, not by glob key order", async () => {
    const bundle = await loadWikiBundle("pt-BR");

    // Glob keys are calculadora, inventario, orcamentos; orders are 3, 1, 2.
    expect(Object.keys(bundle)).toEqual(["inventario", "orcamentos", "calculadora"]);
    expect(bundle.inventario.order).toBe(1);
    expect(bundle.calculadora.order).toBe(3);
  });

  it("never fetches the other locale's chunks (lazy per locale)", async () => {
    await loadWikiBundle("pt-BR");

    for (const [path, load] of Object.entries(loaders)) {
      if (path.includes("/pt-BR/")) expect(load).toHaveBeenCalledOnce();
      else expect(load).not.toHaveBeenCalled();
    }
  });

  it("reshapes each module into the nested-by-slug article", async () => {
    const bundle = await loadWikiBundle("pt-BR");

    expect(bundle.calculadora).toEqual({
      title: "Calculadora",
      order: 3,
      toc: [{ depth: 1, text: "Calculadora", slug: "user-content-calculadora" }],
      html: "<h1>Calculadora</h1>",
    });
    // Module identity fields do not leak into the namespace.
    expect("slug" in bundle.calculadora).toBe(false);
    expect("locale" in bundle.calculadora).toBe(false);
    expect("frontmatter" in bundle.calculadora).toBe(false);
  });

  it("loads en-US articles with the same slug keys", async () => {
    const bundle = await loadWikiBundle("en-US");

    expect(Object.keys(bundle).sort()).toEqual([
      "calculadora",
      "inventario",
      "orcamentos",
    ]);
    // en-US orders are 2, 3, 1.
    expect(Object.keys(bundle)).toEqual(["orcamentos", "calculadora", "inventario"]);
    expect(bundle.inventario.title).toBe("Inventory");
  });

  it("falls back to pt-BR for an uncovered locale when the app is pt-BR", async () => {
    await i18n.changeLanguage("pt-BR");

    const bundle = await loadWikiBundle("es-ES");

    expect(bundle.inventario.title).toBe("Inventário");
    for (const [path, load] of Object.entries(loaders)) {
      if (path.includes("/pt-BR/")) expect(load).toHaveBeenCalledOnce();
      else expect(load).not.toHaveBeenCalled();
    }
  });

  it("falls back to en-US for an uncovered locale when the app is en-US", async () => {
    await i18n.changeLanguage("en-US");

    const bundle = await loadWikiBundle("es-ES");

    expect(bundle.inventario.title).toBe("Inventory");
    for (const [path, load] of Object.entries(loaders)) {
      if (path.includes("/en-US/")) expect(load).toHaveBeenCalledOnce();
      else expect(load).not.toHaveBeenCalled();
    }
  });
});
