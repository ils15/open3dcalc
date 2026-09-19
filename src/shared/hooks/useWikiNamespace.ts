import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { loadWikiBundle, WIKI_NAMESPACE } from "@/shared/lib/wiki/loadWikiBundle";

/**
 * Status of the lazy `wiki` i18n namespace for the current language.
 */
export interface WikiNamespaceStatus {
  /**
   * `false` until the first bundle for the active locale has been added to
   * i18n. Never vibrates (R2): once `true` it stays `true` — a language switch
   * keeps the previous locale's articles resolvable while the new bundle
   * loads, so consumers can render a skeleton until the first load and real
   * content forever after, without a flash of raw keys.
   */
  ready: boolean;
}

/**
 * Mount-time loader for the `wiki` i18n namespace.
 *
 * The wiki articles are compiled at build time into lazy per-locale chunks
 * (see `src/shared/lib/wiki/loadWikiBundle`), and this hook is what pulls a
 * locale's chunk into i18n the first time the wiki surface mounts. It is
 * deliberately NOT a Suspense boundary: `i18n` runs with `react.useSuspense:
 * false` (workaround for recharts #7463, see `src/shared/i18n/i18n.ts`), so the
 * load is awaited imperatively and signalled through the local `ready` state.
 *
 * Behaviour:
 * - loads the active locale's bundle on mount and adds it with
 *   `addResourceBundle(locale, "wiki", bundle, deep, overwrite)`;
 * - reloads on `languageChanged`, adding the new locale's bundle (the old one
 *   stays in i18n, so switching back is instant);
 * - is idempotent per locale: a locale already added is never re-fetched, which
 *   keeps repeated `languageChanged` events from looping;
 * - removes its listener on unmount, and a load that resolves after unmount is
 *   dropped instead of mutating i18n of an unmounted tree.
 *
 * @returns `{ ready }` — consumers render a skeleton while `!ready`.
 */
export function useWikiNamespace(): WikiNamespaceStatus {
  const { i18n } = useTranslation();
  const [ready, setReady] = useState(false);
  const loadedLocales = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;

    // The locale actually being displayed: for a language the app does not
    // carry (e.g. an 'es-ES' browser), i18n.resolvedLanguage is the one it
    // fell back to, so the wiki follows the same language as the rest of the
    // UI instead of the raw requested code.
    const resolveLocale = (): string => i18n.resolvedLanguage || i18n.language;

    const load = async (locale: string): Promise<void> => {
      if (loadedLocales.current.has(locale)) {
        // Already in i18n.resources: report ready and skip the refetch
        // (idempotency — repeated languageChanged events must not loop).
        setReady(true);
        return;
      }

      const bundle = await loadWikiBundle(locale);
      if (!active) return; // unmounted mid-flight: leave i18n untouched

      i18n.addResourceBundle(
        locale,
        WIKI_NAMESPACE,
        bundle,
        /* deep */ true,
        /* overwrite */ true,
      );
      loadedLocales.current.add(locale);
      setReady(true);
    };

    void load(resolveLocale());

    const handleLanguageChanged = (): void => {
      void load(resolveLocale());
    };
    i18n.on("languageChanged", handleLanguageChanged);

    return () => {
      active = false;
      i18n.off("languageChanged", handleLanguageChanged);
    };
  }, [i18n]);

  return { ready };
}
