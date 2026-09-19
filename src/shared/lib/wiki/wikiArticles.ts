/**
 * The wiki article registry: the single `import.meta.glob` over `docs/wiki/`.
 *
 * Extracted into its own module so tests can replace the whole record with
 * `vi.mock("@/shared/lib/wiki/wikiArticles")` — `import.meta.glob` is a
 * build-time construct and cannot be intercepted by `vi.mock` where it is
 * inlined into `loadWikiBundle`.
 *
 * LAZY ON PURPOSE (R1, validated — see `vite/plugins/markdownWikiPlugin.ts`):
 * `eager: false` makes Vite emit ONE dynamic import per locale, fetched the
 * first time the wiki tab is opened instead of inlined into the main chunk.
 * The desktop bundle already ships five dynamic imports under Electron's
 * `script-src 'self'` CSP and the wiki chunks were verified the same way, so
 * do NOT flip this to `eager: true` — that would bundle every article body of
 * every locale at startup. The eager variant that exists is the `?wiki-meta`
 * frontmatter index, and it is not used here.
 *
 * Keys are root-absolute POSIX paths (`/docs/wiki/<locale>/<slug>.md`) and
 * every module is the plugin's compiled `{ slug, locale, frontmatter, toc,
 * html }` shape.
 */
import type { WikiArticleModule } from "../../../../vite/plugins/markdownWikiPlugin";

export const wikiArticles = import.meta.glob<WikiArticleModule>(
  "/docs/wiki/**/*.md",
  { eager: false },
);
