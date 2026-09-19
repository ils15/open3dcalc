import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen } from "lucide-react";

import { useWikiNamespace } from "@/shared/hooks/useWikiNamespace";
import {
  WIKI_NAMESPACE,
  type WikiBundle,
  type WikiBundleArticle,
} from "@/shared/lib/wiki/loadWikiBundle";
import { WikiArticle } from "./WikiArticle";

/** One nav entry: the bundle is keyed by slug, the article carries no slug. */
interface WikiEntry {
  slug: string;
  article: WikiBundleArticle;
}

/**
 * Placeholder while the lazy `wiki` namespace chunk is fetched.
 *
 * `ready` never vibrates (R2, covered by `useWikiNamespace`): this is shown
 * only until the FIRST bundle resolves, so it never replaces real content.
 */
function WikiSkeleton() {
  return (
    <div
      className="space-y-5"
      data-testid="wiki-skeleton"
      role="status"
      aria-label="Carregando"
    >
      <div className="surface rounded-xl p-5 sm:p-6">
        <div className="h-7 w-40 rounded-lg animate-shimmer" />
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-28 rounded-lg animate-shimmer" />
        <div className="h-9 w-36 rounded-lg animate-shimmer" />
      </div>
      <div className="surface rounded-xl p-5 sm:p-6 lg:p-8">
        <div className="space-y-4">
          <div className="h-8 w-3/4 rounded-lg animate-shimmer" />
          <div className="h-4 w-full rounded animate-shimmer" />
          <div className="h-4 w-11/12 rounded animate-shimmer" />
          <div className="h-4 w-9/12 rounded animate-shimmer" />
          <div className="h-4 w-full rounded animate-shimmer" />
          <div className="h-4 w-7/12 rounded animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

/**
 * The wiki tab container.
 *
 * Mounts `useWikiNamespace` — the imperative (Suspense-free, see
 * `src/shared/i18n/i18n.ts` `react.useSuspense: false`) loader of the `wiki`
 * namespace — and renders a skeleton until its `ready` flips. Once ready the
 * bundle is read straight out of i18n with `getResourceBundle`, the same read
 * path `ChangelogPage` uses with `t("changelog.versions", { returnObjects:
 * true })`; the difference is only that the wiki lives in its own namespace
 * rather than under `translation`.
 *
 * `loadWikiBundle` inserts articles in ascending `frontmatter.order`, but the
 * nav order is re-derived here so it does not depend on insertion order, and
 * the default selection is the first entry by `order` (not by key).
 */
export function WikiPage() {
  const { t, i18n } = useTranslation();
  const { ready, locale: bundleLocale } = useWikiNamespace();
  const [selectedSlug, setSelectedSlug] = useState("");

  // The bundle is read for the locale the hook reports, not for
  // `i18n.language`: on a language switch the new locale's chunk is still
  // loading, and `bundleLocale` still points at the previous one — whose
  // articles stayed in i18n — so content never flashes or drops to a skeleton.
  // It flips to the new locale only once that bundle has actually landed.
  const bundle = bundleLocale === undefined
    ? undefined
    : (i18n.getResourceBundle(bundleLocale, WIKI_NAMESPACE) as
        | WikiBundle
        | undefined);

  const entries = useMemo<WikiEntry[]>(() => {
    if (!bundle) return [];
    return Object.entries(bundle)
      .map(([slug, article]) => ({ slug, article }))
      .sort((a, b) => a.article.order - b.article.order);
  }, [bundle]);

  // Falls back to the first entry by order when nothing is selected yet or
  // the selection vanished with a language switch.
  const active = entries.find((entry) => entry.slug === selectedSlug) ?? entries[0];

  if (!ready || !active) return <WikiSkeleton />;

  return (
    <div className="space-y-5">
      <header className="surface flex items-center gap-2 rounded-xl p-5 sm:p-6">
        <BookOpen
          className="h-5 w-5 shrink-0 text-[var(--color-accent)]"
          aria-hidden="true"
        />
        <h1 className="text-lg font-bold gradient-text">{t("nav.wiki")}</h1>
      </header>

      <nav
        aria-label={t("nav.wiki")}
        className="flex flex-wrap gap-2"
      >
        {entries.map(({ slug, article }) => {
          const isActive = slug === active.slug;
          return (
            <button
              key={slug}
              type="button"
              onClick={() => setSelectedSlug(slug)}
              aria-current={isActive ? "true" : undefined}
              className={`rounded-lg border px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                isActive
                  ? "border-transparent bg-[var(--color-accent-muted)] text-[var(--color-accent-light)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              {article.title}
            </button>
          );
        })}
      </nav>

      <WikiArticle key={active.slug} article={active.article} />
    </div>
  );
}
