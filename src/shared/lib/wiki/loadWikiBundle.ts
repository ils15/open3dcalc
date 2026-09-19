/**
 * Assemble the i18n `wiki` namespace for one locale from the compiled article
 * modules.
 *
 * Articles are authored in markdown under `docs/wiki/<locale>/` and compiled
 * to plain data modules at build time by `markdownWikiPlugin` (see
 * `vite/plugins/markdownWikiPlugin.ts`). Nothing here parses markdown — this
 * module only filters, sorts and reshapes those modules into the nested-by-slug
 * bundle consumed by `i18n.addResourceBundle(locale, "wiki", bundle)`, so
 * `t("wiki.<slug>.title")` / `t("wiki.<slug>.html")` read exactly like the
 * `t("changelog.versions", { returnObjects: true })` pattern already used by
 * ChangelogPage.
 *
 * Locale fallback mirrors the app's binary language set (i18n.ts:41): only
 * pt-BR and en-US exist, so a locale with no articles falls back to en-US when
 * the app's resolved language is en-US, and to pt-BR otherwise. Content parity
 * between the two locales is enforced in CI, not here.
 */
import i18n from "@/shared/i18n/i18n";

import type { WikiTocItem } from "./markdownToHtml";
import { wikiArticles } from "./wikiArticles";
import type { WikiArticleModule } from "../../../../vite/plugins/markdownWikiPlugin";

/** i18n namespace every wiki article lives under. */
export const WIKI_NAMESPACE = "wiki";

/** One article, keyed by slug, inside the `wiki` namespace. */
export interface WikiBundleArticle {
  /** Frontmatter title — the article's nav/heading label. */
  title: string;
  /** Frontmatter order — the article's position in the wiki index. */
  order: number;
  /** Build-time table of contents (headings h1-h3 with anchor ids). */
  toc: WikiTocItem[];
  /** Compiled, sanitized article body. Rendered as-is (build-time pipeline). */
  html: string;
}

/**
 * The `wiki` namespace: `{ [slug]: article }`. Entries are inserted in
 * ascending `frontmatter.order`, so `Object.keys(bundle)` yields the article
 * nav order by construction.
 */
export interface WikiBundle {
  [slug: string]: WikiBundleArticle;
}

/**
 * Does the glob hold at least one article for `locale`?
 *
 * Checked against the glob KEY (not the loaded module) on purpose: the keys
 * are filtered before any dynamic import runs, so an uncovered locale never
 * pays for (or awaits) another locale's chunk.
 */
function localeHasArticles(locale: string): boolean {
  const prefix = `/docs/wiki/${locale}/`;
  return Object.keys(wikiArticles).some((key) => key.startsWith(prefix));
}

/**
 * Load every compiled article module of one locale as a single
 * `Promise.all` — Vite turns this into one dynamic import per locale.
 */
async function loadLocaleModules(locale: string): Promise<WikiArticleModule[]> {
  const prefix = `/docs/wiki/${locale}/`;
  const loaders = Object.entries(wikiArticles)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, load]) => load());
  return Promise.all(loaders);
}

/**
 * Reshape and sort the modules into the nested-by-slug bundle.
 *
 * Sorting happens here (not in the glob) so the ordering is part of the
 * namespace contract: `frontmatter.order` ascending, duplicates keep their
 * relative order (stable sort).
 */
function toBundle(modules: WikiArticleModule[]): WikiBundle {
  const sorted = modules
    .slice()
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);

  const bundle: WikiBundle = {};
  for (const article of sorted) {
    bundle[article.slug] = {
      title: article.frontmatter.title,
      order: article.frontmatter.order,
      toc: article.toc,
      html: article.html,
    };
  }
  return bundle;
}

/**
 * Load the `wiki` namespace bundle for `locale`, falling back to the app's
 * other supported locale when `locale` has no articles.
 *
 * @param locale - the locale the caller wants (usually `i18n.language`).
 * @returns the nested-by-slug bundle for `i18n.addResourceBundle`.
 */
export async function loadWikiBundle(locale: string): Promise<WikiBundle> {
  const target = localeHasArticles(locale) ? locale : fallbackLocale();
  return toBundle(await loadLocaleModules(target));
}

/**
 * The wiki locale to use when the requested one is not covered.
 *
 * The app is binary (i18n.ts:41 maps anything that is not pt-BR to en-US), so
 * this mirrors that split: an en-US app falls back to en-US articles,
 * everything else to the pt-BR ones (which are also `fallbackLng`).
 */
function fallbackLocale(): string {
  return i18n.resolvedLanguage === "en-US" ? "en-US" : "pt-BR";
}
