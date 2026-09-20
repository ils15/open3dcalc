import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";

import type { WikiTocItem } from "@/shared/lib/wiki/markdownToHtml";
import type { WikiBundleArticle } from "@/shared/lib/wiki/loadWikiBundle";

import "./wiki.css";

/**
 * Indent per heading depth so the table of contents reads as nested.
 */
const TOC_INDENT: Record<WikiTocItem["depth"], string> = {
  1: "pl-0",
  2: "pl-4",
  3: "pl-8",
};

interface WikiArticleProps {
  /**
   * The bundle entry to render: `{ title, order, toc, html }`. The `html` was
   * compiled and sanitized at build time (see
   * `src/shared/lib/wiki/markdownToHtml.ts`), so it is injected as-is.
   */
  article: WikiBundleArticle;
  /**
   * Delegated click handler over the article body.
   *
   * The body is raw HTML (`dangerouslySetInnerHTML`), so its anchors are not
   * React elements and no `onClick` prop can be attached to them individually.
   * React still bubbles synthetic clicks through the container, which is what
   * lets `WikiPage` intercept same-document fragments — the case that matters:
   * a cross-link points at the heading id of ANOTHER article, and the browser
   * cannot find it on the current page. `WikiPage` owns the bundle, so only it
   * can map the id to the owning slug and switch articles. Same-article
   * anchors and unknown ids are left to the browser / left inert.
   */
  onAnchorClick: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Renders one wiki article.
 *
 * Two parts, side by side from `lg` up:
 * - a sticky table of contents built from the build-time `toc` field, whose
 *   anchors point at the ids `rehype-slug` wrote onto the headings
 *   (`#user-content-<slug>`); hidden below `lg` and hidden when the article
 *   has no headings at all;
 * - the article body through a SINGLE `dangerouslySetInnerHTML` — the whole
 *   remark/rehype pipeline (including `rehype-sanitize`) ran at build time, so
 *   no markdown parser and no raw HTML reach the client.
 *
 * Kept presentational on purpose: article selection and the i18n namespace
 * live in `WikiPage`.
 */
export function WikiArticle({ article, onAnchorClick }: WikiArticleProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
      {article.toc.length > 0 ? (
        <nav
          aria-label={t("wiki.toc")}
          className="sticky top-6 hidden self-start lg:block"
        >
          <ul className="space-y-0.5 border-l border-[var(--color-border)] pl-3">
            {article.toc.map((item) => (
              <li key={item.slug}>
                <a
                  href={`#${item.slug}`}
                  className={`block py-1.5 text-sm leading-snug text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:rounded ${TOC_INDENT[item.depth]}`}
                >
                  {item.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      <article
        className="wiki-prose surface min-w-0 rounded-xl p-5 sm:p-6 lg:p-8"
        onClick={onAnchorClick}
        dangerouslySetInnerHTML={{ __html: article.html }}
      />
    </div>
  );
}
