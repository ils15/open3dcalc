import { Shield, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useConsentStore } from "@/shared/stores/consentStore";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

export function PrivacyBanner() {
  const { t } = useTranslation();
  const prefersReduced = useReducedMotion();
  const dismissed = useConsentStore((s) => s.privacyBannerDismissed);
  const dismissBanner = useConsentStore((s) => s.dismissBanner);

  if (dismissed) return null;

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      role="status"
      aria-live="polite"
      className="sticky top-0 z-20 w-full border-b border-[var(--color-border)]"
      style={{
        background: "var(--color-bg-primary)",
      }}
    >
      <div className="max-w-[1440px] mx-auto flex items-start gap-2 px-4 sm:px-4 py-2">
        <Shield
          className="w-4 h-4 mt-0.5 shrink-0 text-[var(--color-accent)]"
          aria-hidden="true"
        />
        <p className="text-xs text-[var(--color-text-secondary)] leading-snug flex-1">
          {t("privacy.banner.text")}
        </p>
        <button
          onClick={dismissBanner}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t("privacy.banner.dismiss")}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}
