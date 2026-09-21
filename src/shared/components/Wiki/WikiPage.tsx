import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { MouseEvent } from "react";
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
function WikiSkeleton({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="space-y-5"
      data-testid="wiki-skeleton"
      role="status"
      aria-label={ariaLabel}
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

  // `undefined` while the bundle has not landed (skeleton render); the click
  // handler and effects key off this and short-circuit while there is no
  // rendered article to resolve a fragment against.
  const activeSlug = active?.slug;

  /**
   * `#user-content-<id>` → the slug of the article that owns that heading.
   *
   * Built once per bundle from every article's build-time `toc`: a cross-link
   * points at the H1/H2 id of ANOTHER article, and the bundle is the only
   * place where "which article has this heading" is answerable in runtime.
   * The toc slugs are raw UTF-8 (`rehype-slug` writes them unencoded), so they
   * are the comparison keys — the href is decoded before the lookup (below).
   */
  const idToSlug = useMemo(() => {
    const map = new Map<string, string>();
    if (bundle) {
      for (const [slug, article] of Object.entries(bundle)) {
        for (const item of article.toc) map.set(item.slug, slug);
      }
    }
    return map;
  }, [bundle]);

  /**
   * A pending cross-article scroll.
   *
   * Set together with `setSelectedSlug`: the target article's html is not in
   * the DOM until the next render, so `scrollIntoView`/`focus` must run in an
   * effect on `selectedSlug`, never in the click handler.
   *
   * Deliberately a REF and not state. The effect clears it once consumed, and
   * a state-based flag would need `setPendingAnchor(null)` — a re-render of
   * `WikiArticle`. React rewrites `dangerouslySetInnerHTML` on every re-render
   * (the `__html` string is compared, but the children it produced are not
   * reconciled), which replaces the very heading the effect just focused,
   * discarding its imperatively-set `tabindex` and focus. A ref carries no such
   * re-render: the DOM work survives because nothing repaints the article.
   */
  const pendingAnchor = useRef<string | null>(null);

  /**
   * Resolve a same-document fragment to the article that owns it.
   *
   * `decodeURIComponent` is mandatory: `rehype-stringify` percent-encodes the
   * href (`#user-content-custos-da-m%C3%A1quina`) while the heading ids stay in
   * raw UTF-8, so an undecoded fragment never matches a toc slug. A malformed
   * encoding (`%E0%A4`) throws on decode and is treated as unknown.
   *
   * @returns the owning slug for a fragment owned by another article, `null`
   * when the fragment is unknown or belongs to the current article (the
   * browser's own in-page scroll handles the latter and must not be blocked).
   */
  const resolveCrossArticle = useCallback(
    (hash: string, currentSlug: string | undefined): string | null => {
      if (!hash.startsWith("#")) return null;
      if (currentSlug === undefined) return null;

      let id: string;
      try {
        id = decodeURIComponent(hash.slice(1));
      } catch {
        return null;
      }

      const owner = idToSlug.get(id);
      if (owner === undefined || owner === currentSlug) return null;
      return owner;
    },
    [idToSlug],
  );

  /**
   * Delegated click handler over the rendered article.
   *
   * The article body comes from `dangerouslySetInnerHTML`, so its anchors are
   * not React elements — but the click still bubbles through React's synthetic
   * delegation, and the container intercepts it here. Only same-document
   * fragments (`#...`) are ever hijacked; external links keep default.
   */
  const handleArticleClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      const link = (event.target as Element).closest("a");
      if (!(link instanceof HTMLAnchorElement)) return;

      const hash = link.getAttribute("href") ?? "";
      // Same-document links only: `[artigo](#user-content-...)`. Anything with
      // a host/protocol is an external link and none of our business.
      if (!hash.startsWith("#")) return;

      const target = resolveCrossArticle(hash, activeSlug);
      if (target === null) {
        // Same-article anchor or unknown id: leave the browser alone. For the
        // unknown case there is nothing to scroll to anyway, so the click is
        // a no-op rather than a jump to the page top.
        if (!idToSlug.has(hash.slice(1))) event.preventDefault();
        return;
      }

      // Cross-article: jump to the owner, and stage the anchor so the effect
      // below scrolls to the heading once its html has rendered. The fragment
      // is decoded to match the raw UTF-8 heading id: `rehype-slug` writes ids
      // unencoded, so the percent-encoded href (`%C3%A1`) would never match in
      // `getElementById`. This cannot throw: `resolveCrossArticle` already
      // decoded the same input successfully to return a non-null target.
      event.preventDefault();
      pendingAnchor.current = decodeURIComponent(hash.slice(1));
      setSelectedSlug(target);
    },
    [activeSlug, idToSlug, resolveCrossArticle],
  );

  // Scrolls to (and focuses) a cross-article target once the article that owns
  // it has rendered.
  //
  // The dep is `activeSlug` alone: `WikiArticle` is keyed by slug, so React
  // unmounts the old `<article>` and mounts a fresh one rather than patching
  // it — any DOM node grabbed before that remount commits is discarded, taking
  // its imperatively-set `tabindex` with it. Running on the slug change (and
  // reading the anchor from a ref, not state) places the DOM work AFTER the
  // remount commits and keeps it the last thing that touches the article: no
  // follow-up state update means no re-render, and `dangerouslySetInnerHTML`
  // does not get a chance to swap the focused node out from under the test.
  // The guard makes it a no-op for plain nav button clicks, where the ref was
  // never staged.
  useEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor || !activeSlug) return;
    pendingAnchor.current = null;

    const target = document.getElementById(anchor);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });

    // Headings are not focusable by default. Without this, keyboard and screen
    // reader users land on the article top instead of the section the link
    // promised — `tabindex={-1}` makes the element programmatically focusable
    // without adding it to the tab order.
    if (target.getAttribute("tabindex") === null) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  }, [activeSlug]);

  if (!ready || !active) return <WikiSkeleton ariaLabel={t("wiki.loading")} />;

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

      <WikiArticle
        key={active.slug}
        article={active.article}
        onAnchorClick={handleArticleClick}
      />
    </div>
  );
}
