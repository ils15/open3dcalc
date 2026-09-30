import { useEffect, useState } from "react";

/**
 * Tailwind's `2xl` breakpoint (1536px). Exported so the panels whose CSS
 * depends on it (`hidden 2xl:flex` for the results sidebar, `2xl:hidden` for
 * the inline results) and the code that has to mirror those wrappers stay on
 * the same number.
 */
export const BREAKPOINT_2XL = "(min-width: 1536px)";

/**
 * subscribes to a media query and re-renders on every change.
 *
 * Returns `false` when the environment has no `matchMedia` (SSR) so callers
 * fall back to their narrowest layout instead of throwing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const mq = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    // The query is a constant per call site, so the value read at mount is
    // already the current one here; the listener carries every later flip.
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
