import { Shield, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useConsentStore } from '@/shared/stores/consentStore'
import { useReducedMotion } from '@/shared/hooks/useReducedMotion'

export function PrivacyBanner() {
  const { t } = useTranslation()
  const prefersReduced = useReducedMotion()
  const dismissed = useConsentStore((s) => s.privacyBannerDismissed)
  const dismissBanner = useConsentStore((s) => s.dismissBanner)

  if (dismissed) return null

  return (
    <motion.div
      initial={prefersReduced ? { opacity: 1 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      role="status"
      aria-live="polite"
      className="sticky top-0 z-20 w-full border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/95 backdrop-blur-md shadow-xs"
    >
      <div className="max-w-[1440px] mx-auto flex items-center gap-3 px-4 sm:px-6 py-2.5">
        <div className="w-7 h-7 rounded-lg bg-[var(--color-accent-subtle)] border border-[var(--color-border-accent)] flex items-center justify-center shrink-0 text-[var(--color-accent)]">
          <Shield className="w-4 h-4" aria-hidden="true" />
        </div>
        <span className="hidden sm:inline-flex items-center text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[var(--color-bg-primary)] text-[var(--color-accent)] border border-[var(--color-border-subtle)] shrink-0">
          Local-First
        </span>
        <p className="text-xs text-[var(--color-text-secondary)] leading-snug flex-1">
          {t('privacy.banner.text')}
        </p>
        <button
          type="button"
          onClick={dismissBanner}
          className="hidden sm:inline-flex items-center text-xs font-semibold px-3 py-1 rounded-lg bg-[var(--color-bg-primary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-xs transition-colors shrink-0 focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
        >
          Entendi
        </button>
        <button
          type="button"
          onClick={dismissBanner}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t('privacy.banner.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}
