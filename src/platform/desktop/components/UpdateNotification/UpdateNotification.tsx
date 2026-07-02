import { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Download,
  RefreshCw,
  RotateCcw,
  X,
  ArrowUpCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useUpdaterStore, type UpdateStatus } from './UpdaterStore'

// ── Props ──────────────────────────────────────────────────────────

export interface UpdateNotificationProps {
  /** Called when the user clicks "Check for Updates". Defaults to store action. */
  onCheck?: () => void
  /** Optional className for the root element */
  className?: string
}

// ── Format helpers ─────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1000)), units.length - 1)
  const value = bytes / Math.pow(1000, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond === 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

// ── Sub-components ─────────────────────────────────────────────────

function CheckingBanner() {
  const { t } = useTranslation()
  return (
    <div
      className="surface rounded-xl p-5 flex items-center gap-4 border border-[var(--color-border)] shadow-lg animate-fade-in"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-6 h-6 text-[var(--color-accent)] animate-spin shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t('update.checking')}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {t('update.checkingDesc')}
        </p>
      </div>
    </div>
  )
}

interface AvailableBannerProps {
  version: string
  releaseNotes: string | null
  progress: number
  downloadSpeed: number
  downloadedBytes: number
  totalBytes: number
  status: UpdateStatus
  onDownload: () => void
  onSkip: () => void
  onDismiss: () => void
}

function AvailableBanner({
  version,
  releaseNotes,
  progress,
  downloadSpeed,
  downloadedBytes,
  totalBytes,
  status,
  onDownload,
  onSkip,
  onDismiss,
}: AvailableBannerProps) {
  const { t } = useTranslation()
  const bannerRef = useRef<HTMLDivElement>(null)
  const isDownloading = status === 'downloading'

  // Focus management: move focus to the banner when it appears
  useEffect(() => {
    if (bannerRef.current) {
      bannerRef.current.focus()
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDownloading) {
        onDismiss()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isDownloading, onDismiss])

  const progressPercent = Math.min(Math.max(progress, 0), 100)

  return (
    <div
      ref={bannerRef}
      className="surface rounded-xl p-5 border border-[var(--color-border)] shadow-xl animate-fade-in"
      role="alert"
      aria-live="polite"
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0">
            {isDownloading ? (
              <Loader2 className="w-5 h-5 text-[var(--color-accent)] animate-spin" />
            ) : (
              <ArrowUpCircle className="w-5 h-5 text-[var(--color-accent)]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {isDownloading
                ? t('update.downloading', { version })
                : t('update.available', { version })}
            </p>
            {!isDownloading && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {t('update.availableDesc')}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t('update.dismiss')}
          disabled={isDownloading}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      {isDownloading && (
        <div className="mb-4 space-y-2">
          <div
            className="w-full h-2 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('update.downloadingProgress')}
          >
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span>
              {formatBytes(downloadedBytes)} / {formatBytes(totalBytes)}
            </span>
            <span className="flex items-center gap-1">
              <span>{progressPercent.toFixed(0)}%</span>
              {downloadSpeed > 0 && (
                <>
                  <span className="text-[var(--color-text-muted)]">·</span>
                  <span>{formatSpeed(downloadSpeed)}</span>
                </>
              )}
            </span>
          </div>
        </div>
      )}

      {/* Release notes preview */}
      {releaseNotes && !isDownloading && (
        <details className="group mb-4">
          <summary className="text-xs font-semibold text-[var(--color-accent)] cursor-pointer hover:text-[var(--color-accent-light)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none rounded">
            {t('update.whatsNew')}
          </summary>
          <div className="mt-2 text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto bg-[var(--color-bg-elevated)] rounded-lg p-3">
            {releaseNotes}
          </div>
        </details>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isDownloading ? (
          <span className="text-xs text-[var(--color-text-muted)] flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {t('update.downloadingProgress')}
          </span>
        ) : (
          <>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-accent)] hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none shadow-md"
            >
              <Download className="w-3.5 h-3.5" />
              {t('update.download')}
            </button>
            <button
              onClick={onSkip}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-2 py-1.5 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
            >
              {t('update.skipVersion')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

interface DownloadedBannerProps {
  version: string
  onInstall: () => void
  onDismiss: () => void
}

function DownloadedBanner({ version, onInstall, onDismiss }: DownloadedBannerProps) {
  const { t } = useTranslation()
  return (
    <div
      className="surface rounded-xl p-5 border border-emerald-500/30 shadow-lg animate-fade-in"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-success)]/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {t('update.ready', { version })}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {t('update.readyDesc')}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t('update.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-4">
        <button
          onClick={onInstall}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none shadow-md"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t('update.restartInstall')}
        </button>
      </div>
    </div>
  )
}

interface ErrorBannerProps {
  message: string
  onRetry: () => void
  onDismiss: () => void
}

function ErrorBanner({ message, onRetry, onDismiss }: ErrorBannerProps) {
  const { t } = useTranslation()
  return (
    <div
      className="surface rounded-xl p-5 border border-red-500/30 shadow-lg animate-fade-in"
      role="alert"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-danger)]/20 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              {t('update.failed')}
            </p>
            <p className="text-xs text-red-400 mt-0.5">{message}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none"
          aria-label={t('update.dismiss')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mt-4">
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-[var(--color-accent)] hover:brightness-110 transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none shadow-md"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('update.retry')}
        </button>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────

export function UpdateNotification({
  onCheck,
  className = '',
}: UpdateNotificationProps) {
  const { t } = useTranslation()
  const {
    status,
    version,
    releaseNotes,
    progress,
    downloadSpeed,
    downloadedBytes,
    totalBytes,
    errorMessage,
    checkForUpdates,
    startDownload,
    installUpdate,
    skipVersion,
    dismiss,
  } = useUpdaterStore(
    useShallow((s) => ({
      status: s.status,
      version: s.version,
      releaseNotes: s.releaseNotes,
      progress: s.progress,
      downloadSpeed: s.downloadSpeed,
      downloadedBytes: s.downloadedBytes,
      totalBytes: s.totalBytes,
      errorMessage: s.errorMessage,
      checkForUpdates: s.checkForUpdates,
      startDownload: s.startDownload,
      installUpdate: s.installUpdate,
      skipVersion: s.skipVersion,
      dismiss: s.dismiss,
    })),
  )

  const handleCheck = useCallback(() => {
    if (onCheck) {
      onCheck()
    } else {
      checkForUpdates()
    }
  }, [onCheck, checkForUpdates])

  // Auto-dismiss "not-available" after 3 seconds
  useEffect(() => {
    if (status === 'not-available') {
      const timer = setTimeout(() => {
        dismiss()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, dismiss])

  // ── Render by status ──

  // Idle — render nothing visible (but keep the check button hook)
  if (status === 'idle') {
    return null
  }

  return (
    <div className={className}>
      {/* Checking — toast-style banner */}
      {status === 'checking' && <CheckingBanner />}

      {/* Available (idle before download) */}
      {status === 'available' && (
        <AvailableBanner
          version={version ?? ''}
          releaseNotes={releaseNotes}
          progress={progress}
          downloadSpeed={downloadSpeed}
          downloadedBytes={downloadedBytes}
          totalBytes={totalBytes}
          status={status}
          onDownload={startDownload}
          onSkip={skipVersion}
          onDismiss={dismiss}
        />
      )}

      {/* Downloading */}
      {status === 'downloading' && (
        <AvailableBanner
          version={version ?? ''}
          releaseNotes={releaseNotes}
          progress={progress}
          downloadSpeed={downloadSpeed}
          downloadedBytes={downloadedBytes}
          totalBytes={totalBytes}
          status={status}
          onDownload={startDownload}
          onSkip={skipVersion}
          onDismiss={dismiss}
        />
      )}

      {/* Downloaded */}
      {status === 'downloaded' && (
        <DownloadedBanner
          version={version ?? ''}
          onInstall={installUpdate}
          onDismiss={dismiss}
        />
      )}

      {/* Error */}
      {status === 'error' && (
        <ErrorBanner
          message={errorMessage ?? 'An unknown error occurred'}
          onRetry={handleCheck}
          onDismiss={dismiss}
        />
      )}

      {/* Not available — inline notice */}
      {status === 'not-available' && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--color-success)]/10 border border-emerald-500/20 text-xs text-emerald-400 animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{t('update.upToDate')}</span>
        </div>
      )}

      {/* Check for Updates button */}
      {/*
        This button is rendered only when there's visible content.
        It's a convenience hook for the header to use.
        The `onCheck` prop allows parent components to wire this up.
      */}
    </div>
  )
}

// ── CheckButton (standalone trigger) ───────────────────────────────

interface CheckForUpdatesButtonProps {
  onClick?: () => void
  className?: string
}

export function CheckForUpdatesButton({
  onClick,
  className = '',
}: CheckForUpdatesButtonProps) {
  const { t } = useTranslation()
  const { status, checkForUpdates } = useUpdaterStore(
    useShallow((s) => ({
      status: s.status,
      checkForUpdates: s.checkForUpdates,
    })),
  )

  const isLoading = status === 'checking'

  return (
    <button
      onClick={onClick ?? checkForUpdates}
      disabled={isLoading}
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:outline-none ${
        isLoading
          ? 'text-[var(--color-text-muted)] cursor-not-allowed'
          : 'text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] active:scale-[0.97]'
      } ${className}`}
      aria-label={t('update.checkForUpdates')}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <RefreshCw className="w-4 h-4" />
      )}
      <span>{isLoading ? t('update.checkingShort') : t('update.checkForUpdates')}</span>
    </button>
  )
}
