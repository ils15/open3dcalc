import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useIsDemoMode } from "./useDemoMode";

/**
 * Guards export and share actions while ephemeral demo mode is active.
 *
 * Demo data is fictional/ephemeral, so emitting a document, file or link is
 * unsupported in that mode. Real local data remains exportable in Beta.
 * `guard()` returns
 * `true` when the caller must cancel the action — in that case `onBlocked`
 * receives the explanatory message so the caller surfaces it as feedback
 * (toast/banner) instead of failing silently. Returns `false` when the action
 * may proceed normally.
 */
export function useDemoExportGuard(onBlocked?: (message: string) => void): {
  isDemoMode: boolean;
  guard: () => boolean;
} {
  const { t } = useTranslation();
  const isDemoMode = useIsDemoMode();

  const guard = useCallback(() => {
    if (!isDemoMode) {
      return false;
    }
    onBlocked?.(t("demo.export.blockedTitle"));
    return true;
  }, [isDemoMode, onBlocked, t]);

  return { isDemoMode, guard };
}
