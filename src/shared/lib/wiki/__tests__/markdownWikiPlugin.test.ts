import { createServer } from "vite";
import path from "node:path";

import { markdownWikiPlugin } from "../../../../../vite/plugins/markdownWikiPlugin";
import type { WikiArticleModule } from "../../../../../vite/plugins/markdownWikiPlugin";

const LOCALES = ["pt-BR", "en-US"] as const;
const SEED_SLUGS = ["calculadora", "inventario", "orcamentos"] as const;
const ROOT = process.cwd();

function articlePath(locale: string, slug: string, query = ""): string {
  return path.resolve(ROOT, "docs", "wiki", locale, `${slug}.md${query}`);
}

async function loadArticle(
  server: Awaited<ReturnType<typeof createServer>>,
  locale: string,
  slug: string,
  query = "",
): Promise<WikiArticleModule> {
  return (await server.ssrLoadModule(
    articlePath(locale, slug, query),
  )) as WikiArticleModule;
}

describe("markdownWikiPlugin", () => {
  const plugin = markdownWikiPlugin();
  // The Vite plugin type allows the object form of the hook; the implementation
  // is a plain function, so narrow it once for direct unit-level calls.
  const transform = plugin.transform as (
    code: string,
    id: string,
  ) => { code: string; map: null } | null;
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeAll(async () => {
    server = await createServer({
      configFile: false,
      root: ROOT,
      logLevel: "error",
      plugins: [markdownWikiPlugin()],
      server: { middlewareMode: true },
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it("compiles each real seed article into a full module", async () => {
    for (const locale of LOCALES) {
      for (const slug of SEED_SLUGS) {
        const mod = await loadArticle(server, locale, slug);

        expect(mod.slug).toBe(slug);
        expect(mod.locale).toBe(locale);
        expect(typeof mod.frontmatter.title).toBe("string");
        expect(mod.frontmatter.title.trim()).not.toBe("");
        expect(typeof mod.frontmatter.order).toBe("number");
        expect(mod.toc.length).toBeGreaterThan(0);
        // Headings survive with rehype-slug ids, which the TOC points at.
        expect(mod.html).toContain("<h1");
        expect(mod.html).toContain('id="user-content-');
        expect(mod.html).not.toContain("<script");
      }
    }
  });

  it("keeps slug and order parity across locales", async () => {
    const byLocale = await Promise.all(
      LOCALES.map(async (locale) => {
        const mods = await Promise.all(
          SEED_SLUGS.map((slug) => loadArticle(server, locale, slug)),
        );
        return { locale, mods };
      }),
    );

    // Same article set in every locale, identified by slug.
    const firstSlugs = byLocale[0].mods.map((mod) => mod.slug).sort();
    for (const { mods } of byLocale) {
      expect(mods.map((mod) => mod.slug).sort()).toEqual(firstSlugs);
    }
    // Ordering must not drift between locales: the index is shared.
    const ordersBySlug = new Map(
      byLocale[0].mods.map((mod) => [mod.slug, mod.frontmatter.order]),
    );
    expect(ordersBySlug.size).toBe(SEED_SLUGS.length);
    for (const { mods } of byLocale) {
      for (const mod of mods) {
        expect(mod.frontmatter.order).toBe(ordersBySlug.get(mod.slug));
      }
    }
  });

  it("emits frontmatter only for the ?wiki-meta query", async () => {
    const mod = (await server.ssrLoadModule(
      articlePath("pt-BR", "calculadora", "?wiki-meta"),
    )) as Partial<WikiArticleModule>;

    expect(mod.frontmatter).toEqual({
      title: "Calculadora",
      order: 1,
      tourId: "calc-basico",
    });
    expect(mod.html).toBeUndefined();
    expect(mod.toc).toBeUndefined();
    expect(mod.slug).toBeUndefined();
    expect(mod.locale).toBeUndefined();
  });

  it("keeps tourId in frontmatter when the author sets it", () => {
    const withTour = transform(
      "---\ntitle: Tour\ntourId: orcamentos-clientes\norder: 4\n---\n\n# Title\n",
      articlePath("pt-BR", "com-tour"),
    );
    expect(withTour).not.toBeNull();
    expect(withTour?.code).toContain('"tourId":"orcamentos-clientes"');
  });

  it("ignores markdown files outside docs/wiki", () => {
    expect(
      transform("# not wiki", path.resolve(ROOT, "docs", "conventions.md")),
    ).toBeNull();
    expect(
      transform(
        "export const x = 1",
        path.resolve(ROOT, "src", "main.tsx"),
      ),
    ).toBeNull();
  });

  it("fails closed on malformed frontmatter", () => {
    expect(() =>
      transform("# no frontmatter", articlePath("pt-BR", "quebrado")),
    ).toThrow(/frontmatter/);

    expect(() =>
      transform(
        "---\ntitle: Quebrado\nunknown: value\n---\n\n# Title\n",
        articlePath("pt-BR", "quebrado"),
      ),
    ).toThrow(/unknown key/);
  });
});
