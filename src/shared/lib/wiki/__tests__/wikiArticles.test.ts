import { describe, expect, it } from "vitest";

import { wikiArticles } from "../wikiArticles";

// Integration guard: this file does NOT mock the glob. It runs the real
// `import.meta.glob` through Vite's transform pipeline (the markdownWikiPlugin
// is registered in vite.base.config.ts, which vitest.config.ts merges), so it
// is the only test that catches a wrong glob pattern or a plugin that stopped
// transforming under Vitest — the mocked unit tests cannot see either.

const SEED_SLUGS = ["calculadora", "inventario", "orcamentos"];
const LOCALES = ["pt-BR", "en-US"];

describe("wikiArticles glob (real, unmocked)", () => {
  it("discovers every seeded article of every locale", () => {
    const keys = Object.keys(wikiArticles);

    expect(keys).toHaveLength(LOCALES.length * SEED_SLUGS.length);
    for (const locale of LOCALES) {
      for (const slug of SEED_SLUGS) {
        expect(keys).toContain(`/docs/wiki/${locale}/${slug}.md`);
      }
    }
  });

  it("compiles each article into the module shape loadWikiBundle consumes", async () => {
    const modules = await Promise.all(
      Object.values(wikiArticles).map((load) => load()),
    );

    for (const article of modules) {
      // Identity comes from the path, not the markdown body.
      expect(LOCALES).toContain(article.locale);
      expect(SEED_SLUGS).toContain(article.slug);
      expect(article.locale).toMatch(/^(pt-BR|en-US)$/);

      // Frontmatter is the flat fail-closed schema from markdownToHtml.
      expect(typeof article.frontmatter.title).toBe("string");
      expect(article.frontmatter.title.length).toBeGreaterThan(0);
      expect(article.frontmatter.order).toBeGreaterThanOrEqual(1);

      // Compile-time output: headings carry slug ids, body is real HTML.
      expect(article.html).toContain("<h1");
      expect(article.toc.length).toBeGreaterThan(0);
      expect(article.toc.every((item) => item.slug.length > 0)).toBe(true);
    }
  });

  it("keeps slug and order parity between locales (R6)", async () => {
    const byLocale: Record<string, Map<string, number>> = {};
    for (const [key, load] of Object.entries(wikiArticles)) {
      const article = await load();
      const locale = key.split("/")[3];
      if (!(locale in byLocale)) byLocale[locale] = new Map();
      byLocale[locale].set(article.slug, article.frontmatter.order);
    }

    const ptBR = byLocale["pt-BR"];
    const enUS = byLocale["en-US"];
    expect(ptBR).toBeDefined();
    expect(enUS).toBeDefined();
    // Same slugs, same order — content parity is what makes the locale
    // fallback safe.
    expect([...ptBR.keys()].sort()).toEqual([...enUS.keys()].sort());
    for (const [slug, order] of ptBR) {
      expect(enUS.get(slug)).toBe(order);
    }
  });
});
