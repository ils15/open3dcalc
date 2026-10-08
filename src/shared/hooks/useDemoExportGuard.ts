import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { isBetaChannel } from "@/shared/config/betaChannel";

import { useIsDemoMode } from "./useDemoMode";

/**
 * Guards export and share actions in Beta or while ephemeral demo mode is active.
 *
 * Demo data is fictional/ephemeral, and Beta forbids all exports, so emitting a
 * document, file or link is unsupported. `guard()` returns
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
    if (isBetaChannel) {
      onBlocked?.(t("privacy.betaFirstRun.noExport"));
      return true;
    }
    if (!isDemoMode) {
      return false;
    }
    onBlocked?.(t("demo.export.blockedTitle"));
    return true;
  }, [isDemoMode, onBlocked, t]);

  return { isDemoMode, guard };
}
